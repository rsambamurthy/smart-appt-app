import { useState } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import SearchInput from '../../components/molecules/SearchInput';
import {
  useListAuditLogsQuery,
  useGetAuditFacetsQuery,
  type AuditLogEntry,
} from '../../store/api/systemApi';

// ── Presentation helpers ──────────────────────────────────────────────────────

const ACTION_COLOR: Record<string, { bg: string; fg: string }> = {
  CREATE:       { bg: '#f0fdf4', fg: '#16a34a' },
  UPDATE:       { bg: '#eff6ff', fg: '#2563eb' },
  DELETE:       { bg: '#fef2f2', fg: '#dc2626' },
  APPROVE:      { bg: '#f0fdf4', fg: '#15803d' },
  REJECT:       { bg: '#fef2f2', fg: '#b91c1c' },
  CANCEL:       { bg: '#fef2f2', fg: '#b91c1c' },
  CLOSE:        { bg: '#f5f3ff', fg: '#7c3aed' },
  REOPEN:       { bg: '#fffbeb', fg: '#d97706' },
  GENERATE:     { bg: '#eff6ff', fg: '#1d4ed8' },
  ROLLBACK:     { bg: '#fef2f2', fg: '#dc2626' },
  UPLOAD:       { bg: '#eff6ff', fg: '#2563eb' },
  LOGIN:        { bg: '#f0fdf4', fg: '#16a34a' },
  LOGIN_FAILED: { bg: '#fef2f2', fg: '#dc2626' },
  LOGOUT:       { bg: '#f8fafc', fg: '#64748b' },
  MPIN_SET:     { bg: '#f5f3ff', fg: '#7c3aed' },
  MPIN_RESET:   { bg: '#fffbeb', fg: '#d97706' },
};

const ENTITY_LABEL: Record<string, string> = {
  journal_entry:   'Journal Entry',
  account:         'Chart of Accounts',
  financial_year:  'Financial Year',
  bill_run:        'Bill Run',
  payment:         'Payment',
  expense:         'Expense',
  user:            'User',
  unit:            'Unit',
  mobile_config:   'Mobile Config',
  menu_config:     'Menu Config',
  dues_config:     'Fee Config',
  razorpay_config: 'Razorpay Config',
  auth:            'Authentication',
};

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const th: React.CSSProperties = {
  padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em',
  borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  padding: '10px 12px', fontSize: 13, color: '#1e293b',
  borderBottom: '1px solid #f1f5f9', verticalAlign: 'top',
};
const lbl: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 700, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  marginBottom: 4, display: 'block',
};
const fc: React.CSSProperties = {
  padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6,
  fontSize: 13, color: '#1e293b', background: '#fff', outline: 'none', width: '100%',
};

