import { UserRole, ModuleKey } from '@prisma/client';
import prisma from '../../config/database';
import { statementService } from '../dues/statement.service';
import { duesService } from '../dues/dues.service';
import { upiService } from '../dues/upi.service';
import { maintenanceService } from '../maintenance/maintenance.service';
import { visitorsService } from '../visitors/visitors.service';
import { journalService } from '../accounting/journal.service';
import { entitlementService } from '../../services/entitlement.service';
import {
  resolveMenuForRole, MOBILE_MENU_BY_ID, RoleMenuOverrides,
} from '../system/mobile-menu';
import {
  FEATURE_HELP, lookupTerms, adminScreensFor, mobileDirectionsFor,
} from './assistant.help';
import { searchKnowledge } from './assistant.knowledge';

/**
 * What the assistant is allowed to do, and on whose behalf.
 *
 * THIS FILE IS THE SECURITY BOUNDARY. Not the system prompt.
 *
 * A language model cannot be relied on to refuse a request it has the means to
 * fulfil, so it is never given the means. Two rules do the work:
 *
 * 1. NO TOOL TAKES AN IDENTITY ARGUMENT. There is no `association_id`, no
 *    `user_id`, no `unit_id` in any schema below. Those come from the verified
 *    JWT via ToolContext. "What does flat B-204 owe?" from a resident is not
 *    refused by good behaviour — it cannot be expressed, because the resident's
 *    tools have nowhere to put a flat number.
 *
 * 2. THE CATALOGUE IS FILTERED BEFORE THE MODEL SEES IT. A resident's request
 *    is sent with the resident's tools only. The model is never told that
 *    `collection_summary` exists, so it cannot be argued into calling it.
 *
 * The one tool that does accept a flat number, `unit_statement`, is restricted
 * to roles that can already see every unit on a screen. It resolves the flat
 * inside the caller's association, so a valid flat number in a different
 * association simply does not exist.
 *
 * Writes are not here at all. See PROPOSABLE_ACTIONS: the model proposes, a
 * person confirms, and the server executes. A model turn never mutates.
 */

export interface ToolContext {
  userId:        string;
  associationId: string;
  role:          UserRole;
  /** Null for staff and managers who are not attached to a flat. */
  unitId:        string | null;
}

export interface ToolDef {
  name:        string;
  description: string;
  /** JSON Schema for the arguments. Identity fields are forbidden by design. */
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  roles:   UserRole[];
  handler: (ctx: ToolContext, args: Record<string, unknown>) => Promise<unknown>;
}

const COMMITTEE: UserRole[] = [
  UserRole.MANAGER, UserRole.COMMITTEE, UserRole.TREASURER, UserRole.SUPER_USER,
];
const EVERYONE: UserRole[] = [...COMMITTEE, UserRole.RESIDENT, UserRole.GATE_STAFF];

/**
 * A resident question that needs a flat must use the caller's own flat. This
 * throws rather than returning empty, because "you owe nothing" is a dangerous
 * answer to give someone whose account simply is not linked to a unit.
 */
function requireUnit(ctx: ToolContext): string {
  if (!ctx.unitId) {
    throw new Error(
      'Your account is not linked to a flat, so I cannot look up dues for you. ' +
      'Please ask your association manager to link it.',
    );
  }
  return ctx.unitId;
}

/** Trim tool output before it goes back to the model. Cost and noise. */
function cap<T>(rows: T[], n = 25): T[] {
  return rows.slice(0, n);
}

