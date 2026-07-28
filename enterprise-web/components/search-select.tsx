'use client';

import { Check, ChevronDown, Search } from 'lucide-react';
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';

export type SearchOption = { id: string; label: string; hint?: string };

/**
 * Type-ahead combobox: filter a list by name or code and pick one. Keyboard + mouse accessible.
 * Shared across composers (purchase orders, sales, quotations) for supplier / customer / item search.
 */
export function SearchSelect({ options, value, onChange, placeholder, ariaLabel }: {
  options: SearchOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  ariaLabel: string;
}) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selected = options.find((option) => option.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 60);
    return options.filter((option) => `${option.label} ${option.hint ?? ''}`.toLowerCase().includes(q)).slice(0, 60);
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) { setOpen(false); setQuery(''); }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function openMenu() { setQuery(''); setHighlight(0); setOpen(true); }
  function choose(option: SearchOption) { onChange(option.id); setOpen(false); setQuery(''); }

  function onValueKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openMenu(); }
  }

  function onInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') { event.preventDefault(); setHighlight((current) => Math.min(current + 1, filtered.length - 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setHighlight((current) => Math.max(current - 1, 0)); }
    else if (event.key === 'Enter') { event.preventDefault(); const option = filtered[highlight]; if (option) choose(option); }
    else if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setQuery(''); }
  }

  return (
    <div className="search-select" ref={rootRef}>
      {open ? (
        <div className="search-select__control">
          <Search size={16} className="search-select__lead" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded
            aria-controls={menuId}
            aria-autocomplete="list"
            aria-label={ariaLabel}
            className="search-select__input"
            value={query}
            placeholder={selected ? selected.label : placeholder}
            onChange={(event) => { setQuery(event.target.value); setHighlight(0); }}
            onKeyDown={onInputKeyDown}
          />
          <ChevronDown size={16} className="search-select__chevron search-select__chevron--open" aria-hidden />
        </div>
      ) : (
        <button
          type="button"
          className={`search-select__value${selected ? '' : ' is-empty'}`}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          onClick={openMenu}
          onKeyDown={onValueKeyDown}
        >
          <Search size={16} className="search-select__lead" aria-hidden />
          {selected
            ? <span className="search-select__value-label">{selected.label}</span>
            : <span className="search-select__value-placeholder">{placeholder}</span>}
          {selected?.hint ? <span className="search-select__code">{selected.hint}</span> : null}
          <ChevronDown size={16} className="search-select__chevron" aria-hidden />
        </button>
      )}
      {open ? (
        <ul className="search-select__menu" id={menuId} role="listbox" aria-label={ariaLabel}>
          {filtered.length ? filtered.map((option, index) => (
            <li
              key={option.id}
              role="option"
              aria-selected={option.id === value}
              className={`search-select__option${index === highlight ? ' is-active' : ''}`}
              onMouseEnter={() => setHighlight(index)}
              onMouseDown={(event) => { event.preventDefault(); choose(option); }}
            >
              <span className="search-select__text">{option.label}</span>
              {option.hint ? <span className="search-select__code">{option.hint}</span> : null}
              <span className="search-select__tick">{option.id === value ? <Check size={15} aria-hidden /> : null}</span>
            </li>
          )) : <li className="search-select__empty"><Search size={15} aria-hidden /> No matches for &ldquo;{query}&rdquo;</li>}
        </ul>
      ) : null}
    </div>
  );
}
