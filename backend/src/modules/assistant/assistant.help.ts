/**
 * What the assistant knows about SmartAppt itself.
 *
 * The model has no knowledge of this product — it was never trained on it, and
 * nothing in the tools describes it. Left to itself it will either refuse, or
 * invent a plausible menu path. An invented "Settings → Payments" is the same
 * failure as an invented balance; it is just harder to notice, because nobody
 * checks a navigation instruction against a ledger.
 *
 * So both halves of this file are grounded rather than generated:
 *
 *   NAVIGATION comes from MOBILE_MENU, resolved for the caller's role and
 *   their association's overrides. It is the same catalogue the app renders
 *   from, so it cannot describe a screen that does not exist, and it will not
 *   send a resident to something their role cannot open. Rename a menu item
 *   and this follows automatically.
 *
 *   TERMS are hand-written below. They are the words residents will be told,
 *   so they are meant to be read and corrected by a person — not paraphrased
 *   by a model that has only seen the schema.
 */

/**
 * Plain descriptions of what each screen is for, keyed by MOBILE_MENU id.
 *
 * The catalogue supplies the label; this supplies the purpose. A label alone
 * ("Transparency") does not tell anyone what they will find there, and a model
 * asked to guess will make something up.
 *
 * An id with no entry here still works — it is reported by label and group,
 * just without the sentence. Missing text degrades to less help, never to
 * wrong help.
 */
export const FEATURE_HELP: Record<string, string> = {
  // Resident, money
  dues_my_bills:
    'Your own bills — what has been raised on your flat, what is paid, what is open.',
  dues_my_statement:
    'Your statement of account: every bill, payment and penalty in date order with a running balance. This is the one to open when you disagree with a figure.',
  dues_pay_upi:
    'Pay a bill by UPI. Shows a QR code to scan with any UPI app, and afterwards lets you enter the reference number so the treasurer can confirm it.',

  // Resident, community
  announcements_feed:  'Notices from the committee.',
  announcements_docs:  'Shared documents — bye-laws, circulars, minutes.',
  maintenance_list:    'Complaints and service requests, with their current status.',
  maintenance_new:     'Raise a new complaint or service request.',
  expenses_transparency:
    'What the association has spent, published for residents to see.',

  // Visitors and gate
  visitors_preapprove:
    'Tell the gate in advance that someone is coming. Generates a QR code the visitor can show.',
  visitors_approvals:
    'Approve or decline visitors the gate has asked you about.',
  gate_console:
    'The gate staff screen: log visitors in and out, record deliveries, look up a flat.',

  // Officers, dues
  dues_bills:      'Every bill in the association, and where bill runs are generated.',
  dues_arrears:    'Flats with money outstanding, largest first.',
  dues_statement:  'Statement of account for any flat.',
};

/**
 * Configuration and administration screens, which live on the WEB app only.
 *
 * This list is hand-maintained, and that is a compromise worth naming. The web
 * catalogue (NAV_GROUPS) lives in the frontend — `system.service.ts` says so
 * outright: "the frontend owns the catalogue" — so the server cannot read it
 * the way find_feature reads MOBILE_MENU. Duplicating it here means it can
 * drift.
 *
 * The alternative was worse. Without this, a manager asking "help me configure
 * my association" got told configuration is "beyond what I can help with",
 * which is both unhelpful and untrue — they administer the thing.
 *
 * Two things keep the drift survivable: it covers only configuration screens,
 * which change rarely, and every entry carries its own role list, so a wrong
 * entry shows the wrong person a real screen rather than sending anyone to a
 * page that does not exist.
 *
 * IF YOU MOVE OR RENAME AN ADMIN SCREEN, UPDATE IT HERE.
 */
export interface AdminScreen {
  label:  string;
  path:   string;
  roles:  string[];
  what_it_is: string;
}

const MANAGER = ['SUPER_USER', 'MANAGER'];
const TREASURY = ['SUPER_USER', 'TREASURER'];

