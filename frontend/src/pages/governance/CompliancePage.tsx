import { useState } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useListComplianceQuery, useCompleteComplianceMutation, useReopenComplianceMutation,
  useCreateComplianceItemMutation,
  ComplianceOccurrence, ComplianceCategory, Recurrence,
} from '../../store/api/governanceApi';
import { card, btn, field, label } from './meetingUi';

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const CATEGORY_LOOK: Record<ComplianceCategory, { bg: string; fg: string }> = {
  MEETING:   { bg: '#ede9fe', fg: '#6d28d9' },
  AUDIT:     { bg: '#dbeafe', fg: '#1e40af' },
  FILING:    { bg: '#dcfce7', fg: '#15803d' },
  TAX:       { bg: '#fee2e2', fg: '#991b1b' },
  INSURANCE: { bg: '#fef9c3', fg: '#a16207' },
  LICENCE:   { bg: '#ffedd5', fg: '#c2410c' },
  OTHER:     { bg: '#f1f5f9', fg: '#475569' },
};

/** When it is due, said the way someone would say it out loud. */
function whenText(o: ComplianceOccurrence): string {
  if (o.status !== 'PENDING') return fmtDate(o.completed_on);
  if (o.overdue) {
    const late = Math.abs(o.days_until);
    return late === 0 ? 'Due today' : `${late} ${late === 1 ? 'day' : 'days'} overdue`;
  }
  if (o.days_until === 0) return 'Due today';
  if (o.days_until === 1) return 'Due tomorrow';
  if (o.days_until <= 60) return `In ${o.days_until} days`;
  return fmtDate(o.due_on);
}

// ── One row ───────────────────────────────────────────────────────────────────

