import { useNavigate } from 'react-router-dom';
import { useMobileConfig } from '../../contexts/MobileConfigContext';

interface HubCardProps {
  icon: string;
  title: string;
  description: string;
  accentColor: string;
  onClick: () => void;
}

function HubCard({ icon, title, description, accentColor, onClick }: HubCardProps) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', padding: '20px', background: '#fff',
        border: `1px solid #e2e8f0`, borderRadius: 14, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 16, textAlign: 'left',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 12,
        transition: 'opacity 0.15s',
      }}
    >
      <div style={{
        width: 52, height: 52, borderRadius: 14, flexShrink: 0,
        background: `${accentColor}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#64748b' }}>{description}</div>
      </div>
      <div style={{ color: '#cbd5e1', fontSize: 20 }}>›</div>
    </button>
  );
}

// All roles see the same visitor hub on mobile — no role branching
export default function MobileVisitorsPage() {
  const navigate = useNavigate();
  const config = useMobileConfig();
  const accentColor = config.theme_color ?? '#0095db';

  return (
    <div style={{ minHeight: '100%', background: '#f1f5f9' }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}cc 100%)`,
        padding: '52px 20px 24px',
        paddingTop: 'max(52px, calc(env(safe-area-inset-top) + 20px))',
      }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>Visitors</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
          Manage gate activity and pre-approvals
        </div>
      </div>

      <div style={{ padding: '20px 16px' }}>
        <HubCard
          icon="📋"
          title="Visitor Dashboard"
          description="View all visitor activity and gate log"
          accentColor={accentColor}
          onClick={() => navigate('/mobile/visitors/log')}
        />
        <HubCard
          icon="✅"
          title="Pre-Approvals"
          description="Pre-approve expected visitors and manage frequent guests"
          accentColor={accentColor}
          onClick={() => navigate('/mobile/visitors/preapprove')}
        />
      </div>
    </div>
  );
}
