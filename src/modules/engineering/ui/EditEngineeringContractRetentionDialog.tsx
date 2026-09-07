import { useEffect, useState } from 'react';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback, LoadingState } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { loadContractRetentions, saveContractRetentions } from '../infrastructure/EngineeringContractModalRepository';

interface Props {
  open: boolean;
  scope: { tenantId: string; companyId: string };
  contractId: string;
  contractNumber: string;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  inss: string;
  iss: string;
  rt: string;
}

function toNumber(value: string, label: string) {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return 0;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed >= 100) throw new Error(`${label} inválido.`);
  return parsed;
}

export function EditEngineeringContractRetentionDialog({ open, scope, contractId, contractNumber, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>({ inss: '', iss: '', rt: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setErrorMessage(null);
    void loadContractRetentions(scope, contractId)
      .then(values => {
        if (!active) return;
        setForm({
          inss: values.inss ? String(values.inss).replace('.', ',') : '',
          iss: values.iss ? String(values.iss).replace('.', ',') : '',
          rt: values.rt ? String(values.rt).replace('.', ',') : '',
        });
      })
      .catch(error => {
        if (active) setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar as retenções do contrato.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [open, scope, contractId]);

  async function save() {
    if (saving) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      await saveContractRetentions(scope, contractId, {
        inss: toNumber(form.inss, 'INSS'),
        iss: toNumber(form.iss, 'ISS'),
        rt: toNumber(form.rt, 'Retenção técnica'),
      });
      onSaved();
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error && error.message ? error.message : 'Não foi possível salvar as retenções do contrato.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      title={`Editar contrato ${contractNumber}`}
      description="Altere INSS, ISS e a retenção técnica padrão deste contrato."
      loading={saving}
      onClose={onClose}
      onBack={onClose}
      onConfirm={() => { void save(); }}
      confirmLabel="Salvar alterações"
    >
      {loading ? <LoadingState label="Carregando retenções…" /> : (
        <div className="engineering-contract-create-form">
          {errorMessage && <Feedback tone="danger" title="Não foi possível salvar" message={errorMessage} />}
          <div className="engineering-contract-create-form__row engineering-contract-create-form__row--three">
            <Input label="INSS (%)" type="number" inputMode="decimal" value={form.inss} onChange={event => setForm(current => ({ ...current, inss: event.target.value }))} />
            <Input label="ISS (%)" type="number" inputMode="decimal" value={form.iss} onChange={event => setForm(current => ({ ...current, iss: event.target.value }))} />
            <Input label="Retenção técnica (%)" type="number" inputMode="decimal" value={form.rt} onChange={event => setForm(current => ({ ...current, rt: event.target.value }))} />
          </div>
          <div className="engineering-contract-create-form__notice">
            <strong>Regra do contrato</strong>
            <span>As porcentagens salvas serão usadas como padrão nas próximas medições. Informe 0 para desativar uma retenção.</span>
          </div>
        </div>
      )}
    </Dialog>
  );
}
