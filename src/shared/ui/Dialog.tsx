import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
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

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

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
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousActiveElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(focusableSelector);
    firstFocusable?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus();
    };
  }, [open]);

  if (!open) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && !loading) {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
    );
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }

    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="ui-dialog-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="ui-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
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

          <Button
            variant="tertiary"
            size="sm"
            className="ui-dialog__close"
            onClick={onClose}
            aria-label="Fechar"
            title="Fechar"
            disabled={loading}
          >
            ×
          </Button>
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
