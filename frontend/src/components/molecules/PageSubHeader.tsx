import React from 'react';
import { Link } from 'react-router-dom';

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
      </div>
    </div>
  );
}
