import type { ReactNode, SelectHTMLAttributes } from 'react';
import { ArrowDownUp, BriefcaseBusiness, Building2, CreditCard, Landmark, Layers3, Tag } from 'lucide-react';
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

function inferredIcon(label: string): ReactNode {
  if (/categoria/i.test(label)) return <Tag />;
  if (/forma de pagamento|cart[aã]o/i.test(label)) return <CreditCard />;
  if (/banco|conta/i.test(label)) return <Landmark />;
  if (/empresa/i.test(label)) return <Building2 />;
  if (/centro de custo|obra/i.test(label)) return <BriefcaseBusiness />;
  if (/tipo de lan[cç]amento/i.test(label)) return <Layers3 />;
  if (/^tipo$/i.test(label)) return <ArrowDownUp />;
  return null;
}

export function Select({ label, options, hint, icon, prefix, id, className = '', ...props }: SelectProps) {
  const selectId = id ?? `select-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const helpId = `${selectId}-help`;
  const resolvedIcon = icon ?? inferredIcon(label);
  const resolvedPrefix = prefix ?? resolvedIcon;

  return (
    <label className={`ui-field ${resolvedPrefix ? 'ui-field--adorned' : ''}`} htmlFor={selectId}>
      <span className="ui-field__label-row">
        {resolvedIcon && <span className="ui-field__label-icon" aria-hidden="true">{resolvedIcon}</span>}
        <span className="ui-field__label">{label}</span>
      </span>
      <span className="ui-field__control">
        {resolvedPrefix && <span className="ui-field__control-icon" aria-hidden="true">{resolvedPrefix}</span>}
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
