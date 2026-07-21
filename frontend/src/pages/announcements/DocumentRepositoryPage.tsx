import { useState, useRef } from 'react';
import { useSelector, useStore } from 'react-redux';
import type { RootState } from '../../store';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import { useListDocumentsQuery, useUploadDocumentMutation, useDeactivateDocumentMutation } from '../../store/api/announcementsApi';

// ── Constants ─────────────────────────────────────────────────────────────────

const DOC_CATEGORIES = [
  { id: 'BYE_LAWS',      label: 'Bye-Laws',       color: '#1d4ed8', bg: '#eff6ff' },
  { id: 'AGREEMENT',     label: 'Agreement',       color: '#15803d', bg: '#f0fdf4' },
  { id: 'INSURANCE',     label: 'Insurance',       color: '#b45309', bg: '#fffbeb' },
  { id: 'MINUTES',       label: 'Minutes',         color: '#7c3aed', bg: '#fdf4ff' },
  { id: 'ANNUAL_REPORT', label: 'Annual Report',   color: '#0e7490', bg: '#ecfeff' },
  { id: 'OTHERS',        label: 'Others',          color: '#64748b', bg: '#f1f5f9' },
];

const UPLOAD_ROLES = ['MANAGER', 'COMMITTEE', 'SUPER_USER'];

interface Doc {
  id: string;
  title: string;
  category: string;
  version: number;
  file_name?: string;
  created_at: string;
  uploader?: { name: string };
}

// ── File icon by extension ────────────────────────────────────────────────────
function fileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (['pdf'].includes(ext)) return '📄';
  if (['doc', 'docx'].includes(ext)) return '📝';
  if (['xls', 'xlsx'].includes(ext)) return '📊';
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return '🖼️';
  return '📁';
}

