/**
 * The sign-out glyph: an arrow leaving a frame.
 *
 * One definition, used everywhere logout appears — the mobile tab headers, the
 * breadcrumb bar and the More list. Deliberately NOT the 🚪 emoji, which is
 * already the Visitors tab icon; the same glyph meaning two different things
 * is how people end up tapping the wrong one.
 *
 * Inherits currentColor, so the parent decides the colour: white over the
 * gradient headers, slate in the breadcrumb bar, red in the More list.
 */
export default function LogoutIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
