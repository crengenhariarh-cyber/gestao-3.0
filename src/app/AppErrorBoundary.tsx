import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '../shared/ui/Button';
import { Feedback } from '../shared/ui/Feedback';

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Falha inesperada na interface do Gestão 3.0', error, info);
  }

  private reload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="app-page app-page--centered" role="alert">
        <Feedback
          tone="danger"
          title="Não foi possível exibir esta tela"
          message="A aplicação encontrou um erro inesperado. Nenhuma alteração nova foi enviada por esta tela após a falha."
        />
        <Button onClick={this.reload}>Recarregar aplicação</Button>
      </main>
    );
  }
}