function catInfo(id: string) {
  return DOC_CATEGORIES.find((c) => c.id === id) ?? { label: id, color: '#64748b', bg: '#f1f5f9' };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Download button — authenticated fetch → blob → browser download ───────────
function DownloadButton({ docId, fileName }: { docId: string; fileName?: string }) {
  const [loading, setLoading] = useState(false);
  const store = useStore<RootState>();

  const handleClick = async () => {
    setLoading(true);
    try {
      const token = store.getState().auth.access_token;
      const res = await fetch(`/api/v1/announcements/documents/${docId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { alert('Download failed.'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName ?? 'document';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        padding: '5px 12px', fontSize: '0.78rem', fontWeight: 600,
        border: '1px solid var(--color-border)', borderRadius: 6,
        background: '#f8fafc', color: 'var(--color-text)', cursor: loading ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', gap: 5, opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? '…' : '⬇ Download'}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DocumentRepositoryPage() {
  const role = useSelector((s: RootState) => s.auth.user?.role ?? '');
  const canUpload = UPLOAD_ROLES.includes(role);
  const canDeactivate = role === 'MANAGER';

  const [categoryFilter, setCategoryFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState<Doc | null>(null);

  // Upload form
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useListDocumentsQuery({ category: categoryFilter || undefined });
  const [uploadDocument, { isLoading: uploading }] = useUploadDocumentMutation();
  const [deactivateDocument, { isLoading: deactivating }] = useDeactivateDocumentMutation();

  const docs = (data?.data ?? []) as Doc[];

  const resetForm = () => { setTitle(''); setCategory(''); setFile(null); setFormError(''); };
  const openModal = () => { resetForm(); setShowModal(true); };
  const closeModal = () => { setShowModal(false); resetForm(); };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
  };

  const handleUpload = async () => {
    if (!title.trim()) { setFormError('Document title is required.'); return; }
    if (!category) { setFormError('Please select a document type.'); return; }
    if (!file) { setFormError('Please select a file to upload.'); return; }

    const fd = new FormData();
    fd.append('title', title.trim());
    fd.append('category', category);
    fd.append('file', file);

    try {
      await uploadDocument(fd).unwrap();
      closeModal();
    } catch {
      setFormError('Upload failed. Please try again.');
    }
  };

  const inp: React.CSSProperties = {
    width: '100%', padding: '7px 10px',
    border: '1px solid var(--color-border)', borderRadius: 6,
    fontSize: '0.875rem', boxSizing: 'border-box',
  };
  const lbl: React.CSSProperties = {
    fontSize: '0.72rem', fontWeight: 600,
    color: 'var(--color-muted)', display: 'block', marginBottom: 4,
  };

  return (
    <Layout>
      <PageSubHeader
        crumbs={[{ label: 'Announcements' }, { label: 'Documents' }]}
        {...(canUpload ? { onSave: openModal, saveLabel: '+ Upload Document' } : {})}
      />

      <div style={{ padding: '1.5rem 2rem' }}>

        {/* Category filter tabs */}
        <div className="ent-section" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setCategoryFilter('')}
              style={{
                padding: '4px 14px', fontSize: '0.78rem', fontWeight: categoryFilter === '' ? 700 : 400,
                borderRadius: 20, border: '1px solid var(--color-border)',
                background: categoryFilter === '' ? 'var(--color-primary)' : '#f8fafc',
                color: categoryFilter === '' ? '#fff' : 'var(--color-text)',
                cursor: 'pointer',
              }}
            >
              All
            </button>
            {DOC_CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryFilter(c.id)}
                style={{
                  padding: '4px 14px', fontSize: '0.78rem', fontWeight: categoryFilter === c.id ? 700 : 400,
                  borderRadius: 20, border: `1px solid ${categoryFilter === c.id ? c.color : 'var(--color-border)'}`,
                  background: categoryFilter === c.id ? c.bg : '#f8fafc',
                  color: categoryFilter === c.id ? c.color : 'var(--color-text)',
                  cursor: 'pointer',
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Document list */}
        <div className="ent-section">
          <div className="ent-section-hdr">
            <span className="ent-section-title">
              Documents {docs.length > 0 && <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--color-muted)' }}>({docs.length})</span>}
            </span>
          </div>

          {isLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)' }}>Loading…</div>
          ) : docs.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.875rem' }}>
              No documents found{categoryFilter ? ' in this category' : ''}.
              {canUpload && !categoryFilter && <div style={{ marginTop: 8 }}>Click "+ Upload Document" to add the first one.</div>}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Document', 'Type', 'Version', 'Uploaded By', 'Date', '', ...(canDeactivate ? [''] : [])].map((h, idx) => (
                    <th key={idx} style={{
                      textAlign: 'left', padding: '8px 12px',
                      fontWeight: 600, fontSize: '0.72rem',
                      color: 'var(--color-muted)',
                      borderBottom: '1px solid var(--color-border)',
                    }}>{h}</th>
                  ))}

                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => {
                  const cat = catInfo(doc.category);
                  return (
                    <tr key={doc.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: '1.3rem' }}>{fileIcon(doc.title)}</span>
                          <span style={{ fontWeight: 600 }}>{doc.title}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 12px' }}>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 600,
                          padding: '2px 8px', borderRadius: 4,
                          background: cat.bg, color: cat.color,
                        }}>
                          {cat.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 12px', color: 'var(--color-muted)' }}>v{doc.version}</td>
                      <td style={{ padding: '12px 12px', color: 'var(--color-muted)' }}>
                        {doc.uploader?.name ?? '—'}
                      </td>
                      <td style={{ padding: '12px 12px', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                        {fmtDate(doc.created_at)}
                      </td>
                      <td style={{ padding: '12px 12px' }}>
                        <DownloadButton docId={doc.id} fileName={doc.file_name ?? doc.title} />
                      </td>
                      {canDeactivate && (
                        <td style={{ padding: '12px 12px' }}>
                          <button
                            onClick={() => setConfirmDeactivate(doc)}
                            style={{
                              padding: '5px 12px', fontSize: '0.78rem', fontWeight: 600,
                              border: '1px solid #fca5a5', borderRadius: 6,
                              background: '#fef2f2', color: '#dc2626', cursor: 'pointer',
                            }}
                          >
                            Deactivate
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Upload Modal ──────────────────────────────────────────────────────── */}
      {showModal && (
        <>
          <div
            onClick={closeModal}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            background: '#fff', borderRadius: 10,
            padding: '1.75rem', width: 460,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 201,
          }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1.5rem' }}>
              Upload Document
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Title */}
              <div>
                <label style={lbl}>Document Title *</label>
                <input
                  style={inp}
                  placeholder="e.g. Society Bye-Laws 2024"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              {/* Type */}
              <div>
                <label style={lbl}>Document Type *</label>
                <select
                  style={inp}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">— Select type —</option>
                  {DOC_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* File */}
              <div>
                <label style={lbl}>File *</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    style={{
                      padding: '7px 16px', fontSize: '0.82rem', fontWeight: 600,
                      border: '1px solid var(--color-primary)', borderRadius: 6,
                      background: '#fff', color: 'var(--color-primary)', cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Browse…
                  </button>
                  <span style={{
                    fontSize: '0.8rem',
                    color: file ? 'var(--color-text)' : 'var(--color-muted)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {file ? file.name : 'No file selected'}
                  </span>
                  <input
                    ref={fileRef}
                    type="file"
                    style={{ display: 'none' }}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                    onChange={handleFileChange}
                  />
                </div>
                {file && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginTop: 4 }}>
                    {(file.size / 1024).toFixed(0)} KB
                  </div>
                )}
              </div>
            </div>

            {formError && (
              <div style={{
                marginTop: '1rem', padding: '0.5rem 0.75rem',
                background: '#fef2f2', border: '1px solid #fca5a5',
                borderRadius: 6, color: '#dc2626', fontSize: '0.85rem',
              }}>
                {formError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.5rem' }}>
              <button
                className="ent-btn-submit"
                style={{ flex: 1 }}
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? 'Uploading…' : '⬆ Upload'}
              </button>
              <button className="ent-btn-cancel" style={{ flex: 1 }} onClick={closeModal}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Deactivate Confirm Modal ──────────────────────────────────────────── */}
      {confirmDeactivate && (
        <>
          <div onClick={() => setConfirmDeactivate(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            background: '#fff', borderRadius: 10,
            padding: '1.75rem', width: 400,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 201,
          }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.75rem' }}>Deactivate Document?</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginBottom: '1.5rem' }}>
              <strong>{confirmDeactivate.title}</strong> will be removed from the document repository. This action cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button
                style={{
                  flex: 1, padding: '8px', fontWeight: 700, fontSize: '0.875rem',
                  background: '#dc2626', color: '#fff', border: 'none',
                  borderRadius: 6, cursor: deactivating ? 'default' : 'pointer',
                  opacity: deactivating ? 0.6 : 1,
                }}
                disabled={deactivating}
                onClick={async () => {
                  await deactivateDocument(confirmDeactivate.id).unwrap();
                  setConfirmDeactivate(null);
                }}
              >
                {deactivating ? 'Deactivating…' : 'Yes, Deactivate'}
              </button>
              <button className="ent-btn-cancel" style={{ flex: 1 }} onClick={() => setConfirmDeactivate(null)}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
