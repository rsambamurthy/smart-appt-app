import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { useMobileConfig } from '../../contexts/MobileConfigContext';
import { useListMyBillsQuery } from '../../store/api/duesApi';
import { useListAnnouncementsQuery } from '../../store/api/announcementsApi';
import { useListTicketsQuery } from '../../store/api/maintenanceApi';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtAmt = (n: number) =>
  `₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// ── Quick-action card ─────────────────────────────────────────────────────────

function ActionCard({
  icon, label, sublabel, color, bg, onClick,
}: { icon: string; label: string; sublabel: string; color: string; bg: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, minWidth: 'calc(50% - 6px)', padding: '14px 12px',
        background: bg, border: 'none', borderRadius: 12, cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
        textAlign: 'left', transition: 'opacity 0.15s',
      }}
    >
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

  // Data — no role filtering; feature flags from MobileConfig control what's fetched
  const { data: billsData } = useListMyBillsQuery({ limit: 10 }, { skip: !config.feature_bills });
  const { data: announcementsData } = useListAnnouncementsQuery({ limit: 3 }, { skip: !config.feature_announcements });
  const { data: ticketsData } = useListTicketsQuery({ limit: 10 }, { skip: !config.feature_complaints });

  type Bill = { id: string; status: string; total_amount: number; period_month: number; period_year: number };
  type Announcement = { id: string; title: string; created_at: string; type?: string };
  type Ticket = { id: string; status: string };

  const bills = (billsData?.data ?? []) as Bill[];
  const announcements = (announcementsData?.data ?? []) as Announcement[];
  const tickets = (ticketsData?.data ?? []) as Ticket[];

  const pendingBills = bills.filter((b) => b.status !== 'PAID');
  const pendingAmount = pendingBills.reduce((s, b) => s + Number(b.total_amount), 0);
  const openTickets = tickets.filter((t) => !['RESOLVED', 'CLOSED'].includes(t.status)).length;

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const accentColor = config.theme_color ?? '#0095db';

  return (
    <div style={{ minHeight: '100%', background: '#f1f5f9' }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}cc 100%)`,
        padding: '52px 20px 24px',
        paddingTop: 'max(52px, calc(env(safe-area-inset-top) + 20px))',
      }}>
        {config.logo_url && (
          <img src={config.logo_url} alt="Logo" style={{ height: 36, objectFit: 'contain', marginBottom: 10, display: 'block' }} />
        )}
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', marginBottom: 2 }}>{greeting},</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{user?.name ?? 'Resident'}</div>
        {config.app_name && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>{config.app_name}</div>
        )}
      </div>

      <div style={{ padding: '16px 16px 0' }}>

        {/* Outstanding bills banner */}
        {config.feature_bills && pendingBills.length > 0 && (
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
          {config.feature_bills && (
            <ActionCard icon="💳" label="Bills" sublabel={pendingBills.length ? `${pendingBills.length} pending` : 'All clear'} color="#1d4ed8" bg="#eff6ff" onClick={() => navigate('/mobile/bills')} />
          )}
          {config.feature_complaints && (
            <ActionCard icon="🔧" label="Service" sublabel={openTickets > 0 ? `${openTickets} open` : 'No open requests'} color="#7c3aed" bg="#f5f3ff" onClick={() => navigate('/maintenance')} />
          )}
          {config.feature_announcements && (
            <ActionCard icon="📢" label="Announcements" sublabel={`${announcements.length} recent`} color="#b45309" bg="#fffbeb" onClick={() => navigate('/announcements')} />
          )}
          {config.feature_visitors && (
            <ActionCard icon="🚪" label="Visitors" sublabel="Gate & pre-approvals" color="#15803d" bg="#f0fdf4" onClick={() => navigate('/mobile/visitors')} />
          )}
        </div>

        {/* Recent announcements */}
        {config.feature_announcements && announcements.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>Recent Announcements</span>
              <button onClick={() => navigate('/announcements')} style={{ background: 'none', border: 'none', fontSize: 12, color: accentColor, cursor: 'pointer', fontWeight: 600 }}>See all ›</button>
            </div>
            {announcements.slice(0, 3).map((a, i) => (
              <div key={a.id} style={{ padding: '10px 16px', borderBottom: i < Math.min(announcements.length, 3) - 1 ? '1px solid #f8fafc' : undefined }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b', marginBottom: 2 }}>{a.title}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{fmtDate(a.created_at)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Pending service requests */}
        {config.feature_complaints && openTickets > 0 && (
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
              <div style={{ fontSize: 12, color: '#f59e0b' }}>{openTickets} open request{openTickets > 1 ? 's' : ''}</div>
            </div>
            <div style={{ color: '#94a3b8', fontSize: 18 }}>›</div>
          </button>
        )}
      </div>
    </div>
  );
}
