import { useState, useEffect } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import InboxLayout, { InboxRow } from './InboxLayout';
import {
  useListComplianceItemsQuery, useGetComplianceItemQuery,
  useCreateComplianceItemMutation, useUpdateComplianceItemMutation,
  useCompleteComplianceMutation, useReopenComplianceMutation,
  ComplianceCategory, Recurrence,
} from '../../store/api/governanceApi';
import { useListUsersQuery } from '../../store/api/usersApi';
import { btn, field, label } from './meetingUi';

interface UserRow { id: string; name: string }

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

const RECURRENCE_TEXT: Record<Recurrence, string> = {
  ANNUAL: 'Every year', HALF_YEARLY: 'Twice a year', QUARTERLY: 'Every quarter',
  MONTHLY: 'Every month', NONE: 'One off',
};

const CATEGORIES: ComplianceCategory[] =
  ['MEETING', 'AUDIT', 'FILING', 'TAX', 'INSURANCE', 'LICENCE', 'OTHER'];

/** How the next date reads. Plain language beats a bare date for urgency. */
function dueText(days: number | null, on: string | null): string {
  if (days === null) return 'No date set';
  if (days < 0)  return `${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days <= 60) return `In ${days} days`;
  return fmtDate(on);
}

const section: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  padding: '13px 16px 6px',
};

// ── The obligation ────────────────────────────────────────────────────────────

function ItemDetail({ itemId }: { itemId: string }) {
  const { data, isLoading } = useGetComplianceItemQuery(itemId);
  const { data: usersData } = useListUsersQuery({ limit: 500 });
  const [update, { isLoading: saving }] = useUpdateComplianceItemMutation();
  const [complete] = useCompleteComplianceMutation();
  const [reopen]   = useReopenComplianceMutation();

  const [form, setForm]     = useState<Record<string, string>>({});
  const [dirty, setDirty]   = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [msg, setMsg]       = useState<string | null>(null);
  const [refFor, setRefFor] = useState<string | null>(null);
  const [ref, setRef]       = useState('');

  const item = data?.data;

  // Reload the form when a different obligation is selected, or edits from the
  // previous one would appear to belong to this one.
  useEffect(() => {
    if (!item) return;
    setForm({
      title: item.title,
      description: item.description ?? '',
      category: item.category,
      recurrence: item.recurrence,
      due_month: String(item.due_month ?? ''),
      due_day: String(item.due_day),
      owner_user_id: item.owner?.id ?? '',
      remind_days_before: String(item.remind_days_before),
    });
    setDirty(false); setError(null); setMsg(null);
  }, [itemId, item?.id]);

  if (isLoading || !item) {
    return <div style={{ padding: '2rem', color: '#94a3b8', fontSize: 13 }}>Loading…</div>;
  }

  const set = (k: string, v: string) => { setForm(f => ({ ...f, [k]: v })); setDirty(true); };
  const users = (usersData?.data ?? []) as UserRow[];

  const save = async () => {
    setError(null); setMsg(null);
    try {
      await update({
        itemId,
        title: form['title'],
        description: form['description'],
        category: form['category'] as ComplianceCategory,
        recurrence: form['recurrence'] as Recurrence,
        due_month: form['recurrence'] === 'MONTHLY' ? null : Number(form['due_month']) || null,
        due_day: Number(form['due_day']) || 1,
        owner_user_id: form['owner_user_id'] || null,
        remind_days_before: Number(form['remind_days_before']) || 14,
      } as never).unwrap();
      setDirty(false);
      setMsg('Saved. Future due dates have been rescheduled; anything already completed is untouched.');
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string } };
      setError(err?.data?.detail ?? 'Could not save.');
    }
  };

  const pending = item.occurrences.filter(o => o.status === 'PENDING');
  const past    = item.occurrences.filter(o => o.status !== 'PENDING').reverse();

  return (
    <div>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#1e293b' }}>{item.title}</div>
        <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
          {RECURRENCE_TEXT[item.recurrence]}
          {item.owner ? ` · ${item.owner.name}` : ' · nobody assigned'}
        </div>
      </div>

      {/* Editing the schedule is the main job here, so it comes first. */}
      <div style={section}>When it is due</div>
      <div style={{ padding: '0 16px 14px' }}>
        {error && (
          <div style={{ marginBottom: 10, padding: '9px 12px', borderRadius: 7, fontSize: 13,
                        background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
            {error}
          </div>
        )}
        {msg && (
          <div style={{ marginBottom: 10, padding: '9px 12px', borderRadius: 7, fontSize: 13,
                        background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d' }}>
            {msg}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 150px' }}>
            <label style={label}>How often</label>
            <select style={field} value={form['recurrence'] ?? ''}
                    onChange={e => set('recurrence', e.target.value)}>
              {Object.entries(RECURRENCE_TEXT).map(([k, v]) =>
                <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {form['recurrence'] !== 'MONTHLY' && (
            <div style={{ flex: '1 1 150px' }}>
              <label style={label}>Month</label>
              <select style={field} value={form['due_month'] ?? ''}
                      onChange={e => set('due_month', e.target.value)}>
                <option value="">Choose…</option>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
          )}

          <div style={{ flex: '0 1 100px' }}>
            <label style={label}>Day</label>
            <input style={field} inputMode="numeric" value={form['due_day'] ?? ''}
                   onChange={e => set('due_day', e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          <div style={{ flex: '2 1 200px' }}>
            <label style={label}>Who is answerable</label>
            <select style={field} value={form['owner_user_id'] ?? ''}
                    onChange={e => set('owner_user_id', e.target.value)}>
              <option value="">Nobody assigned</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div style={{ flex: '0 1 130px' }}>
            <label style={label}>Remind (days)</label>
            <input style={field} inputMode="numeric" value={form['remind_days_before'] ?? ''}
                   onChange={e => set('remind_days_before', e.target.value)} />
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <label style={label}>Category</label>
            <select style={field} value={form['category'] ?? ''}
                    onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <label style={label}>Notes</label>
          <input style={field} value={form['description'] ?? ''}
                 onChange={e => set('description', e.target.value)}
                 placeholder="What this covers, and where the rule comes from" />
        </div>

        {dirty && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={save} disabled={saving}
              style={{ ...btn, background: '#2563eb', color: '#fff', border: 'none' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <span style={{ fontSize: 11.5, color: '#94a3b8', alignSelf: 'center' }}>
              Rescheduling only moves dates that are still open.
            </span>
          </div>
        )}
      </div>

      {/* Upcoming */}
      <div style={section}>Upcoming</div>
      {pending.length === 0 && (
        <div style={{ padding: '2px 16px 10px', fontSize: 13, color: '#94a3b8' }}>
          Nothing scheduled. Set a month and day above.
        </div>
      )}
      {pending.map(o => (
        <div key={o.id} style={{ borderBottom: '1px solid #f8fafc' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center',
                        padding: '9px 16px', background: o.overdue ? '#fef2f2' : '#fff' }}>
            <span style={{ flex: 1, fontSize: 13.5, color: '#1e293b' }}>{fmtDate(o.due_on)}</span>
            <span style={{ fontSize: 12, fontWeight: o.overdue ? 700 : 500,
                           color: o.overdue ? '#b91c1c' : '#64748b' }}>
              {dueText(o.days_until, o.due_on)}
            </span>
            <button onClick={() => { setRefFor(refFor === o.id ? null : o.id); setRef(''); }}
              style={{ ...btn, padding: '3px 10px', minHeight: 28, fontSize: 11.5,
                       background: '#2563eb', color: '#fff', border: 'none' }}>
              Mark done
            </button>
          </div>

          {refFor === o.id && (
            <div style={{ padding: '0 16px 11px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input style={{ ...field, flex: '1 1 200px' }} value={ref}
                     onChange={e => setRef(e.target.value)}
                     placeholder="Acknowledgement or certificate number" />
              <button onClick={() => { complete({ occurrenceId: o.id, reference: ref || undefined }); setRefFor(null); }}
                style={{ ...btn, background: '#15803d', color: '#fff', border: 'none' }}>
                Done
              </button>
              <button onClick={() => { complete({ occurrenceId: o.id, waived: true }); setRefFor(null); }}
                style={btn}>
                Not applicable
              </button>
            </div>
          )}
        </div>
      ))}

      {/* History — the reason for keeping occurrences separately */}
      {past.length > 0 && (
        <>
          <div style={section}>History</div>
          {past.map(o => (
            <div key={o.id} style={{
              display: 'flex', gap: 10, alignItems: 'center',
              padding: '9px 16px', borderBottom: '1px solid #f8fafc', opacity: 0.8,
            }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#475569' }}>
                {fmtDate(o.due_on)}
                {o.reference && <span style={{ color: '#94a3b8' }}> · {o.reference}</span>}
                {o.completed_by && <span style={{ color: '#cbd5e1' }}> · {o.completed_by.name}</span>}
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 600,
                             color: o.status === 'WAIVED' ? '#64748b' : '#15803d' }}>
                {o.status === 'WAIVED' ? 'Not applicable' : `Done ${fmtDate(o.completed_on)}`}
              </span>
              <button onClick={() => reopen(o.id)}
                style={{ ...btn, padding: '3px 9px', minHeight: 26, fontSize: 11 }}>
                Reopen
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CompliancePage() {
  const { data, isLoading } = useListComplianceItemsQuery();
  const [create, { isLoading: creating }] = useCreateComplianceItemMutation();

  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle]   = useState('');

  const rows = data?.data ?? [];
  const s    = data?.summary;

  const add = async () => {
    if (!title.trim()) return;
    const res = await create({ title: title.trim() }).unwrap().catch(() => null);
    setTitle(''); setAdding(false);
    if (res) setSelected(res.data.id);
  };

  const toolbar = (
    <div style={{ padding: '9px 10px' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 99,
                       background: '#fef2f2', color: '#b91c1c' }}>
          {s?.overdue ?? 0} overdue
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 99,
                       background: '#fffbeb', color: '#92400e' }}>
          {s?.due_soon ?? 0} soon
        </span>
      </div>
      {adding ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <input style={{ ...field, fontSize: 13, padding: '6px 8px' }} value={title}
                 onChange={e => setTitle(e.target.value)} placeholder="Property tax" autoFocus />
          <button onClick={add} disabled={creating || !title.trim()}
            style={{ ...btn, padding: '4px 10px', minHeight: 32, fontSize: 12,
                     background: '#2563eb', color: '#fff', border: 'none' }}>
            Add
          </button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          style={{ ...btn, width: '100%', padding: '5px', minHeight: 32, fontSize: 12.5 }}>
          Add an obligation
        </button>
      )}
    </div>
  );

  const list = isLoading ? (
    <div style={{ padding: '1.5rem 1rem', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
  ) : rows.length === 0 ? (
    <div style={{ padding: '1.5rem 1rem', color: '#94a3b8', fontSize: 13 }}>
      No obligations recorded.
    </div>
  ) : (
    <>
      {rows.map(r => (
        <InboxRow
          key={r.id}
          selected={selected === r.id}
          // Only what needs attention is coloured.
          accent={!r.is_active ? undefined
                : r.overdue ? '#dc2626'
                : (r.days_until !== null && r.days_until <= 30) ? '#ba7517'
                : undefined}
          muted={!r.is_active}
          title={r.title}
          trailing={r.next_due_on
            ? new Date(r.next_due_on).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
            : '—'}
          meta={<>
            {r.category.toLowerCase()} · {dueText(r.days_until, r.next_due_on)}
          </>}
          onClick={() => setSelected(r.id)}
        />
      ))}
    </>
  );

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Governance' }, { label: 'Compliance calendar' }]} />

      <div style={{ padding: '1rem 1.25rem 3rem' }}>
        <InboxLayout
          toolbar={toolbar}
          list={list}
          detail={selected ? <ItemDetail itemId={selected} /> : null}
          placeholder="Select an obligation to set when it falls due, who owns it, and to record it as done."
        />

        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 14, maxWidth: 660, lineHeight: 1.6 }}>
          The items shipped with the product are common obligations for an Indian
          apartment association, with placeholder dates. They are a prompt to
          check your own bye-laws and state rules, not a statement of the law —
          set the real dates, or delete what does not apply.
        </div>
      </div>
    </Layout>
  );
}
