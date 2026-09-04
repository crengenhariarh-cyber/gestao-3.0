import type { ReactNode, SelectHTMLAttributes } from 'react';
import './field.css';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: readonly SelectOption[];
  hint?: string;
  icon?: ReactNode;
  prefix?: ReactNode;
}

export function Select({ label, options, hint, icon, prefix, id, className = '', ...props }: SelectProps) {
  const selectId = id ?? `select-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const helpId = `${selectId}-help`;

  return (
    <label className={`ui-field ${prefix ? 'ui-field--adorned' : ''}`} htmlFor={selectId}>
      <span className="ui-field__label-row">
        {icon && <span className="ui-field__label-icon" aria-hidden="true">{icon}</span>}
        <span className="ui-field__label">{label}</span>
      </span>
      <span className="ui-field__control">
        {prefix && <span className="ui-field__control-icon" aria-hidden="true">{prefix}</span>}
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
      </span>
      {hint && (
        <span id={helpId} className="ui-field__hint">
          {hint}
        </span>
      )}
    </label>
  );
}
