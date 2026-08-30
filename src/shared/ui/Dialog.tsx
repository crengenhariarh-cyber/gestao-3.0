import { useId, type ReactNode } from 'react';
import { Button } from './Button';

interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  backLabel?: string;
  loading?: boolean;
  onConfirm?: () => void;
  onBack?: () => void;
  onClose: () => void;
}

export function Dialog({
  open,
  title,
  description,
  children,
  confirmLabel = 'Salvar',
  backLabel = 'Voltar',
  loading = false,
  onConfirm,
  onBack,
  onClose,
}: DialogProps) {
  const titleId = useId();

  if (!open) return null;

  return (
    <div className="ui-dialog-backdrop" role="presentation">
      <section
        className="ui-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="ui-dialog__header">
          <div className="ui-dialog__header-main">
            <Button
              variant="secondary"
              size="sm"
              onClick={onBack ?? onClose}
              disabled={loading}
            >
              ← {backLabel}
            </Button>
            <div className="ui-dialog__heading">
              <h2 id={titleId}>{title}</h2>
              {description && <p>{description}</p>}
            </div>
          </div>

          <button
            className="ui-dialog__close"
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            title="Fechar"
            disabled={loading}
          >
            ×
          </button>
        </header>

        <div className="ui-dialog__content">{children}</div>

        {onConfirm && (
          <footer className="ui-dialog__footer">
            <Button onClick={onConfirm} loading={loading}>
              {confirmLabel}
            </Button>
          </footer>
        )}
      </section>
    </div>
  );
}