export const TOOLS: ToolDef[] = [

  // ── Who am I ──────────────────────────────────────────────────────────────
  {
    name: 'my_profile',
    description:
      'Who the signed-in person is: their name, flat number, block, whether '
      + 'they are the owner or a tenant, their role, and the association name. '
      + 'Use for "what is my flat number", "which apartment am I registered to", '
      + '"is my account linked to my flat". Call this before any other tool if '
      + 'the question is about identity rather than money.',
    input_schema: { type: 'object', properties: {} },
    roles: EVERYONE,
    handler: async (ctx) => {
      const user = await prisma.user.findFirst({
        where:  { id: ctx.userId, association_id: ctx.associationId },
        select: {
          name: true, phone: true, role: true, is_owner: true,
          unit: { select: { flat_number: true, block: true, floor: true } },
          association: { select: { name: true, city: true } },
        },
      });
      if (!user) throw new Error('I could not find your account.');

      return {
        name:         user.name,
        role:         user.role,
        association:  user.association?.name ?? null,
        city:         user.association?.city ?? null,
        // Null rather than absent, so the model has something concrete to
        // report. "Not linked to a flat" is a real answer a resident needs —
        // it is usually why their dues screen is empty.
        flat_number:  user.unit?.flat_number ?? null,
        block:        user.unit?.block ?? null,
        floor:        user.unit?.floor ?? null,
        relationship: user.unit ? (user.is_owner ? 'Owner' : 'Tenant') : null,
        linked_to_a_flat: !!user.unit,
      };
    },
  },

  // ── Using SmartAppt ───────────────────────────────────────────────────────
  {
    name: 'find_feature',
    description:
      'Where to do something in SmartAppt. Use for "how do I raise a complaint", '
      + '"where can I see my statement", "how do I pay", "where is the gate '
      + 'console". Returns the screens this person can actually open, with what '
      + 'each is for. ALWAYS use this rather than describing menus from memory — '
      + 'you have no other knowledge of this app and every association can '
      + 'configure its own menu.',
    input_schema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'What they are trying to do, in their words, e.g. "pay my bill", "complain about the lift".',
        },
      },
    },
    roles: EVERYONE,
    handler: async (ctx, args) => {
      // The association's own overrides, resolved for this role. A screen the
      // manager switched off does not get recommended, and a resident is never
      // sent somewhere they will be refused.
      const cfg = await prisma.mobileConfig.findUnique({
        where:  { association_id: ctx.associationId },
        select: { menu_items: true },
      });
      const resolved = resolveMenuForRole(
        ctx.role, (cfg?.menu_items ?? null) as RoleMenuOverrides | null,
      );

      const visible = resolved.filter(r => r.enabled);
      const term = String(args['task'] ?? '').toLowerCase().trim();

      const screens = visible.map(r => {
        const item  = MOBILE_MENU_BY_ID.get(r.id);
        const label = item?.label ?? r.id;
        return {
          screen:           label,
          // Actual directions rather than an internal group id. `group` on the
          // catalogue is 'community' | 'dues' | 'gate' and so on — useful for
          // organising code, meaningless to a person holding a phone.
          how_to_get_there: mobileDirectionsFor(r.id, label),
          what_it_is:       FEATURE_HELP[r.id] ?? null,
          can_create_here:  r.can_post,
        };
      });

      // Scored rather than filtered: a term matching nothing returns the whole
      // (short) list instead of "no results", so the answer is always at worst
      // "here is what you can open".
      const words = term.split(/\s+/).filter(w => w.length > 2);
      const hits = words.length
        ? screens.filter(s => {
            const hay = `${s.screen} ${s.what_it_is ?? ''}`.toLowerCase();
            return words.some(w => hay.includes(w));
          })
        : [];

      // Configuration lives on the web app, and the web catalogue is not
      // readable from the server, so it comes from a hand-maintained list.
      // Filtered by role, so a resident never learns these screens exist.
      // Told in menu wording, not as a URL. "Go to /admin/users" is correct and
      // useless — nobody navigates an app by typing a route. People look at the
      // left-hand menu, find a heading, and click an item under it.
      const admin = adminScreensFor(ctx.role).map(s => ({
        how_to_get_there: `Open the ${s.menu} menu in the left sidebar, then click ${s.label}`,
        menu:             s.menu,
        screen:           s.label,
        what_it_is:       s.what_it_is,
        // Secondary. Only worth mentioning if someone asks for a direct link.
        direct_link:      s.path,
      }));

      return {
        matching_screens: hits.length ? hits : null,
        all_screens_available_to_this_person: cap(screens, 30),
        admin_and_configuration_screens: admin.length ? admin : null,
        _note:
          'These are the only screens this person can open. Do not mention any other screen, '
          + 'menu or setting — if what they want is not here, say it is not available to them '
          + 'and suggest they ask their association manager. '
          + (admin.length
              ? 'The admin_and_configuration screens are on the WEB app, not the mobile app — say so when recommending one. '
                + 'Give directions using how_to_get_there, in menu wording. Do NOT tell anyone to visit a URL path '
                + 'unless they explicitly ask for a link; a route is not something a person navigates by.'
              : ''),
      };
    },
  },

  {
    name: 'how_it_works',
    description:
      'How some part of SmartAppt works — billing, payments, penalties, '
      + 'complaints, visitors, meetings, the accounts, configuration. Use for '
      + '"why is my payment still showing unpaid", "how does billing work", '
      + '"what happens when I raise a complaint", "how are penalties '
      + 'calculated". Answer from what this returns; you have no other source.',
    input_schema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The question, in the person\'s own words.' },
      },
      required: ['question'],
    },
    roles: EVERYONE,
    handler: async (ctx, args) => {
      const isOfficer = ctx.role !== UserRole.RESIDENT && ctx.role !== UserRole.GATE_STAFF;
      const found = searchKnowledge(String(args['question'] ?? ''), isOfficer);

      if (!found.length) {
        throw new Error(
          'I do not have anything written about that. Say so plainly and suggest the '
          + 'association manager — do not describe how you imagine it works.',
        );
      }
      return {
        sections: found.map(s => ({ title: s.title, explanation: s.body })),
        _note:
          'Answer from these sections. They describe HOW things work and deliberately contain '
          + 'no rates, grace periods, due dates or amounts, because those differ per '
          + 'association — call a data tool if the person needs an actual figure.',
      };
    },
  },

  {
    name: 'explain_term',
    description:
      'What a SmartAppt or association term means — levy, penalty, arrears, '
      + 'payment claim, statement of account, sub-ledger, trial balance. Quote '
      + 'the definition returned; do not write your own.',
    input_schema: {
      type: 'object',
      properties: {
        term: { type: 'string', description: 'The word or phrase to explain.' },
      },
      required: ['term'],
    },
    roles: EVERYONE,
    handler: async (ctx, args) => {
      const isOfficer = ctx.role !== UserRole.RESIDENT && ctx.role !== UserRole.GATE_STAFF;
      const found = lookupTerms(String(args['term'] ?? ''), isOfficer);

      if (!found.length) {
        throw new Error(
          `I do not have a definition for "${args['term']}". Say that plainly rather than guessing at one.`,
        );
      }
      return {
        definitions: found.map(f => ({ term: f.term, definition: f.definition })),
        _note: 'Quote these definitions. Do not extend them with rates, grace periods or due dates — those differ per association and are not in this data.',
      };
    },
  },

  // ── Resident, read ────────────────────────────────────────────────────────
  {
    name: 'my_dues_summary',
    description:
      'The current amount owed by the signed-in resident\'s own flat, with the '
      + 'breakdown of maintenance, levies and any late payment penalty. Use this '
      + 'for "what do I owe", "am I up to date", "how much is pending".',
    input_schema: { type: 'object', properties: {} },
    roles: EVERYONE,
    handler: async (ctx) => {
      const unitId = requireUnit(ctx);
      const st = await statementService.forUnit(ctx.associationId, unitId, {});
      return st;
    },
  },

  {
    name: 'my_statement',
    description:
      'The signed-in resident\'s own statement of account for a date range — '
      + 'every bill, payment and penalty in order, with a running balance. '
      + 'Dates are ISO (YYYY-MM-DD). Omit both for the current financial year.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Start date, YYYY-MM-DD.' },
        to:   { type: 'string', description: 'End date, YYYY-MM-DD.' },
      },
    },
    roles: EVERYONE,
    handler: async (ctx, args) => {
      const unitId = requireUnit(ctx);
      return statementService.forUnit(ctx.associationId, unitId, {
        from: args['from'] as string | undefined,
        to:   args['to'] as string | undefined,
      });
    },
  },

  {
    name: 'my_bills',
    description:
      'Recent bills raised on the signed-in resident\'s own flat, newest first. '
      + 'Use when someone asks which bills are open, or needs a bill reference '
      + 'before claiming a payment.',
    input_schema: { type: 'object', properties: {} },
    roles: EVERYONE,
    handler: async (ctx) => {
      const unitId = requireUnit(ctx);
      const res = await duesService.listMyBills(ctx.associationId, unitId, { limit: 12 });
      return res;
    },
  },

  {
    name: 'my_payment_claims',
    description:
      'Payments the signed-in resident has told the association about, and '
      + 'whether the treasurer has confirmed them yet. Use for "did my payment '
      + 'go through", "is my payment confirmed".',
    input_schema: { type: 'object', properties: {} },
    roles: EVERYONE,
    handler: async (ctx) => upiService.myClaims(ctx.associationId, ctx.unitId),
  },

  {
    name: 'my_tickets',
    description:
      'Maintenance complaints raised by the signed-in person, with current '
      + 'status. Use for "what happened to my complaint", "is my leak fixed".',
    input_schema: { type: 'object', properties: {} },
    roles: EVERYONE,
    handler: async (ctx) => {
      const res = await maintenanceService.listTickets(ctx.associationId, {
        limit: 15,
        // Scoped by the caller's own id, never by an argument.
        raised_by: ctx.userId,
      });
      return res;
    },
  },

  {
    name: 'my_visitors',
    description:
      'Visitor requests and pre-approvals for the signed-in resident\'s flat, '
      + 'including anyone waiting at the gate for approval right now.',
    input_schema: { type: 'object', properties: {} },
    roles: EVERYONE,
    handler: async (ctx) => visitorsService.getMyVisitorRequests(ctx.associationId, ctx.userId),
  },

  // ── Committee, treasurer and manager, read ────────────────────────────────
  {
    name: 'collection_summary',
    description:
      'Association-wide dues position as at a date: total billed, collected and '
      + 'outstanding. Use for "how much have we collected", "what is our '
      + 'collection percentage". Committee and above only.',
    input_schema: {
      type: 'object',
      properties: {
        as_of: { type: 'string', description: 'As-at date, YYYY-MM-DD. Defaults to today.' },
      },
    },
    roles: COMMITTEE,
    handler: async (ctx, args) =>
      statementService.summary(ctx.associationId, args['as_of'] as string | undefined),
  },

  {
    name: 'arrears_list',
    description:
      'Flats with money outstanding, largest first. Use for "who has not paid", '
      + '"list the defaulters", "who is overdue". Committee and above only.',
    input_schema: { type: 'object', properties: {} },
    roles: COMMITTEE,
    handler: async (ctx) => {
      const res = await duesService.getArrears(ctx.associationId);
      const rows = (res as { data?: unknown[] })?.data;
      return Array.isArray(rows) ? { data: cap(rows, 30) } : res;
    },
  },

  {
    name: 'dues_dashboard',
    description:
      'Headline DUES figures for the association — this month\'s billing, '
      + 'receipts and pending amounts. Contains no cash or bank position: for '
      + 'those use ledger_balance. Committee and above only.',
    input_schema: { type: 'object', properties: {} },
    roles: COMMITTEE,
    handler: async (ctx) => {
      const res = await duesService.getDashboard(ctx.associationId);
      const d = (res as { data?: Record<string, unknown> }).data ?? {};

      // `cash_balance` and `month_opening_balance` are stripped rather than
      // renamed, and this is deliberate.
      //
      // Both are OPENING balances. `cash_balance` is the figure a treasurer
      // typed into Dues Config as the starting cash position on a given date;
      // it does not move as money comes in. The name reads like a current
      // balance, and the assistant duly reported "Cash Balance: Rs. 100,280.00
      // as of 1 June 2026" as though it were today's cash — the date was even
      // correct, which made it more convincing and no less wrong.
      //
      // Renaming them would leave the same trap for the next reader. The live
      // cash position is in the ledger, so the model is sent there instead.
      const {
        cash_balance: _cb,
        cash_balance_as_on: _cbAsOn,
        month_opening_balance: _mob,
        ytd_trend: _ytd,
        ...duesOnly
      } = d;

      // `ytd_trend` is dropped too, and for a sharper reason than the opening
      // balances: the name is simply false. The query behind it is
      // `payment_date > NOW() - INTERVAL '12 months'` — a rolling twelve
      // months, not year to date — and it is a per-month series with no total.
      //
      // The model is told never to do arithmetic on money, correctly. So when
      // asked for year-to-date collection it did the only thing left open to
      // it: quoted one month's figure under a YTD heading. Rs. 30,000 where the
      // answer was Rs. 90,000.
      //
      // The fix is to compute the total here rather than hope the model adds
      // three numbers correctly. It is one query, and it is right every time.
      const cfg = await prisma.associationConfig.findUnique({
        where:  { association_id: ctx.associationId },
        select: { financial_year_start_month: true },
      });
      const fyStartMonth = cfg?.financial_year_start_month ?? 4;   // April, Indian FY

      const now = new Date();
      // If today is before the FY start month, the year began last calendar
      // year. In April–March terms: February 2027 belongs to FY starting
      // April 2026.
      const fyStartYear = (now.getMonth() + 1) >= fyStartMonth
        ? now.getFullYear()
        : now.getFullYear() - 1;
      const fyStart = new Date(Date.UTC(fyStartYear, fyStartMonth - 1, 1));

      const [billing, other] = await Promise.all([
        prisma.payment.aggregate({
          where: { association_id: ctx.associationId, payment_date: { gte: fyStart } },
          _sum:  { amount: true },
        }),
        prisma.otherReceipt.aggregate({
          where: {
            association_id: ctx.associationId, deleted_at: null,
            receipt_date: { gte: fyStart },
          },
          _sum: { amount: true },
        }),
      ]);

      const duesCollected  = Number(billing._sum.amount ?? 0);
      const otherCollected = Number(other._sum.amount ?? 0);

      return {
        ...duesOnly,
        financial_year_start: fyStart.toISOString().slice(0, 10),
        // Split as well as totalled, so "collection this year" and "dues
        // collected this year" are both answerable without adding anything.
        ytd_dues_collected:   duesCollected,
        ytd_other_receipts:   otherCollected,
        ytd_total_collected:  Math.round((duesCollected + otherCollected) * 100) / 100,
        _note:
          'ytd_* figures are totals for the financial year to date, already summed — quote them directly. '
          + 'There is no cash or bank balance here; call ledger_balance for the live position.',
      };
    },
  },

  {
    name: 'pending_payment_claims',
    description:
      'Payments residents say they have made that nobody has confirmed yet. '
      + 'Use for "what is waiting for me to confirm". Committee and above only.',
    input_schema: { type: 'object', properties: {} },
    roles: COMMITTEE,
    handler: async (ctx) => upiService.pending(ctx.associationId),
  },

  {
    name: 'tickets_dashboard',
    description:
      'Maintenance complaints across the association by status and category, '
      + 'including how long open ones have been waiting. Committee and above only.',
    input_schema: { type: 'object', properties: {} },
    roles: COMMITTEE,
    handler: async (ctx) => maintenanceService.getDashboard(ctx.associationId),
  },

  // ── Ledger ────────────────────────────────────────────────────────────────
  //
  // A deliberate reversal. The first version of this file had no accounting
  // tools, on the grounds that a plausible paraphrase of a statutory report is
  // worse than no answer. That reasoning holds for the Balance Sheet and the
  // Income & Expenditure account, which are arguments about presentation as
  // much as arithmetic — and it does NOT hold for a single account balance,
  // which is one number the trial balance already computes.
  //
  // So: balances yes, statements no. The line is between quoting a figure and
  // narrating a report.
  {
    name: 'ledger_balance',
    description:
      'The current balance of a ledger account — bank, cash, a specific income '
      + 'or expense head, or any account in the chart. Search by name or code, '
      + 'e.g. "bank", "4008", "maintenance income". Returns every account that '
      + 'matches with its balance, so an ambiguous name lists the candidates '
      + 'rather than guessing. Treasurer, committee and manager only.',
    input_schema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Part of the account name or its code. Omit to list all accounts with a non-zero balance.',
        },
        as_of: { type: 'string', description: 'As-at date, YYYY-MM-DD. Defaults to today.' },
      },
    },
    roles: COMMITTEE,
    handler: async (ctx, args) => {
      // The assistant runs behind the ASSISTANT module, not ACCOUNTING. Without
      // this check, an association could buy the cheap module and read its
      // ledger through the chatbot — the subscription boundary has to hold
      // whichever door the data comes out of.
      const access = await entitlementService.accessFor(ctx.associationId, ModuleKey.ACCOUNTING, ctx.role);
      if (access === 'NONE') {
        throw new Error('This association does not have the Accounting module, so I cannot see the ledger.');
      }

      const asOf = (args['as_of'] as string | undefined) ?? new Date().toISOString().slice(0, 10);
      const tb   = await journalService.getTrialBalance(ctx.associationId, { asOf });

      // Note the `.data` — getTrialBalance wraps its payload the way the
      // controllers expect. Reading `tb.accounts` compiles happily against a
      // loose cast and yields an empty list at runtime, which would have shown
      // up as "no account has a balance yet" on a ledger full of money.
      const accounts = (tb as { data?: { accounts?: Array<{
        code: string; name: string; type: string; sub_type: string | null;
        debitBalance: number; creditBalance: number;
      }> } }).data?.accounts ?? [];

      const term = String(args['search'] ?? '').trim().toLowerCase();
      const matches = accounts.filter(a => {
        const nonZero = a.debitBalance !== 0 || a.creditBalance !== 0;
        if (!term) return nonZero;
        return a.code.toLowerCase().includes(term) || a.name.toLowerCase().includes(term);
      });

      if (!matches.length) {
        throw new Error(
          term
            ? `No account matches "${args['search']}". Ask me to list the accounts if you are not sure of the name.`
            : 'No account has a balance yet.',
        );
      }

      return {
        as_of: asOf,
        // Debit and credit are kept separate rather than netted into one
        // signed number. A treasurer reads "credit balance 45,000" on a
        // liability correctly; a "-45,000" invites the model to describe it
        // as negative, which for a liability is the opposite of the truth.
        accounts: cap(matches, 20).map(a => ({
          code: a.code,
          name: a.name,
          type: a.type,
          sub_type: a.sub_type,
          debit_balance:  a.debitBalance,
          credit_balance: a.creditBalance,
        })),
        truncated: matches.length > 20 ? matches.length - 20 : 0,
      };
    },
  },

  {
    name: 'unit_statement',
    description:
      'The statement of account for a named flat in this association. Use when '
      + 'a committee member asks about a specific flat, e.g. "what does A-101 '
      + 'owe". Committee and above only.',
    input_schema: {
      type: 'object',
      properties: {
        flat_number: { type: 'string', description: 'The flat number, e.g. "A-101".' },
        from:        { type: 'string', description: 'Start date, YYYY-MM-DD.' },
        to:          { type: 'string', description: 'End date, YYYY-MM-DD.' },
      },
      required: ['flat_number'],
    },
    roles: COMMITTEE,
    handler: async (ctx, args) => {
      const flat = String(args['flat_number'] ?? '').trim();
      if (!flat) throw new Error('Which flat number?');

      // Resolved inside the caller's association. A flat number that exists in
      // a different association is simply not found — the association_id here
      // comes from the JWT and can never come from the model.
      const unit = await prisma.unit.findFirst({
        where:  {
          association_id: ctx.associationId,
          flat_number:    { equals: flat, mode: 'insensitive' },
          deleted_at:     null,
        },
        select: { id: true, flat_number: true },
      });
      if (!unit) throw new Error(`There is no flat "${flat}" in this association.`);

      const st = await statementService.forUnit(ctx.associationId, unit.id, {
        from: args['from'] as string | undefined,
        to:   args['to'] as string | undefined,
      });
      return { flat_number: unit.flat_number, ...(st as object) };
    },
  },
];

