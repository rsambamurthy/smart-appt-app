import { ReactNode, CSSProperties } from 'react';
import { useIsWide } from '../../hooks/useIsWide';

/**
 * List on the left, detail on the right — the pattern every mail client uses.
 *
 * Governance screens are lists you scan and act on, not objects you browse.
 * Cards spend a lot of vertical space saying very little and force a page
 * change per item; this keeps the list in view so you can work through several
 * meetings without losing your place.
 *
 * Below 900px the pane disappears and rows navigate instead, which is why
 * every row still needs a real `onOpen` route rather than only a selection.
 */

export interface InboxRowProps {
  selected: boolean;
  /** Draws the left accent. Concluded and cancelled items pass nothing. */
  accent?: string;
  /** Dims the row — for anything finished and no longer actionable. */
  muted?: boolean;
  title: ReactNode;
  meta: ReactNode;
  /** Right-aligned, one short line. A date, usually. */
  trailing?: ReactNode;
  onClick: () => void;
}

export function InboxRow({
  selected, accent, muted, title, meta, trailing, onClick,
}: InboxRowProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
        padding: '10px 12px',
        // The accent is a border rather than a pill so it costs no horizontal
        // space and reads at a glance down the whole column.
        borderLeft: `3px solid ${selected ? '#2563eb' : accent ?? 'transparent'}`,
        borderTop: 'none', borderRight: 'none',
        borderBottom: '1px solid #f1f5f9',
        background: selected ? '#eff6ff' : '#fff',
        opacity: muted && !selected ? 0.62 : 1,
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <span style={{
          flex: 1, minWidth: 0, fontSize: 13, fontWeight: selected ? 700 : 600,
          color: selected ? '#0c447c' : '#1e293b',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {title}
        </span>
        {trailing && (
          <span style={{ fontSize: 11, color: selected ? '#185fa5' : '#94a3b8', whiteSpace: 'nowrap' }}>
            {trailing}
          </span>
        )}
      </div>
      <div style={{
        fontSize: 11.5, marginTop: 2, color: selected ? '#185fa5' : '#94a3b8',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {meta}
      </div>
    </button>
  );
}

const shell: CSSProperties = {
  display: 'flex', border: '1px solid #e2e8f0', borderRadius: 12,
  overflow: 'hidden', background: '#fff', minHeight: 480,
};

interface Props {
  /** Search box, filter chips, "new" button — anything above the list. */
  toolbar?: ReactNode;
  /** The rows. Render InboxRow children. */
  list: ReactNode;
  /** The reading pane. Null shows the placeholder. */
  detail: ReactNode | null;
  /** Shown in the pane when nothing is selected. */
  placeholder?: string;
  /** On a narrow screen only the list is drawn, and rows navigate away. */
  listWidth?: number;
}

export default function InboxLayout({
  toolbar, list, detail, placeholder = 'Select something to see it here.', listWidth = 260,
}: Props) {
  const wide = useIsWide();

  if (!wide) {
    return (
      <div style={{ ...shell, flexDirection: 'column', minHeight: 0 }}>
        {toolbar && (
          <div style={{ borderBottom: '1px solid #e2e8f0' }}>{toolbar}</div>
        )}
        <div>{list}</div>
      </div>
    );
  }

  return (
    <div style={shell}>
      <div style={{
        width: listWidth, flexShrink: 0, borderRight: '1px solid #e2e8f0',
        display: 'flex', flexDirection: 'column',
      }}>
        {toolbar && (
          <div style={{ borderBottom: '1px solid #e2e8f0' }}>{toolbar}</div>
        )}
        {/* The list scrolls, the pane scrolls with the page. Nesting both
            would trap the wheel in whichever one the cursor happened to be
            over, which is the usual complaint about this layout. */}
        <div style={{ overflowY: 'auto', maxHeight: '72vh' }}>{list}</div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {detail ?? (
          <div style={{
            padding: '3rem 2rem', textAlign: 'center',
            color: '#94a3b8', fontSize: 13.5,
          }}>
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}
