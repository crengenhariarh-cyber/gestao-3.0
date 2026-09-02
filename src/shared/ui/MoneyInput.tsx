import { Input } from './Input';

export interface MoneyInputProps {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  hint?: string;
  id?: string;
}

const formatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function valueFromMaskedInput(raw: string): number {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 0;
  return Number(digits) / 100;
}

export function MoneyInput({ label, value, onValueChange, required, disabled, error, hint, id }: MoneyInputProps) {
  const optionalProps = {
    ...(id !== undefined ? { id } : {}),
    ...(error !== undefined ? { error } : {}),
    ...(hint !== undefined ? { hint } : {}),
    ...(required !== undefined ? { required } : {}),
    ...(disabled !== undefined ? { disabled } : {}),
  };

  return (
    <Input
      {...optionalProps}
      label={label}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={formatter.format(Number.isFinite(value) ? value : 0)}
      onChange={(event) => onValueChange(valueFromMaskedInput(event.target.value))}
    />
  );
}
