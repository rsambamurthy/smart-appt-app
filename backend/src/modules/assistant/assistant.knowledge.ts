/**
 * What Phoebe knows about how SmartAppt works.
 *
 * WHY THIS IS A FILE AND NOT TRAINING.
 *
 * The model cannot be taught SmartAppt. There is no fine-tuning step in this
 * integration, and fine-tuning would be the wrong tool even if there were: it
 * shapes tone far more reliably than fact, and a fine-tuned model still invents
 * confident detail. Every wrong answer this assistant has produced so far came
 * from filling a gap with something plausible. Adding a mechanism that makes it
 * MORE fluent about SmartAppt without making it more correct would make that
 * worse, not better.
 *
 * So knowledge is retrieved and quoted rather than learned. Phoebe searches
 * these sections, receives the matching text, and answers from it. If nothing
 * matches, she says she does not know — which is the behaviour worth
 * protecting.
 *
 * HOW TO MAINTAIN IT.
 *
 * This is documentation that happens to be typed by a machine. It carries the
 * same risk as any documentation: it goes stale silently. Two rules keep it
 * honest.
 *
 *   1. NO CONFIGURABLE FIGURES. No penalty rates, no grace periods, no due
 *      dates, no amounts. Those live in each association's configuration and
 *      differ between them; a number written here would be right for one
 *      association and wrong for every other. Describe the mechanism, and let
 *      the tools supply the figures.
 *
 *   2. DESCRIBE BEHAVIOUR, NOT LAYOUT. "Payments must be confirmed before they
 *      reach the ledger" stays true through a redesign. "Click the green button
 *      at the top right" does not.
 *
 * Sections marked `officersOnly` are never searched for a resident or gate
 * staff, so a resident cannot learn how penalty runs work by asking.
 */

export interface KnowledgeSection {
  id:      string;
  title:   string;
  /** Words a person might use. Matched loosely against the question. */
  tags:    string[];
  body:    string;
  officersOnly?: boolean;
}

