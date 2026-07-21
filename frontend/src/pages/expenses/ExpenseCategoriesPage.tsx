import { useState } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useListExpenseCategoriesQuery,
  useCreateExpenseCategoryMutation,
  useUpdateExpenseCategoryMutation,
  useDeleteExpenseCategoryMutation,
} from '../../store/api/expensesApi';

const PRESET_COLORS = [
  '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6',
  '#ef4444', '#6b7280', '#ec4899', '#9ca3af',
  '#f97316', '#14b8a6', '#a855f7', '#84cc16',
];

interface Category {
  id: string; name: string; display_name: string;
  color: string; is_active: boolean; sort_order: number;
}

interface CatForm { display_name: string; color: string; name: string }

const emptyForm = (): CatForm => ({ display_name: '', name: '', color: '#6b7280' });

export default function ExpenseCategoriesPage() {
  const { data, isLoading } = useListExpenseCategoriesQuery();
  const categories = (data?.data ?? []) as Category[];

  const [createCategory, { isLoading: isCreating }] = useCreateExpenseCategoryMutation();
  const [updateCategory, { isLoading: isUpdating }] = useUpdateExpenseCategoryMutation();
  const [deleteCategory] = useDeleteExpenseCategoryMutation();

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<CatForm>(emptyForm());
  const [addError, setAddError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<CatForm>>({});
  const [editError, setEditError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteError, setDeleteError] = useState('');

  // ── Add ──────────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    setAddError('');
    if (!addForm.name.trim()) { setAddError('Internal name is required.'); return; }
    if (!addForm.display_name.trim()) { setAddError('Display name is required.'); return; }
    try {
      await createCategory({
        name: addForm.name.trim().toUpperCase().replace(/\s+/g, '_'),
        display_name: addForm.display_name.trim(),
        color: addForm.color,
        sort_order: categories.length,
      }).unwrap();
      setAddForm(emptyForm());
      setShowAdd(false);
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } };
      setAddError(err?.data?.message ?? 'Failed to create category.');
    }
  };

  // ── Edit ─────────────────────────────────────────────────────────────────────
  const startEdit = (c: Category) => {
    setEditingId(c.id);
    setEditForm({ display_name: c.display_name, color: c.color });
    setEditError('');
  };
  const cancelEdit = () => { setEditingId(null); setEditError(''); };

  const handleSaveEdit = async (id: string) => {
    setEditError('');
    if (!editForm.display_name?.trim()) { setEditError('Display name required.'); return; }
    try {
      await updateCategory({ id, body: editForm }).unwrap();
      setEditingId(null);
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } };
      setEditError(err?.data?.message ?? 'Failed to update.');
    }
  };

  // ── Toggle active ─────────────────────────────────────────────────────────────
  const toggleActive = async (c: Category) => {
    await updateCategory({ id: c.id, body: { is_active: !c.is_active } }).unwrap();
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError('');
    try {
      await deleteCategory(deleteTarget.id).unwrap();
      setDeleteTarget(null);
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } };
      setDeleteError(err?.data?.message ?? 'Cannot delete category.');
    }
  };

  const isSaving = isCreating || isUpdating;

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Expenses', to: '/expenses' }, { label: 'Expense Categories' }]} />

      <div style={{ padding: '1.5rem 2rem', maxWidth: 720 }}>

        {/* Info note */}
        <div style={{ padding: '0.7rem 1rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: '0.85rem', color: '#1d4ed8', marginBottom: '1.25rem' }}>
          Categories configured here appear in the expense form and reports. Deactivated categories are hidden from new entries but preserved on existing records.
        </div>

        {/* Categories list */}
        <div className="ent-section" style={{ marginBottom: '1.25rem' }}>
          <div className="ent-section-hdr" style={{ justifyContent: 'space-between' }}>
            <span className="ent-section-title">Expense Categories ({categories.filter((c) => c.is_active).length} active)</span>
            <button className="ent-btn-submit" style={{ padding: '4px 14px', fontSize: '0.8rem' }} onClick={() => { setShowAdd(true); setAddError(''); setAddForm(emptyForm()); }}>
              + Add Category
            </button>
          </div>

          {isLoading ? (
            <div style={{ padding: '2rem', color: 'var(--color-muted)', textAlign: 'center' }}>Loading…</div>
          ) : (
            <div>
              {categories.map((cat) => {
                const isEditing = editingId === cat.id;
                return (
                  <div key={cat.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--color-border)',
                    opacity: cat.is_active ? 1 : 0.5,
                  }}>
                    {/* Color dot */}
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: isEditing ? (editForm.color ?? cat.color) : cat.color, flexShrink: 0 }} />

                    {isEditing ? (
                      /* Edit row */
                      <div style={{ flex: 1, display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          className="ent-fc"
                          style={{ flex: '1 1 160px' }}
                          placeholder="Display name"
                          value={editForm.display_name ?? ''}
                          onChange={(e) => setEditForm((f) => ({ ...f, display_name: e.target.value }))}
                        />
                        {/* Color swatches */}
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {PRESET_COLORS.map((c) => (
                            <button key={c} onClick={() => setEditForm((f) => ({ ...f, color: c }))}
                              style={{ width: 18, height: 18, borderRadius: '50%', background: c, border: editForm.color === c ? '2px solid #1d4ed8' : '2px solid transparent', cursor: 'pointer' }} />
                          ))}
                        </div>
                        {editError && <span style={{ color: '#dc2626', fontSize: '0.8rem', width: '100%' }}>{editError}</span>}
                        <button className="ent-btn-submit" style={{ padding: '3px 12px', fontSize: '0.8rem' }} onClick={() => handleSaveEdit(cat.id)} disabled={isSaving}>Save</button>
                        <button className="ent-btn-cancel" style={{ padding: '3px 10px', fontSize: '0.8rem' }} onClick={cancelEdit}>Cancel</button>
                      </div>
                    ) : (
                      /* Display row */
                      <>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{cat.display_name}</span>
                          <span style={{ marginLeft: 8, fontSize: '0.78rem', color: 'var(--color-muted)', fontFamily: 'monospace' }}>{cat.name}</span>
                        </div>
                        <span style={{
                          fontSize: '0.75rem', fontWeight: 600, padding: '1px 7px', borderRadius: 4,
                          background: cat.is_active ? '#f0fdf4' : '#f1f5f9',
                          color: cat.is_active ? '#16a34a' : '#64748b',
                        }}>
                          {cat.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <button className="ent-ia ent-ia-edit" title="Edit" onClick={() => startEdit(cat)}>✎</button>
                        <button
                          title={cat.is_active ? 'Deactivate' : 'Activate'}
                          onClick={() => toggleActive(cat)}
                          style={{ padding: '3px 8px', fontSize: '0.75rem', borderRadius: 4, cursor: 'pointer', border: '1px solid var(--color-border)', background: '#f9fafb', color: 'var(--color-muted)', fontWeight: 600 }}
                        >
                          {cat.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button className="ent-ia ent-ia-del" title="Delete" onClick={() => { setDeleteTarget(cat); setDeleteError(''); }}>🗑</button>
                      </>
                    )}
                  </div>
                );
              })}
              {categories.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.875rem' }}>No categories yet.</div>
              )}
            </div>
          )}
        </div>

        {/* Add category form */}
        {showAdd && (
          <div className="ent-section">
            <div className="ent-section-hdr"><span className="ent-section-title">New Category</span></div>
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="ent-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="ent-fg">
                  <label className="ent-fl">Display Name * <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}>(shown in UI)</span></label>
                  <input className="ent-fc" type="text" placeholder="e.g. Generator Fuel" value={addForm.display_name}
                    onChange={(e) => setAddForm((f) => ({ ...f, display_name: e.target.value }))} />
                </div>
                <div className="ent-fg">
                  <label className="ent-fl">Internal Name * <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}>(used in filters)</span></label>
                  <input className="ent-fc" type="text" placeholder="e.g. GENERATOR_FUEL" value={addForm.name}
                    onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value.toUpperCase().replace(/\s+/g, '_') }))} />
                </div>
              </div>

              <div className="ent-fg">
                <label className="ent-fl">Color</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {PRESET_COLORS.map((c) => (
                    <button key={c} onClick={() => setAddForm((f) => ({ ...f, color: c }))}
                      style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: addForm.color === c ? '3px solid #1d4ed8' : '2px solid transparent', cursor: 'pointer' }} />
                  ))}
                  <div style={{ width: 8, height: 22, background: addForm.color, borderRadius: 3, marginLeft: 4, border: '1px solid var(--color-border)' }} />
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Selected: {addForm.color}</span>
                </div>
              </div>

              {addError && (
                <div style={{ padding: '0.6rem 0.9rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, color: '#dc2626', fontSize: '0.85rem' }}>{addError}</div>
              )}

              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button className="ent-btn-submit" onClick={handleAdd} disabled={isCreating}>{isCreating ? 'Adding…' : 'Add Category'}</button>
                <button className="ent-btn-cancel" onClick={() => { setShowAdd(false); setAddError(''); }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirm */}
      {deleteTarget && (
        <>
          <div onClick={() => setDeleteTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 8, padding: '1.5rem', width: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 201 }}>
            <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Delete Category?</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginBottom: '1rem' }}>
              <strong>{deleteTarget.display_name}</strong><br />
              Expenses already using this category will retain their values. You can only delete if no active expenses use this category.
            </div>
            {deleteError && (
              <div style={{ padding: '0.6rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, color: '#dc2626', fontSize: '0.85rem', marginBottom: '1rem' }}>{deleteError}</div>
            )}
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button className="ent-btn-submit" style={{ background: '#dc2626', flex: 1 }} onClick={handleDelete}>Delete</button>
              <button className="ent-btn-cancel" style={{ flex: 1 }} onClick={() => { setDeleteTarget(null); setDeleteError(''); }}>Cancel</button>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
