import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useListUnitsQuery,
  useListUsersQuery,
  useUpdateUnitMutation,
  useUpdateUserMutation,
  useDeactivateUserMutation,
  useInviteUserMutation,
} from '../../store/api/usersApi';

// ─── Types ────────────────────────────────────────────────────────────────────

type UnitRecord = {
  id: string;
  flat_number: string;
  block?: string;
  floor: number;
  area_sqft?: number | string;
  unit_type?: string;
  users: ResidentRecord[];
};

type ResidentRecord = {
  id: string;
  name: string;
  phone: string;
  role: string;
  is_owner: boolean;
  is_active: boolean;
};

type UnitForm = {
  flat_number: string;
  block: string;
  floor: string;
  area_sqft: string;
  unit_type: string;
};

type InviteForm = {
  phone: string;
  role: string;
};

const ROLES = ['MANAGER', 'RESIDENT', 'COMMITTEE', 'TREASURER', 'GATE_STAFF'] as const;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UnitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const authUser = useSelector((s: RootState) => s.auth.user);

  // Data
  const { data: unitsData, isFetching: loadingUnit } = useListUnitsQuery();
  const { data: usersData, isFetching: loadingUsers, refetch: refetchUsers } = useListUsersQuery(
    id ? { unit_id: id } : {},
    { skip: !id }
  );

  const units = (unitsData?.data ?? []) as UnitRecord[];
  const unit = units.find((u) => u.id === id);
  const residents = (usersData?.data ?? []) as ResidentRecord[];

  // Mutations
  const [updateUnit, { isLoading: savingUnit }] = useUpdateUnitMutation();
  const [updateUser] = useUpdateUserMutation();
  const [deactivateUser] = useDeactivateUserMutation();
  const [inviteUser, { isLoading: inviting }] = useInviteUserMutation();

  // Collapsible state
  const [unitDetailsOpen, setUnitDetailsOpen] = useState(true);
  const [residentsOpen, setResidentsOpen] = useState(true);

  // Unit edit form
  const [unitForm, setUnitForm] = useState<UnitForm>({
    flat_number: '', block: '', floor: '0', area_sqft: '', unit_type: '',
  });
  const [unitSaved, setUnitSaved] = useState(false);
  const [unitError, setUnitError] = useState('');

  // Invite panel
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteForm>({ phone: '', role: 'RESIDENT' });
  const [inviteError, setInviteError] = useState('');

  // Sync form when unit loads
  useEffect(() => {
    if (unit) {
      setUnitForm({
        flat_number: unit.flat_number,
        block: unit.block ?? '',
        floor: String(unit.floor),
        area_sqft: unit.area_sqft ? String(unit.area_sqft) : '',
        unit_type: unit.unit_type ?? '',
      });
    }
  }, [unit]);

  const unitLabel = unit
    ? `${unit.block ? unit.block + '-' : ''}${unit.flat_number}`
    : 'Unit';

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSaveUnit = async () => {
    if (!unit) return;
    setUnitError('');
    try {
      await updateUnit({
        id: unit.id,
        body: {
          flat_number: unitForm.flat_number,
          block: unitForm.block || undefined,
          floor: parseInt(unitForm.floor, 10),
          area_sqft: unitForm.area_sqft ? parseFloat(unitForm.area_sqft) : undefined,
          unit_type: unitForm.unit_type || undefined,
        },
      }).unwrap();
      setUnitSaved(true);
      setTimeout(() => setUnitSaved(false), 2000);
    } catch (err: unknown) {
      setUnitError((err as { data?: { detail?: string } })?.data?.detail ?? 'Save failed.');
    }
  };

  const handleRemoveResident = async (userId: string) => {
    try {
      await updateUser({ id: userId, body: { unit_id: null } }).unwrap();
      refetchUsers();
    } catch { /* ignore */ }
  };

  const handleDeactivate = async (userId: string) => {
    try {
      await deactivateUser(userId).unwrap();
      refetchUsers();
    } catch { /* ignore */ }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    try {
      await inviteUser({ phone: inviteForm.phone, role: inviteForm.role, unit_id: id }).unwrap();
      setShowInvite(false);
      setInviteForm({ phone: '', role: 'RESIDENT' });
    } catch (err: unknown) {
      setInviteError((err as { data?: { detail?: string } })?.data?.detail ?? 'Invite failed.');
    }
  };

  // ── Stepper ───────────────────────────────────────────────────────────────

  const steps = [
    { label: 'Unit Info', status: 'done' as const },
    { label: 'Residents', status: 'active' as const },
    { label: 'Review', status: 'pending' as const },
    { label: 'Confirm', status: 'pending' as const },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  if (!loadingUnit && !unit) {
    return (
      <Layout>
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-muted)' }}>
          Unit not found.{' '}
          <button className="ent-btn-cancel" onClick={() => navigate('/admin/units')}>
            Back to Units
          </button>
        </div>
      </Layout>
    );
  }

  const occupied = residents.length > 0;

  return (
    <Layout>
      {/* Sub-header */}
      <PageSubHeader
        crumbs={[
          { label: 'Admin', path: '/dashboard' },
          { label: 'Units', path: '/admin/users' },
          { label: unitLabel },
        ]}
        steps={steps}
        onCancel={() => navigate('/admin/users')}
        onSave={handleSaveUnit}
        onSubmit={() => navigate('/admin/users')}
        saveLabel={unitSaved ? '✓ Saved' : 'Save'}
        submitLabel="Done"
        saving={savingUnit}
      />

      {/* Meta bar */}
      <div className="ent-meta">
        <div>
          <div className="ent-meta-label">Unit</div>
          <div className="ent-meta-value">{unitLabel}</div>
        </div>
        <div>
          <div className="ent-meta-label">Association</div>
          <div className="ent-meta-value">
            <a href="#">{authUser?.name ? 'My Association' : '—'}</a>
          </div>
        </div>
        <div>
          <div className="ent-meta-label">Unit Type</div>
          <div className="ent-meta-value">{unit?.unit_type ?? '—'}</div>
        </div>
        <div>
          <div className="ent-meta-label">Status</div>
          <div className="ent-meta-value">
            {occupied
              ? <span className="ent-status-active">● Occupied</span>
              : <span className="ent-status-vacant">● Vacant</span>}
          </div>
        </div>
      </div>

      {/* Unit Residents section */}
      <div className="ent-section">
        <div className="ent-section-hdr">
          <span className="ent-section-title">Unit Residents</span>
          <button
            className="ent-collapse-btn"
            onClick={() => setResidentsOpen((o) => !o)}
            title={residentsOpen ? 'Collapse' : 'Expand'}
          >
            {residentsOpen ? '−' : '+'}
          </button>
        </div>

        {residentsOpen && (
          <>
            {/* Split: Current Residents | Pending Invites */}
            <div className="ent-split">
              {/* Left: Current Residents */}
              <div className="ent-pane">
                <div className="ent-pane-hdr">
                  <span className="ent-pane-title">Current Residents</span>
                  <button
                    className="ent-add-btn"
                    title="Add resident"
                    onClick={() => navigate(`/admin/users?unit_id=${id}`)}
                  >+</button>
                </div>
                {loadingUsers ? (
                  <div className="skeleton" style={{ height: 60, borderRadius: 0 }} />
                ) : residents.length === 0 ? (
                  <div className="ent-empty">No residents assigned to this unit.</div>
                ) : (
                  <table className="ent-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {residents.map((r) => (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 500 }}>{r.name}</td>
                          <td style={{ color: 'var(--color-muted)' }}>
                            {r.is_owner ? 'Owner' : 'Tenant'}
                          </td>
                          <td>
                            <span className={r.is_active ? 'ent-status-active' : 'ent-status-vacant'}>
                              {r.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 3 }}>
                              <button
                                className="ent-ia ent-ia-edit"
                                title="Edit user"
                                onClick={() => navigate(`/admin/users`)}
                              >✎</button>
                              <button
                                className="ent-ia ent-ia-del"
                                title="Remove from unit"
                                onClick={() => handleRemoveResident(r.id)}
                              >✕</button>
                              {r.is_active && (
                                <button
                                  className="ent-ia ent-ia-del"
                                  title="Deactivate"
                                  onClick={() => handleDeactivate(r.id)}
                                >⊗</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Right: Pending Invites */}
              <div className="ent-pane">
                <div className="ent-pane-hdr">
                  <span className="ent-pane-title">Pending Invites</span>
                  <button
                    className="ent-add-btn"
                    title="Send invite"
                    onClick={() => setShowInvite(true)}
                  >+</button>
                </div>

                {/* Inline invite form */}
                {showInvite && (
                  <form
                    onSubmit={handleInvite}
                    style={{
                      background: '#f8fafd', border: '1px solid var(--color-border)',
                      borderTop: 'none', padding: '10px', display: 'flex', flexDirection: 'column', gap: 6,
                    }}
                  >
                    {inviteError && (
                      <div style={{ color: '#991b1b', fontSize: 11, background: '#fee2e2', padding: '4px 8px', borderRadius: 4 }}>
                        {inviteError}
                      </div>
                    )}
                    <input
                      className="ent-fc"
                      placeholder="+91 phone number"
                      value={inviteForm.phone}
                      onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
                      required
                    />
                    <select
                      className="ent-fc"
                      value={inviteForm.role}
                      onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="submit" className="ent-btn-save" style={{ flex: 1 }} disabled={inviting}>
                        {inviting ? 'Sending…' : 'Send Invite'}
                      </button>
                      <button type="button" className="ent-btn-cancel" onClick={() => setShowInvite(false)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {/* No invites table (pending invites endpoint not yet available) */}
                <div className="ent-empty" style={{ borderRadius: showInvite ? 0 : undefined }}>
                  No pending invites for this unit.
                </div>
              </div>
            </div>

            {/* Unit Details collapsible */}
            <div className="ent-coll">
              <button
                className={`ent-coll-hdr${unitDetailsOpen ? ' open' : ''}`}
                onClick={() => setUnitDetailsOpen((o) => !o)}
              >
                <span style={{ color: 'var(--theme-accent)', fontSize: 13 }}>🏢</span>
                <span className="ent-coll-title">Unit Details</span>
                <span className="ent-coll-arr">▼</span>
              </button>

              {unitDetailsOpen && (
                <div className="ent-coll-body">
                  {unitError && (
                    <div style={{ color: '#991b1b', fontSize: 12, background: '#fee2e2', padding: '6px 10px', borderRadius: 4, marginBottom: 10 }}>
                      {unitError}
                    </div>
                  )}
                  <div className="ent-form-grid">
                    <div className="ent-fg">
                      <div className="ent-fl">Flat Number</div>
                      <input
                        className="ent-fc"
                        placeholder="e.g. A-101"
                        value={unitForm.flat_number}
                        onChange={(e) => setUnitForm({ ...unitForm, flat_number: e.target.value })}
                      />
                    </div>
                    <div className="ent-fg">
                      <div className="ent-fl">Block</div>
                      <input
                        className="ent-fc"
                        placeholder="e.g. A"
                        value={unitForm.block}
                        onChange={(e) => setUnitForm({ ...unitForm, block: e.target.value })}
                      />
                    </div>
                    <div className="ent-fg">
                      <div className="ent-fl">Floor</div>
                      <input
                        className="ent-fc"
                        type="number"
                        min={0}
                        value={unitForm.floor}
                        onChange={(e) => setUnitForm({ ...unitForm, floor: e.target.value })}
                      />
                    </div>
                    <div className="ent-fg">
                      <div className="ent-fl">Unit Type</div>
                      <input
                        className="ent-fc"
                        placeholder="e.g. 2BHK"
                        value={unitForm.unit_type}
                        onChange={(e) => setUnitForm({ ...unitForm, unit_type: e.target.value })}
                      />
                    </div>
                    <div className="ent-fg">
                      <div className="ent-fl">Area (sqft)</div>
                      <input
                        className="ent-fc"
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="optional"
                        value={unitForm.area_sqft}
                        onChange={(e) => setUnitForm({ ...unitForm, area_sqft: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Add Unit button */}
      <button
        className="ent-add-row"
        onClick={() => navigate('/admin/users?tab=units')}
      >
        + Add Unit
      </button>
    </Layout>
  );
}
