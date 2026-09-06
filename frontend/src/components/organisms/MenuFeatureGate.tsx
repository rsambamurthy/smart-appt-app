import React from 'react';
import { useMenuItemEnabled } from '../../hooks/useMenuItemEnabled';
import Layout from './Layout';
import PageSubHeader from '../molecules/PageSubHeader';

interface Props {
  /** A NAV_GROUPS item id (Layout.tsx) — must match exactly. */
  itemId: string;
  /** Shown in the breadcrumb and the "not enabled" message when gated. */
  label: string;
  children: React.ReactElement;
}

/**
 * Wraps one route with the Web Menu by Role decision for its menu feature —
 * the same decision useMenuItemEnabled resolves (an explicit per-association
 * override if one exists, else the item's coded default roles), applied once
 * per route instead of copied into every page component.
 *
 * This is the frontend half of making a menu feature "just a component, not
 * specific to any role" (see requireMenuFeature on the backend for the other
 * half, which is what actually enforces the same decision on the API — this
 * wrapper on its own only controls what's rendered, matching how App.tsx's
 * RoleRoute never was the real security boundary either).
 *
 * Used only from the web route tree. The native/Capacitor routes render
 * their target pages directly, unwrapped — native has its own independent
 * Mobile Menu by Role system (system.service.ts's mobile-menu config), and
 * this component's check reads the *web* menu config, so it must never be
 * layered onto a native route.
 */
export default function MenuFeatureGate({ itemId, label, children }: Props) {
  const { enabled, isLoading } = useMenuItemEnabled(itemId);

  // Avoid a one-frame flash of the "not enabled" message while the config is
  // still loading — nothing renders until we actually know the answer.
  if (isLoading) return null;

  if (!enabled) {
    return (
      <Layout>
        <PageSubHeader crumbs={[{ label }]} />
        <div style={{ padding: '2rem', maxWidth: 640 }}>
          <div style={{
            padding: '1rem 1.25rem', background: '#fef2f2', border: '1px solid #fca5a5',
            borderRadius: 6, color: '#991b1b', fontSize: '0.9rem',
          }}>
            {label} isn't enabled for your role. Ask your Manager to enable it under Web Menu Configuration if you need access.
          </div>
        </div>
      </Layout>
    );
  }

  return children;
}
