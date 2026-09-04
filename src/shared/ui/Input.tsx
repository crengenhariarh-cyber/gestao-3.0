import type { ChangeEvent, InputHTMLAttributes, ReactNode } from 'react';
import { CalendarDays, CircleDollarSign, FileText, UserRound } from 'lucide-react';
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

function inferredIcon(label: string): ReactNode {
  if (dateLabel.test(label)) return <CalendarDays />;
  if (monetaryLabel.test(label)) return <CircleDollarSign />;
  if (/descri[cç][aã]o|observa[cç][aã]o|nota/i.test(label)) return <FileText />;
  if (/fornecedor|benefici[aá]rio|pagador|respons[aá]vel/i.test(label)) return <UserRound />;
  return null;
}

export function Input({ label, error, hint, icon, prefix, id, className = '', type, value, onChange, inputMode, ...props }: InputProps) {
  const inputId = id ?? `input-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const helpId = `${inputId}-help`;
  const resolvedType = type ?? (dateLabel.test(label) ? 'date' : undefined);
  const isCurrency = resolvedType === 'number' && monetaryLabel.test(label);
  const resolvedValue = isCurrency ? formatCurrencyValue(value) : value;
  const resolvedIcon = icon ?? inferredIcon(label);
  const resolvedPrefix = prefix ?? resolvedIcon;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    if (isCurrency) {
      const numeric = currencyNumberFromInput(event.currentTarget.value);
      event.currentTarget.value = numeric === null ? '' : String(numeric);
    }
    onChange?.(event);
  }

  return (
    <label className={`ui-field ${resolvedPrefix ? 'ui-field--adorned' : ''}`} htmlFor={inputId}>
      <span className="ui-field__label-row">
        {resolvedIcon && <span className="ui-field__label-icon" aria-hidden="true">{resolvedIcon}</span>}
        <span className="ui-field__label">{label}</span>
      </span>
      <span className="ui-field__control">
        {resolvedPrefix && <span className="ui-field__control-icon" aria-hidden="true">{resolvedPrefix}</span>}
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
