import { useEffect, useMemo, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
import { createContractWithWork } from '../infrastructure/createContractWithWork';

interface Props {
  open: boolean;
  companies: readonly CompanySummary[];
  initialCompanyId?: string;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  companyId: string;
  workName: string;
  contractNumber: string;
  clientName: string;
  signedAt: string;
  startDate: string;
  endDate: string;
  inssRate: string;
  issRate: string;
  retentionRate: string;
  notes: string;
}

function companyLabel(company: CompanySummary) {
  const raw = `${company.tradeName ?? ''} ${company.legalName}`.toLocaleUpperCase('pt-BR');
  if (raw.includes('PESSOAL')) return 'Pessoal';
  if (raw.includes('PR-HIST') || /(^|\s)PR(\s|$)/.test(raw)) return 'PR';
  if (raw.includes('CR-HIST') || /(^|\s)CR(\s|$)/.test(raw)) return 'CR';
  return company.tradeName ?? company.legalName;
}

function numberValue(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function emptyForm(companyId = ''): FormState {
  return {
    companyId,
    workName: '',
    contractNumber: '',
    clientName: '',
    signedAt: '',
    startDate: '',
    endDate: '',
    inssRate: '',
    issRate: '',
    retentionRate: '',
    notes: '',
  };
}

export function NewEngineeringContractDialog({ open, companies, initialCompanyId, onClose, onSaved }: Props) {
  const engineeringCompanies = useMemo(
    () => companies.filter(company => companyLabel(company) !== 'Pessoal'),
    [companies],
  );
  const defaultCompanyId = initialCompanyId && engineeringCompanies.some(item => item.id === initialCompanyId)
    ? initialCompanyId
    : engineeringCompanies[0]?.id ?? '';
  const [form, setForm] = useState<FormState>(() => emptyForm(defaultCompanyId));
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm(defaultCompanyId));
    setErrorMessage(null);
  }, [open, defaultCompanyId]);

  const field = (name: keyof FormState, value: string) => {
    setForm(current => ({ ...current, [name]: value }));
  };

  async function submit() {
    if (busy) return;
    const company = engineeringCompanies.find(item => item.id === form.companyId);
    if (!company) {
      setErrorMessage('Selecione a empresa do contrato.');
      return;
    }
    if (!form.workName.trim()) {
      setErrorMessage('Informe o nome da obra.');
      return;
    }
    if (!form.contractNumber.trim()) {
      setErrorMessage('Informe o número do contrato.');
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    try {
      await createContractWithWork(
        { tenantId: company.tenantId, companyId: company.id },
        {
          workName: form.workName,
          contractNumber: form.contractNumber,
          clientName: form.clientName || null,
          signedAt: form.signedAt || null,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          inssRate: numberValue(form.inssRate),
          issRate: numberValue(form.issRate),
          retentionRate: numberValue(form.retentionRate),
          notes: form.notes || null,
        },
      );
      onSaved();
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error && error.message ? error.message : 'Não foi possível cadastrar o contrato.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      title="Novo contrato"
      description="Cadastre o contrato e a obra."
      loading={busy}
      onClose={onClose}
      onBack={onClose}
      onConfirm={() => { void submit(); }}
      confirmLabel="Salvar contrato"
    >
      {errorMessage && <Feedback tone="danger" title="Não foi possível salvar" message={errorMessage} />}
      <div className="engineering-contract-create-form">
        <div className="engineering-contract-create-form__row engineering-contract-create-form__row--two">
          <Select
            label="Empresa *"
            value={form.companyId}
            onChange={event => field('companyId', event.target.value)}
            options={engineeringCompanies.map(item => ({ value: item.id, label: companyLabel(item) }))}
            required
          />
          <Input
            label="Nº do contrato *"
            placeholder="Ex.: 0001"
            value={form.contractNumber}
            onChange={event => field('contractNumber', event.target.value)}
            required
          />
        </div>

        <div className="engineering-contract-create-form__block">
          <Input
            label="Nome da obra *"
            placeholder="Digite o nome da obra"
            value={form.workName}
            onChange={event => field('workName', event.target.value)}
            required
          />
          <p className="engineering-contract-create-form__hint">A obra será criada automaticamente e vinculada a este contrato.</p>
        </div>

        <Input
          label="Cliente"
          placeholder="Digite o nome do cliente"
          value={form.clientName}
          onChange={event => field('clientName', event.target.value)}
        />

        <Input
          label="Assinatura do contrato"
          type="date"
          value={form.signedAt}
          onChange={event => field('signedAt', event.target.value)}
        />

        <div className="engineering-contract-create-form__row engineering-contract-create-form__row--two">
          <Input label="Início" type="date" value={form.startDate} onChange={event => field('startDate', event.target.value)} />
          <Input label="Fim" type="date" value={form.endDate} onChange={event => field('endDate', event.target.value)} />
        </div>

        <div className="engineering-contract-create-form__row engineering-contract-create-form__row--three">
          <Input label="INSS (%)" type="number" placeholder="Ex.: 11,00" value={form.inssRate} onChange={event => field('inssRate', event.target.value)} />
          <Input label="ISS (%)" type="number" placeholder="Ex.: 2,00" value={form.issRate} onChange={event => field('issRate', event.target.value)} />
          <Input label="Retenção técnica (%)" type="number" placeholder="Ex.: 5,00" value={form.retentionRate} onChange={event => field('retentionRate', event.target.value)} />
        </div>

        <Input
          label="Observações"
          placeholder="Informações adicionais..."
          value={form.notes}
          onChange={event => field('notes', event.target.value)}
        />

        <div className="engineering-contract-create-form__notice">
          <strong>Valor do contrato calculado automaticamente</strong>
          <span>O total será formado pelas tabelas de serviços, quantidades e valores unitários cadastrados dentro do contrato.</span>
        </div>
      </div>
    </Dialog>
  );
}
