import type { ReactNode } from 'react';
import { Button } from './Button';

interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm?: () => void;
  onClose: () => void;
}

export function Dialog({
  open,
  title,
  description,
  children,
  confirmLabel = 'Salvar',
  cancelLabel = 'Cancelar',
  loading = false,
  onConfirm,
  onClose,
}: DialogProps) {
  if (!open) return null;

  return (
    <div className="ui-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="ui-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="ui-dialog__header">
          <div>
            <h2 id="dialog-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button className="ui-dialog__close" type="button" onClick={onClose} aria-label="Fechar">×</button>
        </header>
        {children && <div className="ui-dialog__content">{children}</div>}
        <footer className="ui-dialog__footer">
          <Button variant="secondary" onClick={onClose} disabled={loading}>{cancelLabel}</Button>
          {onConfirm && <Button onClick={onConfirm} loading={loading}>{confirmLabel}</Button>}
        </footer>
      </section>
    </div>
  );
}
