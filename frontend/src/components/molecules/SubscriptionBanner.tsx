import type { ModuleEntitlement } from '../../store/api/subscriptionsApi';

/**
 * Renewal warning and lapsed notice.
 *
 * Two states, in priority order — a lapsed module is a present problem and
 * outranks a countdown on a different one.
 *
 * Deliberately not dismissible. A banner someone can close is a banner they
 * will close on day one and never see again, and the entire point is that the
 * expiry does not arrive as a surprise 402 in the middle of a working day.
 */
interface Props {
  expiring: ModuleEntitlement[];
  lapsed:   ModuleEntitlement[];
}

const wrap = (bg: string, border: string, colour: string): React.CSSProperties => ({
  margin: '0 0 12px', padding: '10px 16px', borderRadius: 8,
  background: bg, border: `1px solid ${border}`, color: colour,
  fontSize: 13.5, lineHeight: 1.5,
});

const list = (items: ModuleEntitlement[]) =>
  items.map(m => m.name).join(' and ');

export default function SubscriptionBanner({ expiring, lapsed }: Props) {
  if (lapsed.length > 0) {
    const trial = lapsed.every(m => m.status === 'TRIAL');
    return (
      <div style={wrap('#fef2f2', '#fecaca', '#b91c1c')} role="status">
        <strong>{list(lapsed)}</strong>{' '}
        {trial
          ? `— your trial has ended.`
          : `— subscription ended.`}{' '}
        Your records are still here and still visible. Renew to record new
        entries and produce reports again.
      </div>
    );
  }

  if (expiring.length > 0) {
    // The soonest one sets the tone; listing three countdowns helps nobody.
    const soonest = expiring.reduce((a, b) =>
      (a.days_left ?? 999) <= (b.days_left ?? 999) ? a : b);
    const days = soonest.days_left ?? 0;

    return (
      <div style={wrap('#fffbeb', '#fcd34d', '#92400e')} role="status">
        <strong>{list(expiring)}</strong>{' '}
        {soonest.status === 'TRIAL' ? 'trial ends' : 'subscription expires'}{' '}
        {days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}.
        {' '}Renew to keep recording entries and generating reports — your data
        stays either way.
      </div>
    );
  }

  return null;
}