/**
 * The tools this caller may use.
 *
 * Called before the request reaches the model, so the model's own view of what
 * is possible is already narrowed to what this person may do. Filtering the
 * response instead would mean the model had already seen the data.
 */
export function toolsForRole(role: UserRole): ToolDef[] {
  return TOOLS.filter(t => t.roles.includes(role));
}

export function findTool(name: string, role: UserRole): ToolDef | undefined {
  // Role is re-checked here as well as at catalogue time. Belt and braces: a
  // future streaming path might reuse this without going through toolsForRole.
  return TOOLS.find(t => t.name === name && t.roles.includes(role));
}

// ── Actions the model may PROPOSE, and a person must confirm ────────────────

export interface ActionDef {
  name:        string;
  description: string;
  input_schema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
  roles:       UserRole[];
  /** One line shown on the confirmation card. Must state exactly what happens. */
  summarise:   (args: Record<string, unknown>) => string;
  execute:     (ctx: ToolContext, args: Record<string, unknown>) => Promise<unknown>;
}

export const ACTIONS: ActionDef[] = [
  {
    name: 'raise_ticket',
    description:
      'Propose raising a maintenance complaint for the signed-in resident. Does '
      + 'NOT create it — the person is shown a summary and must confirm.',
    input_schema: {
      type: 'object',
      properties: {
        title:       { type: 'string', description: 'Short title, e.g. "Lift stuck on 3rd floor".' },
        description: { type: 'string', description: 'What is wrong, in the resident\'s own words.' },
        category:    {
          type: 'string',
          enum: ['PLUMBING', 'ELECTRICAL', 'LIFT', 'HOUSEKEEPING', 'SECURITY', 'COMMON_AREA', 'OTHER'],
        },
        priority:    { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
      },
      required: ['title', 'description', 'category'],
    },
    roles: EVERYONE,
    summarise: (a) => `Raise a ${String(a['category']).toLowerCase()} complaint: "${a['title']}"`,
    execute: async (ctx, a) =>
      maintenanceService.createTicket(
        ctx.associationId, ctx.userId, ctx.unitId,
        {
          title:       String(a['title']),
          description: String(a['description']),
          category:    a['category'],
          priority:    a['priority'] ?? 'MEDIUM',
        } as never,
        [],
      ),
  },

  {
    name: 'preapprove_visitor',
    description:
      'Propose pre-approving a visitor for the signed-in resident\'s flat. Does '
      + 'NOT create it — the person must confirm first.',
    input_schema: {
      type: 'object',
      properties: {
        name:        { type: 'string' },
        phone:       { type: 'string' },
        expected_at: { type: 'string', description: 'ISO datetime the visitor is expected.' },
        purpose:     { type: 'string' },
      },
      required: ['name', 'expected_at'],
    },
    roles: [UserRole.RESIDENT, ...COMMITTEE],
    summarise: (a) => `Pre-approve ${a['name']} to visit on ${a['expected_at']}`,
    execute: async (ctx, a) =>
      visitorsService.preApprove(ctx.associationId, ctx.userId, requireUnit(ctx), {
        name:        String(a['name']),
        phone:       a['phone'] ? String(a['phone']) : undefined,
        expected_at: String(a['expected_at']),
        purpose:     a['purpose'] ? String(a['purpose']) : undefined,
      }),
  },

  {
    name: 'claim_payment',
    description:
      'Propose telling the association that the resident has paid a bill. Does '
      + 'NOT record it — the person confirms, and a treasurer must then verify '
      + 'the payment before it reaches the ledger. Get bill_id from my_bills.',
    input_schema: {
      type: 'object',
      properties: {
        bill_id:       { type: 'string', description: 'From my_bills. Never guess this.' },
        amount:        { type: 'number' },
        upi_reference: { type: 'string', description: 'The reference from their payment app, usually 12 digits.' },
        paid_on:       { type: 'string', description: 'YYYY-MM-DD.' },
      },
      required: ['bill_id', 'amount', 'upi_reference'],
    },
    roles: EVERYONE,
    summarise: (a) =>
      `Tell the association you paid Rs. ${a['amount']} with reference ${a['upi_reference']}`,
    execute: async (ctx, a) =>
      upiService.claim(ctx.associationId, ctx.userId, ctx.role, {
        bill_id:       String(a['bill_id']),
        amount:        Number(a['amount']),
        upi_reference: String(a['upi_reference']),
        paid_on:       a['paid_on'] ? String(a['paid_on']) : undefined,
      }),
  },
];

export function actionsForRole(role: UserRole): ActionDef[] {
  return ACTIONS.filter(a => a.roles.includes(role));
}

export function findAction(name: string, role: UserRole): ActionDef | undefined {
  return ACTIONS.find(a => a.name === name && a.roles.includes(role));
}
