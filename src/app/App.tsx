import { BrowserRouter } from 'react-router-dom';
import { LoginPage } from '../modules/platform/ui/LoginPage';
import { usePlatformSession } from '../modules/platform/ui/usePlatformSession';
import { LoadingState } from '../shared/ui/Feedback';
import { AppErrorBoundary } from './AppErrorBoundary';
import { AppShell } from './AppShell';
import './shell.css';
import './final.css';

export function App() {
  const session = usePlatformSession();

  if (session.status === 'loading') {
    return (
      <main className="app-page app-page--centered">
        <LoadingState label="Carregando sessão…" />
      </main>
    );
  }

  if (session.status === 'anonymous' || session.status === 'error') {
    return (
      <LoginPage
        loading={false}
        errorMessage={session.errorMessage}
        noticeMessage={session.noticeMessage}
        onSignIn={session.signIn}
        onBootstrapFirstOwner={session.bootstrapFirstOwner}
      />
    );
  }

  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <AppShell session={session} />
      </BrowserRouter>
    </AppErrorBoundary>
  );
}
