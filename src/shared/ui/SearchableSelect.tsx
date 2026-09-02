import { useId, useMemo, useState } from 'react';
import './searchable-select.css';

export interface SearchableSelectOption {
  value: string;
  label: string;
  keywords?: readonly string[];
}

export interface SearchableSelectProps {
  label: string;
  options: readonly SearchableSelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
}

function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

function matchesOption(option: SearchableSelectOption, query: string): boolean {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return true;
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const searchable = normalizeSearch([option.label, ...(option.keywords ?? [])].join(' '));
  const words = searchable.split(/\s+/).filter(Boolean);
  return tokens.every((token) => words.some((word) => word.startsWith(token)) || searchable.includes(token));
}

export function SearchableSelect({ label, options, value, onChange, placeholder = 'Digite para pesquisar', disabled = false, emptyMessage = 'Nenhum resultado encontrado.' }: SearchableSelectProps) {
  const id = useId();
  const [internalValue, setInternalValue] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const selectedValue = value ?? internalValue;
  const selected = options.find((option) => option.value === selectedValue);
  const filtered = useMemo(() => options.filter((option) => matchesOption(option, query)).slice(0, 20), [options, query]);

  function selectOption(option: SearchableSelectOption) {
    if (value === undefined) setInternalValue(option.value);
    setQuery('');
    setOpen(false);
    onChange?.(option.value);
  }

  return (
    <div className="ui-smart-select">
      <label className="ui-field" htmlFor={id}>
        <span className="ui-field__label">{label}</span>
        <input id={id} className="ui-input" type="search" autoComplete="off" disabled={disabled} placeholder={placeholder} value={open ? query : selected?.label ?? query} onFocus={() => { setQuery(''); setOpen(true); }} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onBlur={() => window.setTimeout(() => setOpen(false), 120)} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-options`} />
      </label>
      {open && !disabled && <div className="ui-smart-select__menu" id={`${id}-options`} role="listbox">
        {filtered.length === 0 ? <span className="ui-smart-select__empty">{emptyMessage}</span> : filtered.map((option) => <button key={option.value} type="button" className={`ui-smart-select__option ${option.value === selectedValue ? 'ui-smart-select__option--selected' : ''}`.trim()} role="option" aria-selected={option.value === selectedValue} onMouseDown={(event) => event.preventDefault()} onClick={() => selectOption(option)}>{option.label}</button>)}
      </div>}
    </div>
  );
}
