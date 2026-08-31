import { useMemo, useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback } from '../../../shared/ui/Feedback';
import { Select } from '../../../shared/ui/Select';
import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';
import type { EngineeringAddendumSummary } from '../domain/overview';

interface Props {
  addenda: readonly EngineeringAddendumSummary[];
  onChanged: () => void;
}

export function EngineeringAddendumMaintenance({ addenda, onChanged }: Props) {
  const client = useMemo(() => getSupabaseClient(), []);
  const [open, setOpen] = useState(false);
  const [addendumId, setAddendumId] = useState('');
  const [action, setAction] = useState<'effective' | 'cancel'>('effective');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const drafts = addenda.filter((item) => item.status === 'draft');
  const options = [
    { value: '', label: 'Selecione…' },
    ...drafts.map((item) => ({ value: item.id, label: `${item.addendumNumber} · ${item.addendumType}` })),
  ];

  function close() {
    if (busy) return;
    setOpen(false);
    setErrorMessage(null);
  }

  async function save() {
    setBusy(true);
    setErrorMessage(null);
    const result = await client.rpc('set_contract_addendum_status', {
      p_addendum_id: addendumId,
      p_action: action,
    });
    setBusy(false);
    if (result.error) {
      setErrorMessage(result.error.message || 'Não foi possível atualizar o aditivo.');
      return;
    }
    setOpen(false);
    setAddendumId('');
    setAction('effective');
    onChanged();
  }

  return <>
    <div className="engineering-actions">
      <Button size="sm" variant="secondary" onClick={() => { setAddendumId(''); setAction('effective'); setErrorMessage(null); setOpen(true); }} disabled={drafts.length === 0}>
        Efetivar / cancelar aditivo
      </Button>
    </div>
    <Dialog open={open} title="Status do aditivo" description="Somente aditivos em rascunho podem ser efetivados ou cancelados." loading={busy} onClose={close} onBack={close} onConfirm={() => { void save(); }}>
      {errorMessage && <Feedback tone="danger" title="Não foi possível atualizar" message={errorMessage} />}
      <div className="engineering-form-grid">
        <Select label="Aditivo" value={addendumId} onChange={(event) => setAddendumId(event.target.value)} options={options} required />
        <Select label="Ação" value={action} onChange={(event) => setAction(event.target.value as 'effective' | 'cancel')} options={[{ value: 'effective', label: 'Efetivar' }, { value: 'cancel', label: 'Cancelar' }]} required />
      </div>
    </Dialog>
  </>;
}