export const WEB_ADMIN_SCREENS: AdminScreen[] = [
  {
    label: 'Manage Users', path: '/admin/users', roles: MANAGER,
    what_it_is: 'Add residents, set their role, link them to a flat, deactivate someone who has moved out.',
  },
  {
    label: 'Manage Units', path: '/admin/units', roles: MANAGER,
    what_it_is: 'The list of flats — add or edit flat numbers, blocks, floors and area.',
  },
  {
    label: 'Web Menu by Role', path: '/admin/web-menu', roles: MANAGER,
    what_it_is: 'Choose which menu items each role sees on the web app.',
  },
  {
    label: 'Mobile Menu by Role', path: '/admin/mobile-menu', roles: MANAGER,
    what_it_is: 'Choose which screens each role sees in the mobile app, and which they can post from.',
  },
  {
    label: 'Audit Trail', path: '/admin/audit-log', roles: MANAGER,
    what_it_is: 'Who changed what, and when.',
  },
  {
    label: 'Fee Configuration', path: '/dues/config', roles: TREASURY,
    what_it_is: 'How maintenance is calculated, the billing cycle, due dates, and the opening cash balance.',
  },
  {
    label: 'Late Payment Penalty', path: '/dues/penalties', roles: [...TREASURY, 'MANAGER'],
    what_it_is: 'The penalty rate and grace period, and where a penalty run is applied or reversed.',
  },
  {
    label: 'UPI Payments', path: '/dues/upi-claims', roles: [...TREASURY, 'MANAGER'],
    what_it_is: 'Payments residents have reported, waiting to be confirmed against the bank statement. Also where the collection bank account and its UPI ID are set.',
  },
  {
    label: 'Chart of Accounts', path: '/accounting/chart-of-accounts', roles: [...MANAGER, 'TREASURER'],
    what_it_is: 'The ledger account structure — income heads, expense heads, assets and liabilities.',
  },
  {
    label: 'Business Partners', path: '/accounting/business-partners', roles: [...MANAGER, 'TREASURER'],
    what_it_is: 'Banks, vendors and per-flat sub-ledger accounts.',
  },
  {
    label: 'FY Closure', path: '/accounting/fy-closure', roles: [...MANAGER, 'TREASURER'],
    what_it_is: 'Set which month the financial year starts, and close a year once its accounts are final.',
  },
  {
    label: 'Subscriptions', path: '/admin/subscriptions', roles: ['SUPER_USER'],
    what_it_is: 'Which modules each association may use.',
  },
];

export function adminScreensFor(role: string): AdminScreen[] {
  return WEB_ADMIN_SCREENS.filter(s => s.roles.includes(role));
}

export interface GlossaryEntry {
  term:       string;
  /** Other ways people ask for the same thing. Matched case-insensitively. */
  aliases:    string[];
  definition: string;
  /** Roles it is worth explaining to. Omit for everyone. */
  officersOnly?: boolean;
}

/**
 * SmartAppt's own vocabulary.
 *
 * REVIEW THIS TEXT. Every sentence here is something a resident will be told
 * verbatim when they ask. It is deliberately short and deliberately hand-
 * written: a model asked to define "levy" from context would produce something
 * that sounds right and may not match how this association actually uses the
 * word.
 *
 * Nothing here states a policy figure — no grace periods, no rates, no due
 * dates. Those vary per association and live in configuration; putting one in
 * this file would make it wrong for everyone else.
 */
