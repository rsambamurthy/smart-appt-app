import { Link } from 'react-router-dom';
export default function NotFoundPage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
      <h1 style={{ fontSize: '4rem', color: 'var(--color-primary)' }}>404</h1>
      <p style={{ color: 'var(--color-muted)' }}>Page not found.</p>
      <Link to="/dashboard"><button className="btn-primary">Back to Dashboard</button></Link>
    </div>
  );
}
