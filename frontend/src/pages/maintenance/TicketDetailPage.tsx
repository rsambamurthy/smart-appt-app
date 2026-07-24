import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Layout from '../../components/organisms/Layout';
import { isResidentRole } from '../../constants/roles';
import { useGetTicketQuery, useUpdateStatusMutation, useSubmitFeedbackMutation, useAssignTicketMutation } from '../../store/api/maintenanceApi';
import type { RootState } from '../../store';
import { useState } from 'react';

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useSelector((s: RootState) => s.auth.user);
  const { data, isFetching } = useGetTicketQuery(id!);
  const [updateStatus] = useUpdateStatusMutation();
  const [submitFeedback] = useSubmitFeedbackMutation();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const navigate = useNavigate();

  const ticket = data?.data as Record<string, unknown> | undefined;

  if (isFetching) return <Layout><div className="skeleton" style={{ height: 300, borderRadius: 8 }} /></Layout>;
  if (!ticket) return <Layout><div className="card">Ticket not found.</div></Layout>;

  const canChangeStatus = ['MANAGER', 'GATE_STAFF'].includes(user?.role ?? '');
  const canFeedback = isResidentRole(user?.role) && ticket['status'] === 'RESOLVED' && !ticket['rating'];

  return (
    <Layout>
      <button className="btn-secondary" onClick={() => navigate(-1)} style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>← Back</button>
      <div className="card" style={{ maxWidth: 700 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontWeight: 700 }}>{ticket['title'] as string}</h2>
          <span className="badge badge-blue">{ticket['status'] as string}</span>
        </div>
        <div style={{ color: 'var(--color-muted)', fontSize: '0.875rem', marginBottom: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div><b>Category:</b> {ticket['category'] as string}</div>
          <div><b>Priority:</b> {ticket['priority'] as string}</div>
          <div><b>Raised by:</b> {(ticket['raiser'] as Record<string, string>)?.name ?? '—'}</div>
          <div><b>Assigned to:</b> {(ticket['assignee'] as Record<string, string>)?.name ?? 'Unassigned'}</div>
          <div><b>SLA Due:</b> {ticket['sla_due_at'] ? new Date(ticket['sla_due_at'] as string).toLocaleString() : '—'}</div>
          {ticket['rating'] && <div><b>Rating:</b> {'⭐'.repeat(ticket['rating'] as number)}</div>}
        </div>
        <p style={{ marginBottom: '1.5rem' }}>{ticket['description'] as string}</p>

        {canChangeStatus && ticket['status'] !== 'CLOSED' && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {['ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((s) => (
              <button key={s} className="btn-secondary" style={{ fontSize: '0.75rem' }}
                onClick={() => updateStatus({ id: id!, body: { status: s } })}>
                → {s}
              </button>
            ))}
          </div>
        )}

        {canFeedback && (
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
            <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>Rate Resolution</h3>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {[1, 2, 3, 4, 5].map((r) => (
                <button key={r} onClick={() => setRating(r)} style={{ background: 'none', fontSize: '1.5rem', padding: '0' }}>
                  {r <= rating ? '⭐' : '☆'}
                </button>
              ))}
            </div>
            <textarea placeholder="Optional comment..." value={comment} onChange={(e) => setComment(e.target.value)} rows={2} style={{ marginBottom: '0.75rem', resize: 'none' }} />
            <button className="btn-primary" onClick={() => submitFeedback({ id: id!, body: { rating, comment } })}>Submit Feedback</button>
          </div>
        )}

        {(ticket['status_logs'] as unknown[])?.length > 0 && (
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem', marginTop: '1rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>History</h3>
            {(ticket['status_logs'] as Record<string, unknown>[]).map((log, i) => (
              <div key={i} style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginBottom: '0.25rem' }}>
                {new Date(log['created_at'] as string).toLocaleString()} · {(log['changer'] as Record<string, string>)?.name ?? '?'} → {log['to_status'] as string}
                {log['note'] && ` — ${log['note'] as string}`}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