export const GLOSSARY: GlossaryEntry[] = [
  {
    term: 'Maintenance',
    aliases: ['maintenance charge', 'monthly maintenance', 'maintenance fee'],
    definition:
      'The regular charge raised on every flat to run the building — security, '
      + 'housekeeping, lifts, common electricity and so on. Usually monthly, and '
      + 'the amount depends on your association\'s rules.',
  },
  {
    term: 'Levy',
    aliases: ['special levy', 'one-time levy', 'special charge'],
    definition:
      'A one-off charge on top of regular maintenance, raised for something '
      + 'specific — painting the building, replacing a lift, a legal cost. It is '
      + 'shown as its own line on your bill so it is never mistaken for '
      + 'maintenance.',
  },
  {
    term: 'Late payment penalty',
    aliases: ['penalty', 'late fee', 'interest', 'fine'],
    definition:
      'A charge added when a bill stays unpaid past its due date. Your '
      + 'association sets the rate and how many days of grace come first. It is '
      + 'calculated on the bill it belongs to, not on your whole outstanding '
      + 'balance, so it does not compound.',
  },
  {
    term: 'Arrears',
    aliases: ['outstanding', 'overdue', 'dues pending', 'defaulter'],
    definition:
      'Money billed that has not been paid. A flat "in arrears" has at least one '
      + 'bill past its due date.',
  },
  {
    term: 'Statement of account',
    aliases: ['soa', 'statement', 'ledger', 'account statement'],
    definition:
      'A dated list of everything charged to your flat and everything you have '
      + 'paid, in order, with the balance after each line. It is the record to '
      + 'check when a figure looks wrong.',
  },
  {
    term: 'Payment claim',
    aliases: ['claim', 'reported payment', 'payment confirmation', 'utr'],
    definition:
      'When you pay by UPI, the association does not see it automatically. You '
      + 'enter the reference number your payment app gave you, and the treasurer '
      + 'matches it against the bank statement and confirms it. Until they '
      + 'confirm, the bill still shows as unpaid — that is expected, not an error.',
  },
  {
    term: 'UPI reference number',
    aliases: ['utr', 'reference number', 'transaction id', 'upi ref'],
    definition:
      'The 12-digit number your UPI app shows after a payment succeeds. It is '
      + 'how the treasurer finds your payment in the bank statement, so it must '
      + 'be entered exactly.',
  },
  {
    term: 'One-time due',
    aliases: ['one time due', 'ad hoc charge'],
    definition:
      'A charge raised once on selected flats rather than on everyone every '
      + 'month — a fine, a facility booking, a share of a repair.',
  },
  {
    term: 'Financial year',
    aliases: ['fy', 'accounting year'],
    definition:
      'The association\'s accounting year. In India this normally runs April to '
      + 'March, so "this financial year" means since the previous April.',
  },
  {
    term: 'Opening balance',
    aliases: ['opening', 'brought forward'],
    definition:
      'What a balance stood at when a period began — not what it is now. An '
      + 'opening cash balance dated 1 April does not move as money comes in '
      + 'during the year.',
  },
  {
    term: 'Sub-ledger',
    aliases: ['unit sub ledger', 'sub ledger card', 'business partner'],
    definition:
      'The per-flat account behind the association ledger. Every flat has one, '
      + 'so the total owed by all flats can be reconciled against the control '
      + 'account in the books.',
    officersOnly: true,
  },
  {
    term: 'Trial balance',
    aliases: ['tb'],
    definition:
      'A list of every ledger account with its balance, debits on one side and '
      + 'credits on the other. The two sides must agree; if they do not, an '
      + 'entry is wrong somewhere.',
    officersOnly: true,
  },
  {
    term: 'Receipts and payments',
    aliases: ['r&p', 'receipts & payments'],
    definition:
      'A summary of cash actually in and out over a period. It will not agree '
      + 'with Income & Expenditure, and should not: a bill raised but unpaid is '
      + 'income with no receipt.',
    officersOnly: true,
  },
  {
    term: 'Income and expenditure',
    aliases: ['i&e', 'income & expenditure', 'surplus', 'deficit'],
    definition:
      'What was earned and incurred over a period, whether or not the money '
      + 'moved. The difference is a surplus or a deficit rather than a profit or '
      + 'a loss, because an association is not trading.',
    officersOnly: true,
  },
];

/**
 * Find glossary entries matching a phrase.
 *
 * Substring matching in both directions, so "what is a late fee" finds the
 * penalty entry and "penalty" finds it too. Returns everything that matches
 * rather than a best guess — an ambiguous question is better answered with two
 * short definitions than one confident wrong one.
 */
export function lookupTerms(query: string, includeOfficerTerms: boolean): GlossaryEntry[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const pool = GLOSSARY.filter(e => includeOfficerTerms || !e.officersOnly);

  return pool.filter(e => {
    const names = [e.term, ...e.aliases].map(n => n.toLowerCase());
    return names.some(n => n.includes(q) || q.includes(n));
  });
}
