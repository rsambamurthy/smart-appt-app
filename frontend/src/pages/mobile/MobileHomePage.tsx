import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { useMobileConfig } from '../../contexts/MobileConfigContext';
import MobileLogoutButton from '../../components/molecules/MobileLogoutButton';
import { useListMyBillsQuery } from '../../store/api/duesApi';
import { useGetUnreadAnnouncementCountQuery } from '../../store/api/announcementsApi';
import { useListTicketsQuery, useListMyTicketsQuery } from '../../store/api/maintenanceApi';
import { useListChatChannelsQuery } from '../../store/api/chatApi';
import { useGetMyVisitorRequestsQuery } from '../../store/api/visitorsApi';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtAmt = (n: number) =>
  `₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

// ── Badge — small counter pill for "there's something new here" ──────────────
function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span style={{
      position: 'absolute', top: -6, right: -6,
      minWidth: 18, height: 18, padding: '0 5px', boxSizing: 'border-box',
      borderRadius: 999, background: '#dc2626', color: '#fff',
      fontSize: 10.5, fontWeight: 700, lineHeight: '18px', textAlign: 'center',
      boxShadow: '0 0 0 2px #fff',
    }}>
      {count > 99 ? '99+' : count}
    </span>
  );
}

// ── Quick-action card ─────────────────────────────────────────────────────────

function ActionCard({
  icon, label, sublabel, color, bg, onClick, badge,
}: { icon: string; label: string; sublabel: string; color: string; bg: string; onClick: () => void; badge?: number }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, minWidth: 'calc(50% - 6px)', padding: '14px 12px',
        background: bg, border: 'none', borderRadius: 12, cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
        textAlign: 'left', transition: 'opacity 0.15s', position: 'relative',
      }}
    >
      <Badge count={badge ?? 0} />
      <span style={{ fontSize: 24 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color }}>{label}</div>
        <div style={{ fontSize: 11, color, opacity: 0.75, marginTop: 1 }}>{sublabel}</div>
      </div>
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MobileHomePage() {
  const navigate = useNavigate();
  const config = useMobileConfig();
  const user = useSelector((s: RootState) => s.auth.user);

  const isManager   = user?.role === 'MANAGER';
  const isGateStaff = user?.role === 'GATE_STAFF';

  // Bills and announcements: always own data
  const { data: billsData } = useListMyBillsQuery({ limit: 10 }, { skip: !config.feature_bills || !config.can('dues_my_bills') });
  const announcementsVisible = config.feature_announcements && config.can('announcements_feed');
  const { data: unreadAnnouncementsData } = useGetUnreadAnnouncementCountQuery(undefined, { skip: !announcementsVisible });
  // Manager sees all pending tickets so they know what needs attention; others see their own
  const { data: allTicketsData } = useListTicketsQuery({ limit: 50 },   { skip: !config.feature_complaints || !isManager });
  const { data: myTicketsData }  = useListMyTicketsQuery({ limit: 10 }, { skip: !config.feature_complaints || isManager });
  const ticketsData = isManager ? allTicketsData : myTicketsData;
  const chatVisible = config.can('chat');
  const { data: chatChannelsData } = useListChatChannelsQuery(undefined, { skip: !chatVisible });
  const visitorsVisible = config.feature_visitors && config.can('visitors_preapprove');
  const { data: visitorRequestsData } = useGetMyVisitorRequestsQuery(undefined, { skip: !visitorsVisible });

  type Bill = { id: string; status: string; total_amount: number; period_month: number; period_year: number };
  type Ticket = { id: string; status: string };

  const bills = (billsData?.data ?? []) as Bill[];
  const tickets = (ticketsData?.data ?? []) as Ticket[];

  const pendingBills = bills.filter((b) => b.status !== 'PAID');
  const pendingAmount = pendingBills.reduce((s, b) => s + Number(b.total_amount), 0);
  const openTickets = tickets.filter((t) => !['RESOLVED', 'CLOSED'].includes(t.status)).length;
  const unreadAnnouncements = unreadAnnouncementsData?.data?.count ?? 0;
  const chatUnread = (chatChannelsData?.data ?? []).reduce((s, c) => s + (c.unread_count || 0), 0);
  const pendingVisitorRequests = visitorRequestsData?.data?.pending?.length ?? 0;

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const accentColor = config.theme_color ?? '#0095db';

  return (
    <div style={{ minHeight: '100%', background: 'transparent' }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}cc 100%)`,
        padding: '52px 20px 24px',
        paddingTop: 'max(52px, calc(env(safe-area-inset-top) + 20px))',
        position: 'relative',
      }}>
        <MobileLogoutButton />
        {/* The logo used to sit here as a small header image — it's now the
            faint full-screen watermark behind every mobile page instead
            (see MobileLayout.tsx). */}
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', marginBottom: 2 }}>{greeting},</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{user?.name ?? 'Resident'}</div>
        {/* Association name + unit */}
        <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {user?.association_name && (
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
              🏠 {user.association_name}
            </span>
          )}
          {user?.unit_number && (
            <span style={{
              background: 'rgba(255,255,255,0.22)', color: '#fff',
              fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
            }}>
              Unit {user.unit_number}
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>

        {/* Gate console.
            Full width and first, not a tile among tiles: for a guard this is
            not one feature of several, it is the entire reason the handset is
            in their hand.

            Role AND menu, not menu alone: can() falls open while the config is
            in flight, and an over-generous menu that merely hides a tile is
            harmless, whereas one that SHOWS a button is not. /mobile/gate is
            GATE_STAFF-only, so anyone else tapping this would be bounced
            straight back here. */}
        {isGateStaff && config.can('gate_console') && (
          <button
            onClick={() => navigate('/mobile/gate')}
            style={{
              width: '100%', padding: '16px', background: '#1e293b',
              border: 'none', borderRadius: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 13, marginBottom: 14,
              boxShadow: '0 2px 10px rgba(15,23,42,0.25)', minHeight: 64,
            }}
          >
            <div style={{ width: 42, height: 42, background: 'rgba(255,255,255,0.12)',
                          borderRadius: 11, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 22 }}>🛡️</span>
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>Gate Console</div>
              <div style={{ fontSize: 12.5, color: '#94a3b8' }}>
                Log a visitor, scan a pass, record a delivery
              </div>
            </div>
            <div style={{ color: '#94a3b8', fontSize: 20 }}>›</div>
          </button>
        )}

        {/* Outstanding bills banner */}
        {config.feature_bills && config.can('dues_my_bills') && pendingBills.length > 0 && (
          <button
            onClick={() => navigate('/dues/my-bills')}
            style={{
              width: '100%', padding: '14px 16px', background: '#fff',
              border: `1.5px solid ${accentColor}22`, borderRadius: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ width: 40, height: 40, background: `${accentColor}18`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 20 }}>🧾</span>
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: 12, color: '#64748b' }}>{pendingBills.length} pending bill{pendingBills.length > 1 ? 's' : ''}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#dc2626' }}>{fmtAmt(pendingAmount)} due</div>
            </div>
            <div style={{ color: accentColor, fontSize: 18 }}>›</div>
          </button>
        )}

        {/* Quick actions — all shown to all users based on feature flags only */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
          {config.feature_bills && config.can('dues_my_bills') && (
            <ActionCard icon="💳" label="Bills" sublabel={pendingBills.length ? `${pendingBills.length} pending` : 'All clear'} color="#1d4ed8" bg="#eff6ff" onClick={() => navigate('/mobile/bills')} badge={pendingBills.length} />
          )}
          {/* No feature_ flag for this one — Statement isn't an association-level
              on/off switch like Bills or Announcements, only a per-role menu
              item, so config.can() alone is the right gate. */}
          {config.can('dues_my_statement') && (
            <ActionCard icon="📄" label="Statement" sublabel="Charges & payments" color="#0ea5e9" bg="#f0f9ff" onClick={() => navigate('/mobile/statement')} />
          )}
          {config.feature_complaints && config.can('maintenance_list') && (
            <ActionCard
              icon="🔧"
              label="Service"
              sublabel={openTickets > 0 ? `${openTickets} open${isManager ? ' (all)' : ''}` : 'No open requests'}
              color="#7c3aed"
              bg="#f5f3ff"
              onClick={() => navigate('/maintenance')}
              badge={openTickets}
            />
          )}
          {announcementsVisible && (
            <ActionCard
              icon="📢" label="Announcements"
              sublabel={unreadAnnouncements > 0 ? `${unreadAnnouncements} new` : 'All caught up'}
              color="#b45309" bg="#fffbeb" onClick={() => navigate('/announcements')}
              badge={unreadAnnouncements}
            />
          )}
          {visitorsVisible && (
            <ActionCard
              icon="🚪" label="Visitors"
              sublabel={pendingVisitorRequests > 0 ? `${pendingVisitorRequests} pending` : 'Gate & pre-approvals'}
              color="#15803d" bg="#f0fdf4" onClick={() => navigate('/mobile/visitors')}
              badge={pendingVisitorRequests}
            />
          )}
          {chatVisible && (
            <ActionCard
              icon="💬" label="Chat"
              sublabel={chatUnread > 0 ? `${chatUnread} unread` : 'Message residents'}
              color="#4f46e5" bg="#eef2ff" onClick={() => navigate('/mobile/chat')}
              badge={chatUnread}
            />
          )}
        </div>

        {/* Pending service requests */}
        {config.feature_complaints && config.can('maintenance_list') && openTickets > 0 && (
          <button
            onClick={() => navigate('/maintenance')}
            style={{
              width: '100%', padding: '12px 16px', background: '#fff', border: 'none', borderRadius: 12,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            }}
          >
            <span style={{ fontSize: 22 }}>🔧</span>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>Service Requests</div>
              <div style={{ fontSize: 12, color: '#f59e0b' }}>
                {openTickets} open request{openTickets > 1 ? 's' : ''}{isManager ? ' — tap to manage' : ''}
              </div>
            </div>
            <div style={{ color: '#94a3b8', fontSize: 18 }}>›</div>
          </button>
        )}
      </div>
    </div>
  );
}
