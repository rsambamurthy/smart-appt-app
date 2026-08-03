import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { IS_NATIVE } from '../../hooks/usePlatform';
import { clearCredentials } from '../../features/auth/authSlice';
import { useLogoutMutation } from '../../store/api/authApi';
import { baseApi } from '../../store/api/baseApi';

export interface Crumb {
  label: string;
  path?: string;
}

export interface Step {
  label: string;
  status: 'done' | 'active' | 'pending';
}

interface Props {
  crumbs: Crumb[];
  steps?: Step[];
  onSave?: () => void;
  onCancel?: () => void;
  onSubmit?: () => void;
  saveLabel?: string;
  submitLabel?: string;
  saving?: boolean;
}

export default function PageSubHeader({
  crumbs,
  steps,
  onSave,
  onCancel,
  onSubmit,
  saveLabel = 'Save',
  submitLabel = 'Submit',
  saving,
}: Props) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [logout] = useLogoutMutation();

  // On the web the sidebar header carries Logout. Native drops that whole
  // chrome — Layout returns bare children — so without this the only way out
  // of the app is the More tab, which is not where anyone looks for it.
  const handleLogout = async () => {
    try { await logout(undefined).unwrap(); } catch { /* signing out locally regardless */ }
    dispatch(clearCredentials());
    dispatch(baseApi.util.resetApiState());
    navigate('/login', { replace: true });
  };

  return (
    <div className="ent-subhdr">
      {/* Breadcrumbs */}
      <div className="ent-bc">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="ent-bc-sep">›</span>}
            {c.path
              ? <Link to={c.path} className="ent-bc-link">{c.label}</Link>
              : <span className="ent-bc-cur">{c.label}</span>}
          </React.Fragment>
        ))}
      </div>

      {/* Stepper */}
      {steps && steps.length > 0 && (
        <div className="ent-stepper">
          {steps.map((s, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="ent-step-arr">›</span>}
              <div className={`ent-step ent-step-${s.status}`}>
                {s.status === 'done' && '✓ '}
                {s.label}
              </div>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="ent-acts">
        {onCancel && (
          <button className="ent-btn-cancel" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        )}
        {onSave && (
          <button className="ent-btn-save" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : saveLabel}
          </button>
        )}
        {onSubmit && (
          <button className="ent-btn-submit" onClick={onSubmit} disabled={saving}>
            {submitLabel}
          </button>
        )}

        {/* Native only — the web header already has one. */}
        {IS_NATIVE && (
          <button
            onClick={handleLogout}
            title="Logout"
            aria-label="Logout"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 18, lineHeight: 1, padding: '6px 4px 6px 10px',
              color: '#64748b', minHeight: 40, minWidth: 40,
            }}
          >
            🚪
          </button>
        )}
      </div>
    </div>
  );
}
