import { useState, useRef, useEffect, useMemo } from 'react';

export interface AutocompleteOption {
  value: string;
  label: string;
  /** Optional secondary text shown on the right (e.g. account code, category) */
  hint?: string;
  /** Extra text included in matching but not displayed */
  keywords?: string;
}

interface Props {
  options: AutocompleteOption[];
  value: string;                    // selected option value ('' = none)
  onChange: (value: string) => void;
  placeholder?: string;
  /** Text for the "clear selection" entry at the top of the list. Omit to hide. */
  allLabel?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  maxResults?: number;
}

/**
 * Type-ahead combo box: type to filter, arrow keys to move, Enter to pick.
 * Falls back to showing all options when the query is empty.
 */
export default function Autocomplete({
  options,
  value,
  onChange,
  placeholder = 'Type to search…',
  allLabel,
  disabled = false,
  style,
  maxResults = 50,
}: Props) {
  const [query, setQuery]       = useState('');
  const [open, setOpen]         = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value) ?? null;

  // Show the selected label when closed; the live query when open
  const display = open ? query : (selected?.label ?? '');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, maxResults);
    // Rank: label starts-with > label contains > hint/keywords contains
    const scored = options
      .map(o => {
        const label = o.label.toLowerCase();
        const extra = `${o.hint ?? ''} ${o.keywords ?? ''}`.toLowerCase();
        let score = -1;
        if (label.startsWith(q)) score = 0;
        else if (label.includes(q)) score = 1;
        else if (extra.includes(q)) score = 2;
        return { o, score };
      })
      .filter(x => x.score >= 0)
      .sort((a, b) => a.score - b.score);
    return scored.slice(0, maxResults).map(x => x.o);
  }, [options, query, maxResults]);

  // Entries include the optional "all" row at index 0
  const entries: (AutocompleteOption | null)[] = allLabel ? [null, ...filtered] : filtered;

  useEffect(() => { setHighlight(0); }, [query, open]);

  // Close on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Keep the highlighted row in view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[highlight] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  const choose = (opt: AutocompleteOption | null) => {
    onChange(opt ? opt.value : '');
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) { setOpen(true); return; }
    if (e.key === 'ArrowDown')      { e.preventDefault(); setHighlight(h => Math.min(h + 1, entries.length - 1)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter')     { e.preventDefault(); if (entries.length) choose(entries[highlight] ?? null); }
    else if (e.key === 'Escape')    { setOpen(false); setQuery(''); inputRef.current?.blur(); }
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', ...style }}>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={display}
          placeholder={selected ? selected.label : placeholder}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { setOpen(true); setQuery(''); }}
          onKeyDown={onKeyDown}
          style={{
            width: '100%',
            padding: '8px 30px 8px 11px',
            fontSize: 13.5,
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            background: disabled ? '#f8fafc' : '#fff',
            color: '#1e293b',
            outline: 'none',
            cursor: disabled ? 'not-allowed' : 'text',
          }}
        />
        {/* Clear / caret */}
        {selected && !open ? (
          <button
            type="button"
            onClick={() => choose(null)}
            title="Clear"
            style={{
              position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: '#94a3b8', fontSize: 15, lineHeight: 1, padding: 4,
            }}
          >×</button>
        ) : (
          <span style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            color: '#94a3b8', fontSize: 10, pointerEvents: 'none',
          }}>▼</span>
        )}
      </div>

      {open && (
        <div
          ref={listRef}
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
            boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
            maxHeight: 280, overflowY: 'auto',
          }}
        >
          {entries.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 13, color: '#94a3b8' }}>No matches</div>
          )}
          {entries.map((opt, i) => (
            <div
              key={opt?.value ?? '__all__'}
              onMouseDown={e => { e.preventDefault(); choose(opt); }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                padding: '8px 12px',
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                background: i === highlight ? '#f5f3ff' : '#fff',
                color: opt ? '#1e293b' : '#7c3aed',
                fontWeight: opt ? (opt.value === value ? 700 : 400) : 600,
                borderBottom: '1px solid #f8fafc',
              }}
            >
              <span style={{ flex: 1 }}>{opt ? opt.label : allLabel}</span>
              {opt?.hint && (
                <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{opt.hint}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
