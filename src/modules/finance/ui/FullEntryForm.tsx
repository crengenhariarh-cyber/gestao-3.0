import { useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';

interface Option { value: string; label: string; }

interface FullEntryFormProps {
  companyName: string;
  form: Record<string, string>;
  busy: boolean;
  categoryOptions: readonly Option[];
  costCenterOptions: readonly Option[];
  workOptions: readonly Option[];
  accountOptions: readonly Option[];
  cardOptions: readonly Option[];
  onField: (name: string, value: string) => void;
}

const paymentOptions: readonly Option[] = [
  { value: '', label: 'Selecione…' },
  { value: 'pix', label: 'Pix' },
  { value: 'debit', label: 'Cartão de débito' },
  { value: 'credit', label: 'Cartão de crédito' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'transfer', label: 'Transferência' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'other', label: 'Outro' },
];

const launchModeOptions: readonly Option[] = [
  { value: 'single', label: 'Único / à vista' },
  { value: 'installment', label: 'Parcelado' },
  { value: 'recurring', label: 'Recorrente' },
];

export function FullEntryForm({
  companyName,
  form,
  busy,
  categoryOptions,
  costCenterOptions,
  workOptions,
  accountOptions,
  cardOptions,
  onField,
}: FullEntryFormProps) {
  const [showMore, setShowMore] = useState(false);
  const paymentMethod = form.paymentMethod ?? '';
  const launchMode = form.launchMode ?? 'single';
  const isCredit = paymentMethod === 'credit';

  return (
    <div className="finance-entry-form">
      <section className="finance-entry-form__section" aria-labelledby="finance-entry-main-title">
        <div className="finance-entry-form__section-title">
          <span aria-hidden="true">1</span>
          <strong id="finance-entry-main-title">Dados principais</strong>
        </div>

        <div className="finance-entry-form__grid">
          <Select
            label="Tipo"
            value={form.entryType ?? 'expense'}
            onChange={(event) => onField('entryType', event.target.value)}
            options={[{ value: 'expense', label: 'Despesa' }, { value: 'income', label: 'Receita' }]}
            disabled={busy}
          />
          <Input
            label="Data"
            type="date"
            value={form.dueDate ?? ''}
            onChange={(event) => onField('dueDate', event.target.value)}
            required
            disabled={busy}
          />
          <Input
            label="Descrição"
            value={form.description ?? ''}
            onChange={(event) => onField('description', event.target.value)}
            placeholder="Ex.: Material hidráulico"
            required
            disabled={busy}
          />
          <Input
            label="Valor"
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={form.amount ?? ''}
            onChange={(event) => onField('amount', event.target.value)}
            placeholder="R$ 0,00"
            required
            disabled={busy}
          />
          <Select
            label="Forma de pagamento"
            value={paymentMethod}
            onChange={(event) => {
              const next = event.target.value;
              onField('paymentMethod', next);
              if (next !== 'credit') onField('cardId', '');
              if (next === 'credit') onField('accountId', '');
            }}
            options={paymentOptions}
            required
            disabled={busy}
          />
          <Select
            label="Tipo de lançamento"
            value={launchMode}
            onChange={(event) => {
              const next = event.target.value;
              onField('launchMode', next);
              if (next !== 'installment') onField('installmentCount', '1');
              if (next !== 'recurring') onField('recurrenceCount', '12');
            }}
            options={launchModeOptions}
            disabled={busy || (isCredit && launchMode === 'recurring')}
          />
          <Input label="Empresa" value={companyName} readOnly />
          <Select
            label="Obra"
            value={form.workId ?? ''}
            onChange={(event) => onField('workId', event.target.value)}
            options={workOptions}
            disabled={busy}
          />
          <Select
            label="Categoria"
            value={form.categoryId ?? ''}
            onChange={(event) => onField('categoryId', event.target.value)}
            options={categoryOptions}
            required
            disabled={busy}
          />
          <Select
            label="Centro de custo"
            value={form.costCenterId ?? ''}
            onChange={(event) => onField('costCenterId', event.target.value)}
            options={costCenterOptions}
            disabled={busy}
          />

          {isCredit ? (
            <Select
              label="Cartão"
              value={form.cardId ?? ''}
              onChange={(event) => onField('cardId', event.target.value)}
              options={cardOptions}
              required
              disabled={busy}
            />
          ) : (
            <Select
              label="Conta / banco"
              value={form.accountId ?? ''}
              onChange={(event) => onField('accountId', event.target.value)}
              options={accountOptions}
              disabled={busy}
            />
          )}

          {launchMode === 'installment' && (
            <Input
              label="Quantidade de parcelas"
              type="number"
              min="2"
              max="120"
              step="1"
              value={form.installmentCount ?? '2'}
              onChange={(event) => onField('installmentCount', event.target.value)}
              required
              disabled={busy}
            />
          )}

          {launchMode === 'recurring' && (
            <Input
              label="Quantidade de recorrências"
              type="number"
              min="2"
              max="120"
              step="1"
              value={form.recurrenceCount ?? '12'}
              onChange={(event) => onField('recurrenceCount', event.target.value)}
              required
              disabled={busy}
            />
          )}
        </div>
      </section>

      <div className="finance-entry-form__more">
        <Button variant="secondary" onClick={() => setShowMore((current) => !current)} disabled={busy}>
          {showMore ? '⌃ Menos opções' : '⌄ Mais opções'}
        </Button>
      </div>

      {showMore && (
        <section className="finance-entry-form__section" aria-labelledby="finance-entry-more-title">
          <div className="finance-entry-form__section-title">
            <span aria-hidden="true">2</span>
            <strong id="finance-entry-more-title">Mais opções</strong>
          </div>
          <div className="finance-entry-form__grid">
            <Input
              label="Fornecedor / pagador"
              value={form.counterparty ?? ''}
              onChange={(event) => onField('counterparty', event.target.value)}
              disabled={busy}
            />
            <Input
              label="Competência"
              type="month"
              value={form.competenceMonth ?? ''}
              onChange={(event) => onField('competenceMonth', event.target.value)}
              disabled={busy}
            />
            <Input
              label="Observação"
              value={form.notes ?? ''}
              onChange={(event) => onField('notes', event.target.value)}
              disabled={busy}
            />
          </div>
        </section>
      )}

      {isCredit && launchMode === 'recurring' && (
        <p className="finance-entry-form__hint">Compras recorrentes no cartão devem ser lançadas como compra única ou parcelada. Para recorrência mensal, escolha outra forma de pagamento.</p>
      )}
    </div>
  );
}
