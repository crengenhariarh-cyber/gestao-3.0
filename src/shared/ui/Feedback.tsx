import { useEffect, useState } from 'react';

type FeedbackTone = 'info' | 'success' | 'warning' | 'danger';

interface FeedbackProps {
  title: string;
  message?: string;
  tone?: FeedbackTone;
  persistent?: boolean;
  dismissAfterMs?: number;
}

const DEFAULT_DISMISS_MS: Record<FeedbackTone, number> = {
  success: 2500,
  info: 3500,
  warning: 4500,
  danger: 5000,
};

export function Feedback({ title, message, tone = 'info', persistent = false, dismissAfterMs }: FeedbackProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    if (persistent) return;
    const timeout = window.setTimeout(() => setVisible(false), dismissAfterMs ?? DEFAULT_DISMISS_MS[tone]);
    return () => window.clearTimeout(timeout);
  }, [dismissAfterMs, message, persistent, title, tone]);

  if (!visible) return null;

  return (
    <div className={`ui-feedback ui-feedback--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <strong>{title}</strong>
      {message && <span>{message}</span>}
    </div>
  );
}

export function LoadingState({ label = 'Carregando…' }: { label?: string }) {
  return <div className="ui-state ui-state--loading" aria-live="polite">{label}</div>;
}

export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <div className="ui-state">
      <strong>{title}</strong>
      {message && <span>{message}</span>}
    </div>
  );
}
