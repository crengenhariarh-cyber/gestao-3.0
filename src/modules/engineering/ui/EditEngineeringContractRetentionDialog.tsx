import { useEffect, useState } from 'react';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback, LoadingState } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';

interface Props {
  open: boolean;
  scope: { tenantId: string; companyId: string };
  contractId: string;
  contractNumber: string;
  onClose: () => void;
  onSaved: () => void;
}

type RetentionType = 'inss' | 'iss' | 'rt';

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
    const client = getSupabaseClient();
    void client
      .from('engineering_contract_retention_rules')
      .select('retention_type,rate')
      .eq('tenant_id', scope.tenantId)
      .eq('company_id', scope.companyId)
      .eq('contract_id', contractId)
      .eq('active', true)
      .then(result => {
        if (!active) return;
        if (result.error) throw result.error;
        const values: FormState = { inss: '', iss: '', rt: '' };
        for (const row of result.data ?? []) {
          const type = row.retention_type as RetentionType;
          if (type in values) values[type] = row.rate == null ? '' : String(row.rate).replace('.', ',');
        }
        setForm(values);
      })
      .catch(error => {
        if (active) setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar as retenções do contrato.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [open, scope.tenantId, scope.companyId, contractId]);

  async function save() {
    if (saving) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      const client = getSupabaseClient();
      const values: Array<{ type: RetentionType; rate: number; label: string }> = [
        { type: 'inss', rate: toNumber(form.inss, 'INSS'), label: 'INSS' },
        { type: 'iss', rate: toNumber(form.iss, 'ISS'), label: 'ISS' },
        { type: 'rt', rate: toNumber(form.rt, 'Retenção técnica'), label: 'Retenção técnica' },
      ];

      for (const item of values) {
        const existing = await client
          .from('engineering_contract_retention_rules')
          .select('id')
          .eq('tenant_id', scope.tenantId)
          .eq('company_id', scope.companyId)
          .eq('contract_id', contractId)
          .eq('retention_type', item.type)
          .eq('active', true)
          .maybeSingle();
        if (existing.error) throw existing.error;

        if (item.rate === 0) {
          if (existing.data?.id) {
            const disabled = await client
              .from('engineering_contract_retention_rules')
              .update({ active: false, updated_at: new Date().toISOString() })
              .eq('tenant_id', scope.tenantId)
              .eq('company_id', scope.companyId)
              .eq('id', existing.data.id);
            if (disabled.error) throw disabled.error;
          }
          continue;
        }

        if (existing.data?.id) {
          const updated = await client
            .from('engineering_contract_retention_rules')
            .update({ calculation_type: 'percentage', rate: item.rate, fixed_amount: null, updated_at: new Date().toISOString() })
            .eq('tenant_id', scope.tenantId)
            .eq('company_id', scope.companyId)
            .eq('id', existing.data.id);
          if (updated.error) throw updated.error;
        } else {
          const inserted = await client.from('engineering_contract_retention_rules').insert({
            tenant_id: scope.tenantId,
            company_id: scope.companyId,
            contract_id: contractId,
            retention_type: item.type,
            calculation_type: 'percentage',
            rate: item.rate,
            fixed_amount: null,
            description: item.label,
            active: true,
          });
          if (inserted.error) throw inserted.error;
        }
      }

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
      description="Altere as retenções fiscais e técnicas aplicadas às novas medições deste contrato."
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
