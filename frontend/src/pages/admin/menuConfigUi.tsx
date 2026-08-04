import { CSSProperties } from 'react';

/**
 * Shared chrome for the two menu-configuration screens.
 *
 * Web Menu by Role and Mobile Menu by Role do the same job for two surfaces,
 * so they should not merely look similar — they should be the same controls.
 * Duplicating the role tabs was how the two screens would drift apart the
 * first time either was touched.
 */

export const ROLE_LABEL: Record<string, string> = {
  SUPER_USER: 'Super User',
  MANAGER:    'Manager',
  TREASURER:  'Treasurer',
  COMMITTEE:  'Committee',
  RESIDENT:   'Resident',
  GATE_STAFF: 'Gate Staff',
};

// Ordered by how often they are configured, not alphabetically.
const ROLE_ORDER = ['RESIDENT', 'COMMITTEE', 'TREASURER', 'MANAGER', 'GATE_STAFF', 'SUPER_USER'];

export const orderRoles = (roles: string[]) =>
  [...roles].sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));

export const pageBtn: CSSProperties = {
  padding: '6px 12px', borderRadius: 8, border: '1px solid #cbd5e1',
  background: '#fff', color: '#334155', fontSize: 13, cursor: 'pointer',
  fontWeight: 600,
};

export const roleTab = (active: boolean): CSSProperties => ({
  padding: '6px 13px', borderRadius: 99, border: 'none', cursor: 'pointer',
  fontSize: 13, fontWeight: active ? 700 : 500,
  background: active ? '#1e293b' : '#f1f5f9',
  color: active ? '#fff' : '#64748b',
});

const labelStyle: CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#64748b',
  display: 'block', marginBottom: 4,
};

/**
 * A super user picks the association. A manager gets their own, shown as
 * static text rather than a disabled dropdown — a dropdown with one option
 * invites the question "where are the others?", which is not a question a
 * manager should be asked to think about.
 */
export function AssociationPicker({
  isSuper, associations, value, onChange,
}: {
  isSuper: boolean;
  associations: Array<{ id: string; name: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  if (!isSuper) {
    return (
      <div style={{ flex: '1 1 240px' }}>
        <label style={labelStyle}>Association</label>
        <div style={{ padding: '7px 0', fontSize: 13.5, fontWeight: 600, color: '#1e293b' }}>
          Your association
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: '1 1 240px' }}>
      <label style={labelStyle}>Association</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '7px 10px', borderRadius: 8,
                 border: '1px solid #cbd5e1', fontSize: 13.5 }}>
        {associations.map(a => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
    </div>
  );
}