export const KNOWLEDGE: KnowledgeSection[] = [

  // ── The product ───────────────────────────────────────────────────────────
  {
    id: 'overview',
    title: 'What SmartAppt does',
    tags: ['smartappt', 'what is this', 'app', 'system', 'overview', 'about'],
    body:
      'SmartAppt is software for running an apartment owners\' association. It covers '
      + 'maintenance billing and collection, association accounts, complaints and service '
      + 'requests, visitors and gate security, announcements and documents, and formal '
      + 'governance such as meetings and elections. There is a web app used mostly by the '
      + 'committee and office bearers, and a mobile app used mostly by residents and gate '
      + 'staff. Both work on the same data.',
  },
  {
    id: 'roles',
    title: 'Roles and what they mean',
    tags: ['role', 'roles', 'permission', 'access', 'resident', 'committee', 'treasurer', 'manager', 'gate staff'],
    body:
      'Every person has one role, and it decides what they can see and do.\n'
      + 'Resident — sees their own flat: bills, statement, payments, their complaints, their visitors.\n'
      + 'Committee — sees the association as a whole: arrears, collections, meetings, complaints across all flats.\n'
      + 'Treasurer — a committee member who also works with money: billing runs, confirming payments, the accounts.\n'
      + 'Manager — administers the association: users, flats, menus, configuration.\n'
      + 'Gate staff — the gate console only: visitor entry and exit, deliveries, flat lookup.\n'
      + 'Super user — the SmartAppt operator, across all associations.\n'
      + 'A role is changed by a manager under Manage Users.',
  },

  // ── Dues and billing ──────────────────────────────────────────────────────
  {
    id: 'billing',
    title: 'How bills are raised',
    tags: ['bill', 'billing', 'maintenance', 'invoice', 'raise bills', 'bill run', 'monthly'],
    body:
      'Maintenance bills are generated for a billing period — normally a month — in a run '
      + 'that covers every active flat at once, rather than one flat at a time. How the '
      + 'amount is worked out (a flat rate, or by area) and when it falls due are set in Fee '
      + 'Configuration by the treasurer. A run can be rolled back if it was generated in '
      + 'error, provided nothing has been paid against it.\n'
      + 'A bill carries a posting date, which is the start of the period it belongs to, and '
      + 'a due date, which is later. The statement shows bills by posting date — that is why '
      + 'a bill appears on the statement before its due date has arrived.',
  },
  {
    id: 'one_time_dues',
    title: 'Levies and one-time dues',
    tags: ['levy', 'one time due', 'special charge', 'extra charge', 'ad hoc'],
    body:
      'Besides regular maintenance, an association can raise a levy — a one-off charge for '
      + 'something specific such as painting or a lift replacement — either on everyone or '
      + 'on selected flats. It appears as its own line on the bill and on the statement, so '
      + 'it is never confused with maintenance. Levies are created by the treasurer.',
  },
  {
    id: 'paying',
    title: 'How a resident pays',
    tags: ['pay', 'payment', 'upi', 'qr', 'how do i pay', 'paytm', 'phonepe', 'gpay', 'razorpay'],
    body:
      'The main route is UPI. The app shows a QR code carrying the association\'s UPI ID and '
      + 'the exact amount; the resident scans it with any UPI app and pays.\n'
      + 'The payment does NOT reach SmartAppt automatically. UPI money arrives in the '
      + 'association\'s bank account with no message back to the app. So after paying, the '
      + 'resident enters the reference number their payment app showed them, and the '
      + 'treasurer matches it against the bank statement and confirms it.\n'
      + 'Until it is confirmed the bill still reads as unpaid. That is expected and not a '
      + 'fault. A resident can also pay by cash, cheque or bank transfer, and the treasurer '
      + 'records it directly.',
  },
  {
    id: 'payment_claims',
    title: 'Reporting a payment, and what happens next',
    tags: ['claim', 'reference number', 'utr', 'confirm payment', 'payment pending', 'not showing'],
    body:
      'Telling the association about a payment is called a claim. The resident gives the '
      + 'amount and the UPI reference number, usually 12 digits, exactly as their payment app '
      + 'showed it — the treasurer uses it to find the credit in the bank statement.\n'
      + 'A claim is pending until reviewed. If confirmed, the payment is recorded and the '
      + 'bill updated. If it cannot be matched it is rejected with a reason, and the resident '
      + 'can correct the reference and claim again. A rejection is usually a mistyped '
      + 'reference, not an accusation.\n'
      + 'Part payments are allowed: the claimed amount can be less than the bill.',
  },
  {
    id: 'penalties',
    title: 'Late payment penalties',
    tags: ['penalty', 'late fee', 'fine', 'interest', 'overdue charge', 'grace'],
    body:
      'A bill unpaid past its due date can attract a penalty. Each association sets its own '
      + 'rate and its own grace period, so the figures differ — ask the tools for the actual '
      + 'amount rather than assuming one.\n'
      + 'A penalty is calculated on the bill it belongs to, not on the flat\'s whole '
      + 'outstanding balance, so it does not compound. It appears as its own dated line on '
      + 'the statement. A penalty can be waived by the treasurer, which reverses it in the '
      + 'accounts as well as on the bill.',
  },
  {
    id: 'statement',
    title: 'The statement of account',
    tags: ['statement', 'soa', 'ledger', 'history', 'running balance', 'transactions'],
    body:
      'The statement lists everything charged to a flat and everything paid, in date order, '
      + 'with the balance after each line. Bills are dated by their posting date, payments by '
      + 'the date they were received, penalties by the date they were applied.\n'
      + 'It is the record to check when a figure is disputed, because it shows how the '
      + 'balance was arrived at rather than just the total. Residents see their own; the '
      + 'committee can see any flat\'s.',
  },
  {
    id: 'arrears',
    title: 'Arrears and collection',
    tags: ['arrears', 'outstanding', 'defaulter', 'who has not paid', 'collection', 'overdue'],
    body:
      'Arrears are amounts billed and not paid. A flat is in arrears once a bill passes its '
      + 'due date unpaid. The committee can see the arrears list, largest first, and the '
      + 'collection position for the association. Residents see only their own position.\n'
      + 'Collected figures count money actually received. Billed figures count what was '
      + 'raised whether or not it was paid, which is why the two rarely agree.',
  },

  // ── Complaints ────────────────────────────────────────────────────────────
  {
    id: 'complaints',
    title: 'Complaints and service requests',
    tags: ['complaint', 'ticket', 'service request', 'repair', 'leak', 'lift', 'maintenance issue'],
    body:
      'A resident raises a complaint with a category — plumbing, electrical, lift, '
      + 'housekeeping, security, common area or other — a title and a description, and may '
      + 'attach a photo. It is then assigned to someone, worked on, and closed. The resident '
      + 'can follow the status throughout and give feedback once it is resolved. Committee '
      + 'members see every complaint; a resident sees their own.',
  },

  // ── Visitors ──────────────────────────────────────────────────────────────
  {
    id: 'visitors',
    title: 'Visitors, gate and deliveries',
    tags: ['visitor', 'guest', 'gate', 'security', 'delivery', 'courier', 'pre approve', 'qr'],
    body:
      'A resident can pre-approve a visitor in advance, which produces a QR code the visitor '
      + 'shows at the gate for a quick entry. Otherwise the gate logs a walk-in and asks the '
      + 'flat to approve or decline, and the resident answers from the app.\n'
      + 'The gate console records entry and exit times, can attach a photo, and logs '
      + 'deliveries held at the gate for collection. Frequently expected visitors — domestic '
      + 'help, a regular driver — can be saved so they are not re-approved daily.',
  },

  // ── Announcements ─────────────────────────────────────────────────────────
  {
    id: 'announcements',
    title: 'Announcements and documents',
    tags: ['announcement', 'notice', 'circular', 'document', 'bye laws', 'minutes'],
    body:
      'The committee publishes announcements to residents, and shares documents such as '
      + 'bye-laws, circulars and meeting minutes. Both are visible to every resident.',
  },
  {
    id: 'transparency',
    title: 'Expense transparency',
    tags: ['transparency', 'expenses', 'where does the money go', 'spending'],
    body:
      'Association expenses are published to residents on a transparency screen, so what the '
      + 'maintenance money is spent on can be seen without asking the committee. What appears '
      + 'there is what has been recorded as an expense in the accounts.',
  },

  // ── Governance ────────────────────────────────────────────────────────────
  {
    id: 'governance',
    title: 'Meetings, committees and elections',
    tags: ['meeting', 'agm', 'agenda', 'quorum', 'resolution', 'vote', 'election', 'committee', 'register of members'],
    body:
      'Meetings including AGMs are created with an agenda and a notice to members. Attendance '
      + 'and quorum are tracked, resolutions are put to a vote in the app, and minutes are '
      + 'recorded. Voting rights come from the register of members, which is the formal record '
      + 'of who owns which flat — not simply whoever is logged in for that flat. '
      + 'Committees and sub-committees have their own membership, and office bearers can be '
      + 'elected through a nomination and voting process.',
  },

  // ── Accounts, officers only ───────────────────────────────────────────────
  {
    id: 'accounting_basics',
    title: 'How the accounts work',
    tags: ['accounting', 'ledger', 'double entry', 'journal', 'voucher', 'posting'],
    officersOnly: true,
    body:
      'SmartAppt keeps a double-entry ledger. Every transaction has equal debits and credits, '
      + 'and nothing affects the accounts until it is posted. Entries are made either '
      + 'automatically — a bill raised, a payment received, a penalty applied — or by hand as '
      + 'a voucher: receipt, payment, journal, bank, cash, debit note or credit note.\n'
      + 'The chart of accounts holds the income, expense, asset and liability heads. Business '
      + 'partners hold banks, vendors and a sub-ledger card for each flat, which is what lets '
      + 'the total owed by all flats be reconciled against the control account.',
  },
  {
    id: 'reports',
    title: 'The accounting reports',
    tags: ['report', 'trial balance', 'balance sheet', 'income expenditure', 'receipts payments', 'cash book', 'day book'],
    officersOnly: true,
    body:
      'Trial Balance — every account with its balance; the two sides must agree.\n'
      + 'Receipts & Payments — cash actually in and out over a period.\n'
      + 'Income & Expenditure — what was earned and incurred whether or not money moved; the '
      + 'result is a surplus or deficit, not a profit or loss.\n'
      + 'Balance Sheet — what the association owns and owes at a date.\n'
      + 'Cash / Bank Book and Day Book — movements on a cash or bank account, and every entry '
      + 'in date order.\n'
      + 'Receipts & Payments will not agree with Income & Expenditure, and should not: a bill '
      + 'raised but unpaid is income with no receipt, and a fixed deposit is a payment with no '
      + 'expenditure.',
  },
  {
    id: 'fy_closure',
    title: 'The financial year and closing it',
    tags: ['financial year', 'fy', 'year end', 'closure', 'close the year', 'opening balance'],
    officersOnly: true,
    body:
      'The accounting year normally runs April to March in India, and the starting month is '
      + 'configurable. At year end the accounts are closed: balances are carried forward and '
      + 'the closed year is protected from further entries. Close only once the year\'s '
      + 'accounts are final, since reopening is deliberately awkward.',
  },

  // ── Administration, officers only ─────────────────────────────────────────
  {
    id: 'user_admin',
    title: 'Managing users and flats',
    tags: ['add user', 'new resident', 'manage users', 'units', 'flats', 'move out', 'tenant', 'owner'],
    officersOnly: true,
    body:
      'A manager adds a resident, sets their role, and links them to a flat. Being linked to '
      + 'a flat is what makes dues and visitors work — an unlinked account sees an empty dues '
      + 'screen, and that is the usual explanation when someone reports one.\n'
      + 'A person is marked owner or tenant. When someone moves out they are deactivated '
      + 'rather than deleted, so their history stays intact. Flats themselves are maintained '
      + 'under Manage Units.',
  },
  {
    id: 'menu_config',
    title: 'Configuring the menus',
    tags: ['menu', 'hide screen', 'configure', 'web menu', 'mobile menu', 'by role', 'customise'],
    officersOnly: true,
    body:
      'Each association chooses which menu items each role sees, separately for the web app '
      + 'and the mobile app. Only the differences from the standard are stored, so a screen '
      + 'added in a later release still reaches the roles it was meant for without anyone '
      + 'reconfiguring.\n'
      + 'A manager can configure every role except their own, which prevents locking '
      + 'themselves out of the screen that would undo it.',
  },
  {
    id: 'modules',
    title: 'Modules and subscriptions',
    tags: ['module', 'subscription', 'accounting module', 'governance module', 'not subscribed', '402'],
    officersOnly: true,
    body:
      'Some capabilities are separate modules an association subscribes to — Accounting, '
      + 'Governance, and the assistant itself. Without a module its screens are unavailable. '
      + 'A lapsed module drops to read-only rather than disappearing: existing records stay '
      + 'visible, but new entries and reports stop until it is renewed.',
  },
  {
    id: 'notifications',
    title: 'How residents are notified',
    tags: ['whatsapp', 'sms', 'otp', 'notification', 'message', 'reminder', 'due notice'],
    officersOnly: true,
    body:
      'SmartAppt can send a due notice over WhatsApp with the bill as a PDF and a payment QR '
      + 'inside it, and can confirm or reject a reported payment the same way. A resident '
      + 'must have opted in before anything is sent to them.\n'
      + 'Login codes go by WhatsApp where configured, falling back to SMS. Whether any of this '
      + 'is switched on depends on the association\'s setup.',
  },
];

