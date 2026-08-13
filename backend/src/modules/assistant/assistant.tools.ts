import { UserRole } from '@prisma/client';
import prisma from '../../config/database';
import { statementService } from '../dues/statement.service';
import { duesService } from '../dues/dues.service';
import { upiService } from '../dues/upi.service';
import { maintenanceService } from '../maintenance/maintenance.service';
import { visitorsService } from '../visitors/visitors.service';

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
      'Headline dues figures for the association — this month\'s billing, '
      + 'receipts and pending amounts. Committee and above only.',
    input_schema: { type: 'object', properties: {} },
    roles: COMMITTEE,
    handler: async (ctx) => duesService.getDashboard(ctx.associationId),
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
