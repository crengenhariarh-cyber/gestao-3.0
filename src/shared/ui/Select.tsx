import type { SelectHTMLAttributes } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: readonly SelectOption[];
  hint?: string;
}

export function Select({ label, options, hint, id, className = '', ...props }: SelectProps) {
  const selectId = id ?? `select-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const helpId = `${selectId}-help`;

  return (
    <label className="ui-field" htmlFor={selectId}>
      <span className="ui-field__label">{label}</span>
      <select
        id={selectId}
        className={`ui-input ${className}`.trim()}
        aria-describedby={hint ? helpId : undefined}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && (
        <span id={helpId} className="ui-field__hint">
          {hint}
        </span>
      )}
    </label>
  );
}