/**
 * Find sections relevant to a question.
 *
 * Scored word overlap rather than a single best match: a question like "how do
 * I pay and what happens if I am late" legitimately spans two sections, and
 * returning both is better than picking one and sounding certain.
 *
 * Deliberately not a vector search. The corpus is twenty short sections written
 * in the same vocabulary residents use; an embedding index would add a
 * dependency, a build step and a staleness problem to solve a matching problem
 * that barely exists at this size.
 */
export function searchKnowledge(query: string, includeOfficerSections: boolean): KnowledgeSection[] {
  const q = query.toLowerCase();
  const words = q.split(/[^a-z0-9]+/).filter(w => w.length > 2);
  if (!words.length) return [];

  const pool = KNOWLEDGE.filter(s => includeOfficerSections || !s.officersOnly);

  const scored = pool.map(s => {
    let score = 0;

    // A tag phrase appearing in the question is the strongest signal — tags are
    // written as the things people actually say.
    for (const tag of s.tags) {
      if (q.includes(tag)) score += 10;
    }
    const hay = `${s.title} ${s.tags.join(' ')} ${s.body}`.toLowerCase();
    for (const w of words) {
      if (hay.includes(w)) score += 1;
    }
    return { s, score };
  });

  return scored
    .filter(x => x.score >= 3)      // below this is coincidental word overlap
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)                    // three sections is plenty of context
    .map(x => x.s);
}
