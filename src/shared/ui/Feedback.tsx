type FeedbackTone = 'info' | 'success' | 'warning' | 'danger';

interface FeedbackProps {
  title: string;
  message?: string;
  tone?: FeedbackTone;
}

export function Feedback({ title, message, tone = 'info' }: FeedbackProps) {
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