function Row({ o }: { o: ComplianceOccurrence }) {
  const [complete, { isLoading }] = useCompleteComplianceMutation();
  const [reopen] = useReopenComplianceMutation();
  const [open, setOpen]   = useState(false);
  const [ref, setRef]     = useState('');
  const [error, setError] = useState<string | null>(null);

  const cat  = CATEGORY_LOOK[o.item.category];
  const done = o.status !== 'PENDING';

  const finish = async (waived: boolean) => {
    setError(null);
    try {
      await complete({ occurrenceId: o.id, reference: ref.trim() || undefined, waived }).unwrap();
      setOpen(false); setRef('');
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string } };
      setError(err?.data?.detail ?? 'Could not save.');
    }
  };

  return (
    <div style={{
      borderLeft: `3px solid ${o.overdue ? '#dc2626' : done ? 'transparent' : o.days_until <= 30 ? '#ba7517' : 'transparent'}`,
      borderBottom: '1px solid #f1f5f9',
      background: o.overdue ? '#fef2f2' : '#fff',
      opacity: done ? 0.7 : 1,
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '11px 16px' }}>
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{o.item.title}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
            {fmtDate(o.due_on)}
            {o.item.owner ? ` · ${o.item.owner.name}` : ' · nobody assigned'}
            {o.reference && ` · ${o.reference}`}
          </div>
        </div>

        <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                       background: cat.bg, color: cat.fg, whiteSpace: 'nowrap' }}>
          {o.item.category}
        </span>

        <span style={{
          fontSize: 12, fontWeight: o.overdue ? 700 : 500, whiteSpace: 'nowrap',
          color: o.overdue ? '#b91c1c' : done ? '#15803d' : '#64748b',
        }}>
          {done ? (o.status === 'WAIVED' ? 'Not applicable' : `Done ${whenText(o)}`) : whenText(o)}
        </span>

        {done ? (
          <button onClick={() => reopen(o.id)}
            style={{ ...btn, padding: '3px 10px', minHeight: 28, fontSize: 11.5 }}>
            Reopen
          </button>
        ) : (
          <button onClick={() => setOpen(!open)}
            style={{ ...btn, padding: '3px 10px', minHeight: 28, fontSize: 11.5,
                     background: '#2563eb', color: '#fff', border: 'none' }}>
            Mark done
          </button>
        )}
      </div>

      {open && (
        <div style={{ padding: '0 16px 12px 16px' }}>
          {error && <div style={{ fontSize: 12.5, color: '#b91c1c', marginBottom: 8 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input style={{ ...field, flex: '1 1 200px', maxWidth: 320 }} value={ref}
                   onChange={e => setRef(e.target.value)}
                   placeholder="Acknowledgement or certificate number" />
            <button onClick={() => finish(false)} disabled={isLoading}
              style={{ ...btn, background: '#15803d', color: '#fff', border: 'none' }}>
              Done
            </button>
            <button onClick={() => finish(true)} disabled={isLoading} style={btn}>
              Not applicable
            </button>
          </div>
          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 7 }}>
            The reference is what an auditor asks for later. Worth entering now
            rather than reconstructing it in nine months.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CompliancePage() {
  const [openOnly, setOpenOnly] = useState(true);
  const { data, isLoading } = useListComplianceQuery({ open: openOnly });
  const [createItem, { isLoading: creating }] = useCreateComplianceItemMutation();

  const [adding, setAdding] = useState(false);
  const [title, setTitle]   = useState('');
  const [cat, setCat]       = useState<ComplianceCategory>('OTHER');
  const [rec, setRec]       = useState<Recurrence>('ANNUAL');
  const [month, setMonth]   = useState('3');
  const [day, setDay]       = useState('31');
  const [error, setError]   = useState<string | null>(null);

  const rows = data?.data ?? [];
  const s    = data?.summary;

  const submit = async () => {
    setError(null);
    try {
      await createItem({
        title: title.trim(), category: cat, recurrence: rec,
        due_month: rec === 'MONTHLY' ? null : Number(month),
        due_day: Number(day),
      }).unwrap();
      setAdding(false); setTitle('');
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string } };
      setError(err?.data?.detail ?? 'Could not add it.');
    }
  };

  const tile = (n: number, text: string, colour: string, bg: string) => (
    <div style={{ flex: '1 1 120px', background: bg, borderRadius: 10, padding: '11px 14px' }}>
      <div style={{ fontSize: 21, fontWeight: 700, color: colour }}>{n}</div>
      <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>{text}</div>
    </div>
  );

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Governance' }, { label: 'Compliance calendar' }]} />

      <div style={{ padding: '1rem 1.25rem 3rem', maxWidth: 900 }}>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          {tile(s?.overdue  ?? 0, 'Overdue',        '#b91c1c', '#fef2f2')}
          {tile(s?.due_soon ?? 0, 'Due in 30 days', '#92400e', '#fffbeb')}
          {tile(s?.open     ?? 0, 'Open',           '#1e293b', '#f8fafc')}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => setOpenOnly(!openOnly)} style={btn}>
            {openOnly ? 'Show completed too' : 'Show only what is open'}
          </button>
          {!adding && (
            <button onClick={() => setAdding(true)}
              style={{ ...btn, background: '#2563eb', color: '#fff', border: 'none', marginLeft: 'auto' }}>
              Add an obligation
            </button>
          )}
        </div>

        {adding && (
          <div style={{ ...card, padding: '16px 18px', marginBottom: 14 }}>
            {error && (
              <div style={{ marginBottom: 10, padding: '9px 12px', borderRadius: 7, fontSize: 13,
                            background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
                {error}
              </div>
            )}
            <div style={{ marginBottom: 10 }}>
              <label style={label}>What is it</label>
              <input style={field} value={title} onChange={e => setTitle(e.target.value)}
                     placeholder="Property tax payment" />
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 140px' }}>
                <label style={label}>Category</label>
                <select style={field} value={cat} onChange={e => setCat(e.target.value as ComplianceCategory)}>
                  {Object.keys(CATEGORY_LOOK).map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div style={{ flex: '1 1 140px' }}>
                <label style={label}>How often</label>
                <select style={field} value={rec} onChange={e => setRec(e.target.value as Recurrence)}>
                  <option value="ANNUAL">Every year</option>
                  <option value="HALF_YEARLY">Twice a year</option>
                  <option value="QUARTERLY">Every quarter</option>
                  <option value="MONTHLY">Every month</option>
                  <option value="NONE">One off</option>
                </select>
              </div>
              {rec !== 'MONTHLY' && (
                <div style={{ flex: '0 1 100px' }}>
                  <label style={label}>Month</label>
                  <input style={field} inputMode="numeric" value={month}
                         onChange={e => setMonth(e.target.value)} />
                </div>
              )}
              <div style={{ flex: '0 1 90px' }}>
                <label style={label}>Day</label>
                <input style={field} inputMode="numeric" value={day}
                       onChange={e => setDay(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={submit} disabled={creating || !title.trim()}
                style={{ ...btn, background: '#2563eb', color: '#fff', border: 'none' }}>
                {creating ? 'Adding…' : 'Add'}
              </button>
              <button onClick={() => { setAdding(false); setError(null); }} style={btn}>Cancel</button>
            </div>
          </div>
        )}

        <div style={{ ...card, overflow: 'hidden' }}>
          {isLoading ? (
            <div style={{ padding: '2rem', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: '2rem', color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
              Nothing outstanding.
            </div>
          ) : rows.map(o => <Row key={o.id} o={o} />)}
        </div>

        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 14, maxWidth: 640, lineHeight: 1.6 }}>
          The starter items are common obligations for an Indian apartment
          association, not a statement of the law. Deadlines and which
          certificates apply vary by state and by your own bye-laws — check each
          one and edit or delete what does not fit.
        </div>
      </div>
    </Layout>
  );
}
