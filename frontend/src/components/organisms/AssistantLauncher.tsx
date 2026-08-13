import { useState, CSSProperties } from 'react';
import { useEntitlements } from '../../hooks/useEntitlements';
import AssistantChat from './AssistantChat';

/**
 * The floating button that opens the assistant, and nothing else.
 *
 * Hidden unless the association has the ASSISTANT module. The server enforces
 * this too — hiding a button is presentation, not authority — but showing an
 * entry point that always returns 402 is its own kind of broken.
 */

const fabAt = (bottom: number): CSSProperties => ({
  position: 'fixed', right: 20, bottom, zIndex: 900,
  width: 54, height: 54, borderRadius: 27,
  background: '#1e293b', color: '#fff', border: 'none',
  boxShadow: '0 6px 20px rgba(15,23,42,0.28)',
  cursor: 'pointer', fontSize: 22, lineHeight: 1,
});

/**
 * `bottomOffset` lifts the button clear of the mobile tab bar. Without it the
 * button sits underneath the tabs and cannot be tapped, which is the sort of
 * thing that only shows up on a real handset.
 */
export default function AssistantLauncher({ bottomOffset = 20 }: { bottomOffset?: number }) {
  const [open, setOpen] = useState(false);

  // Same hook the menu uses, so the button and the nav can never disagree.
  // Presentation only — the server returns 402 regardless of what renders here.
  //
  // `isLoading` is checked as well as `canSee`, which the menu does not need to
  // do. useEntitlements reports FULL while the query is in flight, so that a
  // paying association never sees "not subscribed" flash on a page load. For a
  // menu item that is right. For a floating button it means appearing and then
  // vanishing a moment later, which reads as a bug. Better to arrive late.
  const { canSee, isLoading } = useEntitlements();
  if (isLoading || !canSee('ASSISTANT')) return null;

  return (
    <>
      {!open && (
        <button style={fabAt(bottomOffset)} onClick={() => setOpen(true)}
                aria-label="Open Phoebe" title="Ask Phoebe">
          ✦
        </button>
      )}

      {open && (
        <div style={{
          position: 'fixed', right: 20, bottom: bottomOffset, zIndex: 901,
          width: 'min(400px, calc(100vw - 40px))',
          height: 'min(560px, calc(100vh - 100px))',
          boxShadow: '0 12px 40px rgba(15,23,42,0.22)', borderRadius: 14,
        }}>
          <AssistantChat onClose={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}
