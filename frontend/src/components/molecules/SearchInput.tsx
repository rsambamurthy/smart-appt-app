import { useState, useRef, useEffect, useMemo } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Candidate strings used to build type-ahead suggestions (e.g. names, codes). */
  suggestions: string[];
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  maxSuggestions?: number;
}

/**
 * Free-text search box with a type-ahead suggestion dropdown.
 * Typing still filters the list normally; picking a suggestion fills the exact term.
 */
export default function SearchInput({
  value,
  onChange,
  suggestions,
  placeholder = 'Search…',
  className,
  style,
  maxSuggestions = 8,
}: Props) {
  const [open, setOpen]           = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    const uniq = Array.from(new Set(suggestions.filter(Boolean)));
    const scored = uniq
      .map(s => {
        const l = s.toLowerCase();
        if (l === q) return null;                    // already exact — nothing to suggest
        if (l.startsWith(q)) return { s, score: 0 };
        if (l.includes(q))   return { s, score: 1 };
        return null;
      })
      .filter(Boolean) as { s: string; score: number }[];
    return scored.sort((a, b) => a.score - b.score || a.s.localeCompare(b.s))
      .slice(0, maxSuggestions)
      .map(x => x.s);
  }, [value, suggestions, maxSuggestions]);

  useEffect(() => { setHighlight(-1); }, [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (!open || highlight < 0 || !listRef.current) return;
    (listRef.current.children[highlight] as HTMLElement | undefined)
      ?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  const pick = (s: string) => { onChange(s); setOpen(false); setHighlight(-1); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!matches.length) return;
    if (e.key === 'ArrowDown')     { e.preventDefault(); setOpen(true); setHighlight(h => Math.min(h + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp')  { e.preventDefault(); setHighlight(h => Math.max(h - 1, -1)); }
    else if (e.key === 'Enter' && highlight >= 0) { e.preventDefault(); pick(matches[highlight]); }
    else if (e.key === 'Escape')   { setOpen(false); setHighlight(-1); }
  };

  const showList = open && matches.length > 0;

  return (
    <div ref={wrapRef} style={{ position: 'relative', ...style }}>
      <input
        className={className}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        style={className ? undefined : {
          width: '100%', padding: '8px 11px', fontSize: 13.5,
          border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none',
          background: '#fff', color: '#1e293b',
        }}
      />
      {showList && (
        <div
          ref={listRef}
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
            boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
            maxHeight: 240, overflowY: 'auto', minWidth: 180,
          }}
        >
          {matches.map((s, i) => (
            <div
              key={s}
              onMouseDown={e => { e.preventDefault(); pick(s); }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                padding: '7px 11px', fontSize: 13, cursor: 'pointer',
                background: i === highlight ? '#f5f3ff' : '#fff',
                color: '#1e293b', borderBottom: '1px solid #f8fafc',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