/** Pretty-print a JSON value, or show a dash. */
function ValueBlock({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  return (
    <div style={{ flex: 1, minWidth: 220 }}>
      <div style={{ ...lbl, marginBottom: 3 }}>{label}</div>
      <pre style={{
        margin: 0, padding: '8px 10px', background: '#f8fafc',
        border: '1px solid #e2e8f0', borderRadius: 6,
        fontSize: 11.5, lineHeight: 1.5, color: '#334155',
        maxHeight: 260, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function Row({ entry }: { entry: AuditLogEntry }) {
  const [open, setOpen] = useState(false);
  const colors = ACTION_COLOR[entry.action] ?? { bg: '#f1f5f9', fg: '#475569' };
  const hasDetail = entry.old_value != null || entry.new_value != null;

  return (
    <>
      <tr
        onClick={() => hasDetail && setOpen(v => !v)}
        style={{ cursor: hasDetail ? 'pointer' : 'default', background: open ? '#fafbff' : '#fff' }}
      >
        <td style={{ ...td, whiteSpace: 'nowrap', color: '#64748b' }}>{fmtWhen(entry.created_at)}</td>
        <td style={td}>
          <span style={{
            display: 'inline-block', padding: '2px 8px', borderRadius: 99,
            background: colors.bg, color: colors.fg, fontSize: 11, fontWeight: 700,
          }}>
            {entry.action.replace(/_/g, ' ')}
          </span>
        </td>
        <td style={td}>{ENTITY_LABEL[entry.entity_type] ?? entry.entity_type}</td>
        <td style={{ ...td, maxWidth: 360 }}>{entry.summary ?? '—'}</td>
        <td style={td}>
          {entry.performer
            ? <>
                <div style={{ fontWeight: 600 }}>{entry.performer.name}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{entry.performer.role.replace(/_/g, ' ')}</div>
              </>
            : <span style={{ color: '#94a3b8' }}>{entry.actor_label ?? 'system'}</span>}
        </td>
        <td style={{ ...td, fontSize: 11.5, color: '#94a3b8', whiteSpace: 'nowrap' }}>
          {entry.ip_address ?? '—'}
        </td>
        <td style={{ ...td, textAlign: 'center', color: '#94a3b8' }}>
          {hasDetail ? (open ? '▾' : '▸') : ''}
        </td>
      </tr>
      {open && hasDetail && (
        <tr>
          <td colSpan={7} style={{ padding: '4px 12px 16px', background: '#fafbff', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <ValueBlock label="Before" value={entry.old_value} />
              <ValueBlock label="After"  value={entry.new_value} />
            </div>
            {entry.user_agent && (
              <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8' }}>
                <b>Device:</b> {entry.user_agent}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const [entityType, setEntityType] = useState('');
  const [action, setAction]         = useState('');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [search, setSearch]         = useState('');
  const [cursor, setCursor]         = useState<string | undefined>(undefined);
  const [stack, setStack]           = useState<string[]>([]);

  const { data: facetData } = useGetAuditFacetsQuery();
  const facets = facetData?.data;

  const { data, isFetching } = useListAuditLogsQuery({
    entity_type: entityType || undefined,
    action:      action || undefined,
    date_from:   dateFrom || undefined,
    date_to:     dateTo || undefined,
    search:      search || undefined,
    cursor,
    limit: 50,
  });

  const rows = data?.data ?? [];
  const nextCursor = data?.meta?.next_cursor ?? null;

  // Any filter change resets pagination — otherwise the cursor points into the
  // previous result set and the first page looks empty.
  const resetTo = (fn: () => void) => { fn(); setCursor(undefined); setStack([]); };

  const clearAll = () => resetTo(() => {
    setEntityType(''); setAction(''); setDateFrom(''); setDateTo(''); setSearch('');
  });

  const hasFilters = entityType || action || dateFrom || dateTo || search;

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'System Settings' }, { label: 'Audit Trail' }]} />

      <div style={{ padding: '1.25rem 1.5rem 3rem', maxWidth: 1240 }}>

        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
          Append-only record of financial changes, configuration changes, sign-ins and deletions.
          Entries cannot be edited or removed. Click a row to see what changed.
        </p>

        {/* Filters */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '2 1 220px' }}>
              <label style={lbl}>Search</label>
              <SearchInput
                value={search}
                onChange={(v) => resetTo(() => setSearch(v))}
                placeholder="Search summary or actor…"
                suggestions={rows.map(r => r.summary ?? '').filter(Boolean)}
              />
            </div>

            <div style={{ flex: '1 1 160px' }}>
              <label style={lbl}>Area</label>
              <select style={fc} value={entityType} onChange={e => resetTo(() => setEntityType(e.target.value))}>
                <option value="">All areas</option>
                {(facets?.entity_types ?? []).map(t => (
                  <option key={t} value={t}>{ENTITY_LABEL[t] ?? t}</option>
                ))}
              </select>
            </div>

            <div style={{ flex: '1 1 150px' }}>
              <label style={lbl}>Action</label>
              <select style={fc} value={action} onChange={e => resetTo(() => setAction(e.target.value))}>
                <option value="">All actions</option>
                {(facets?.actions ?? []).map(a => (
                  <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={lbl}>From</label>
              <input type="date" style={fc} value={dateFrom} onChange={e => resetTo(() => setDateFrom(e.target.value))} />
            </div>
            <div>
              <label style={lbl}>To</label>
              <input type="date" style={fc} value={dateTo} onChange={e => resetTo(() => setDateTo(e.target.value))} />
            </div>

            {hasFilters && (
              <button
                onClick={clearAll}
                style={{
                  padding: '7px 14px', borderRadius: 6, border: '1px solid #e2e8f0',
                  background: '#f8fafc', color: '#64748b', fontSize: 12.5,
                  fontWeight: 600, cursor: 'pointer',
                }}
              >
                ✕ Clear
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f8fafc' }}>
              <tr>
                <th style={th}>When</th>
                <th style={th}>Action</th>
                <th style={th}>Area</th>
                <th style={th}>What changed</th>
                <th style={th}>Who</th>
                <th style={th}>IP</th>
                <th style={{ ...th, width: 30 }} />
              </tr>
            </thead>
            <tbody>
              {isFetching && rows.length === 0 && (
                <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Loading…</td></tr>
              )}
              {!isFetching && rows.length === 0 && (
                <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                  {hasFilters ? 'No audit entries match these filters.' : 'No audit entries recorded yet.'}
                </td></tr>
              )}
              {rows.map(entry => <Row key={entry.id} entry={entry} />)}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {(stack.length > 0 || nextCursor) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
            <button
              disabled={stack.length === 0}
              onClick={() => {
                const prev = [...stack];
                const target = prev.pop();
                setStack(prev);
                setCursor(target);
              }}
              style={{
                padding: '7px 16px', borderRadius: 6, border: '1px solid #e2e8f0',
                background: stack.length ? '#fff' : '#f8fafc',
                color: stack.length ? '#334155' : '#cbd5e1',
                fontSize: 13, fontWeight: 600, cursor: stack.length ? 'pointer' : 'not-allowed',
              }}
            >
              ← Newer
            </button>
            <button
              disabled={!nextCursor}
              onClick={() => {
                setStack([...stack, cursor ?? '']);
                setCursor(nextCursor ?? undefined);
              }}
              style={{
                padding: '7px 16px', borderRadius: 6, border: '1px solid #e2e8f0',
                background: nextCursor ? '#fff' : '#f8fafc',
                color: nextCursor ? '#334155' : '#cbd5e1',
                fontSize: 13, fontWeight: 600, cursor: nextCursor ? 'pointer' : 'not-allowed',
              }}
            >
              Older →
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
