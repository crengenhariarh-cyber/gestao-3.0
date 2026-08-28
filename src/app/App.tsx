import { BrowserRouter } from 'react-router-dom';
import { LoginPage } from '../modules/platform/ui/LoginPage';
import { usePlatformSession } from '../modules/platform/ui/usePlatformSession';
import { LoadingState } from '../shared/ui/Feedback';
import { AppShell } from './AppShell';
import './shell.css';

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
        onSignIn={session.signIn}
      />
    );
  }

  return (
    <BrowserRouter>
      <AppShell session={session} />
    </BrowserRouter>
  );
}
