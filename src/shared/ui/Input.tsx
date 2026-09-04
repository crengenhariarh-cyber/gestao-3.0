import type { ChangeEvent, InputHTMLAttributes, ReactNode } from 'react';
import './field.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  prefix?: ReactNode;
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const monetaryLabel = /(?:^|\s)(valor|saldo|sal[aá]rio|limite|pre[cç]o|custo|remunera[cç][aã]o)(?:\s|$)/i;
const dateLabel = /(?:^|\s)(data|vencimento|admiss[aã]o|vig[eê]ncia|demiss[aã]o|nascimento|in[ií]cio|fim)(?:\s|$)/i;

function formatCurrencyValue(value: InputHTMLAttributes<HTMLInputElement>['value']): string {
  if (value === undefined || value === null || value === '') return '';
  const numeric = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(numeric) ? currencyFormatter.format(numeric) : '';
}

function currencyNumberFromInput(raw: string): number | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  return Number(digits) / 100;
}

export function Input({ label, error, hint, icon, prefix, id, className = '', type, value, onChange, inputMode, ...props }: InputProps) {
  const inputId = id ?? `input-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const helpId = `${inputId}-help`;
  const resolvedType = type ?? (dateLabel.test(label) ? 'date' : undefined);
  const isCurrency = resolvedType === 'number' && monetaryLabel.test(label);
  const resolvedValue = isCurrency ? formatCurrencyValue(value) : value;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    if (isCurrency) {
      const numeric = currencyNumberFromInput(event.currentTarget.value);
      event.currentTarget.value = numeric === null ? '' : String(numeric);
    }
    onChange?.(event);
  }

  return (
    <label className={`ui-field ${prefix ? 'ui-field--adorned' : ''}`} htmlFor={inputId}>
      <span className="ui-field__label-row">
        {icon && <span className="ui-field__label-icon" aria-hidden="true">{icon}</span>}
        <span className="ui-field__label">{label}</span>
      </span>
      <span className="ui-field__control">
        {prefix && <span className="ui-field__control-icon" aria-hidden="true">{prefix}</span>}
        <input
          id={inputId}
          className={`ui-input ${error ? 'ui-input--error' : ''} ${className}`.trim()}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? helpId : undefined}
          type={isCurrency ? 'text' : resolvedType}
          inputMode={isCurrency ? 'numeric' : inputMode}
          autoComplete={isCurrency ? 'off' : props.autoComplete}
          value={resolvedValue}
          onChange={handleChange}
          {...props}
        />
      </span>
      {(error || hint) && (
        <span id={helpId} className={error ? 'ui-field__error' : 'ui-field__hint'}>
          {error ?? hint}
        </span>
      )}
    </label>
  );
}
