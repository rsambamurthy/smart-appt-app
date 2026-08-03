import { CSSProperties } from 'react';
import type { MeetingStatus, Tally, Outcome } from '../../store/api/governanceApi';

/** Shared bits between the committee and resident meeting screens. */

export const card: CSSProperties = {
  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
};
export const btn: CSSProperties = {
  padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', minHeight: 38, border: '1px solid #cbd5e1',
  background: '#fff', color: '#475569',
};
export const field: CSSProperties = {
  padding: '9px 11px', border: '1px solid #cbd5e1', borderRadius: 8,
  fontSize: 14, width: '100%',
};
export const label: CSSProperties = {
  fontSize: 11.5, color: '#64748b', display: 'block', marginBottom: 4, fontWeight: 600,
};

export const MEETING_LABEL: Record<string, string> = {
  AGM: 'Annual general meeting', EGM: 'Extraordinary general meeting', COMMITTEE: 'Committee meeting',
};

const STATUS_LOOK: Record<MeetingStatus, { label: string; bg: string; fg: string }> = {
  DRAFT:         { label: 'Draft',         bg: '#f1f5f9', fg: '#64748b' },
  NOTICE_ISSUED: { label: 'Notice issued', bg: '#eff6ff', fg: '#1d4ed8' },
  IN_PROGRESS:   { label: 'In progress',   bg: '#f0fdf4', fg: '#15803d' },
  CONCLUDED:     { label: 'Concluded',     bg: '#f8fafc', fg: '#475569' },
  CANCELLED:     { label: 'Cancelled',     bg: '#fef2f2', fg: '#b91c1c' },
};

export function StatusPill({ status }: { status: MeetingStatus }) {
  const s = STATUS_LOOK[status];
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99,
      background: s.bg, color: s.fg, whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
}

export function OutcomePill({ outcome }: { outcome: Outcome }) {
  const look = outcome === 'CARRIED'
    ? { bg: '#f0fdf4', fg: '#15803d', label: 'Carried' }
    : outcome === 'DEFEATED'
      ? { bg: '#fef2f2', fg: '#b91c1c', label: 'Defeated' }
      : { bg: '#f8fafc', fg: '#64748b', label: 'Withdrawn' };
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99,
      background: look.bg, color: look.fg, whiteSpace: 'nowrap',
    }}>
      {look.label}
    </span>
  );
}

export const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

/**
 * The vote bar.
 *
 * Abstentions are drawn in grey and separated from the two decisive colours,
 * because they are excluded from the threshold. Showing them in the same
 * visual register as "against" would imply they counted against, which is
 * exactly the misreading the tally rules are designed to avoid.
 */
export function TallyBar({ tally }: { tally: Tally }) {
  if (tally.total === 0) {
    return <div style={{ fontSize: 12, color: '#94a3b8' }}>No votes cast yet</div>;
  }
  const pct = (n: number) => `${(n / tally.total) * 100}%`;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <div style={{
        flex: '1 1 140px', height: 8, borderRadius: 4, overflow: 'hidden',
        display: 'flex', background: '#f1f5f9', minWidth: 120,
      }}>
        <div style={{ width: pct(tally.for),     background: '#15803d' }} />
        <div style={{ width: pct(tally.against), background: '#dc2626' }} />
        <div style={{ width: pct(tally.abstain), background: '#cbd5e1' }} />
      </div>
      <span style={{ fontSize: 11.5, color: '#64748b', whiteSpace: 'nowrap' }}>
        {tally.for} for · {tally.against} against · {tally.abstain} abstained
      </span>
    </div>
  );
}

/** Quorum, stated as flats rather than a percentage nobody can act on. */
export function QuorumTiles({ a }: { a: {
  eligible_units: number; present: number; rsvp_yes: number;
  quorum_required: number | null; quorum_met: boolean | null;
} }) {
  const met = a.quorum_met;
  const tile = (borderColour: string): CSSProperties => ({
    flex: '1 1 120px', background: '#fff', border: `1px solid ${borderColour}`,
    borderRadius: 9, padding: '10px 13px',
  });

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
      <div style={tile(met === true ? '#bbf7d0' : met === false ? '#fecaca' : '#e2e8f0')}>
        <div style={{ fontSize: 11.5, color: '#64748b' }}>Quorum</div>
        <div style={{
          fontSize: 19, fontWeight: 700,
          color: met === true ? '#15803d' : met === false ? '#b91c1c' : '#94a3b8',
        }}>
          {met === null ? '—' : met ? 'Met' : 'Not met'}
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>
          {a.quorum_required === null
            ? 'Set when notice is issued'
            : `${a.present} of ${a.quorum_required} needed`}
        </div>
      </div>

      <div style={tile('#e2e8f0')}>
        <div style={{ fontSize: 11.5, color: '#64748b' }}>Present</div>
        <div style={{ fontSize: 19, fontWeight: 700, color: '#1e293b' }}>
          {a.present}
          <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 400 }}> / {a.eligible_units} flats</span>
        </div>
      </div>

      <div style={tile('#e2e8f0')}>
        <div style={{ fontSize: 11.5, color: '#64748b' }}>Said yes</div>
        <div style={{ fontSize: 19, fontWeight: 700, color: '#1e293b' }}>{a.rsvp_yes}</div>
      </div>
    </div>
  );
}
