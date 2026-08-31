import { useState, type FormEvent } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Feedback } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';

export interface LoginPageProps {
  loading: boolean;
  errorMessage: string | null;
  noticeMessage: string | null;
  onSignIn: (email: string, password: string) => Promise<void>;
  onBootstrapFirstOwner: (input: {
    email: string;
    password: string;
    bootstrapCode: string;
    tenantName: string;
    companyName: string;
  }) => Promise<void>;
}

export function LoginPage({ loading, errorMessage, noticeMessage, onSignIn, onBootstrapFirstOwner }: LoginPageProps) {
  const [setupMode, setSetupMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [bootstrapCode, setBootstrapCode] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationMessage(null);

    if (setupMode) {
      if (password !== confirmPassword) {
        setValidationMessage('As senhas informadas não são iguais.');
        return;
      }
      void onBootstrapFirstOwner({
        email: email.trim(),
        password,
        bootstrapCode: bootstrapCode.trim(),
        tenantName: tenantName.trim(),
        companyName: companyName.trim(),
      });
      return;
    }
    void onSignIn(email.trim(), password);
  }

  function toggleSetupMode() {
    setValidationMessage(null);
    setConfirmPassword('');
    setSetupMode((current) => !current);
  }

  return (
    <main className="auth-page">
      <div className="auth-page__panel">
        <div className="auth-page__brand" aria-label="Gestão">
          <img className="auth-page__logo" src="/gestao-icon.svg" alt="Gestão" />
        </div>

        <Card>
          <form className="ui-stack" onSubmit={handleSubmit}>
            {setupMode && (
              <>
                <Input label="Organização" value={tenantName} onChange={(event) => setTenantName(event.target.value)} required />
                <Input label="Empresa inicial" value={companyName} onChange={(event) => setCompanyName(event.target.value)} required />
                <Input label="Código inicial" value={bootstrapCode} onChange={(event) => setBootstrapCode(event.target.value)} required />
              </>
            )}
            <Input
              label="E-mail"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <Input
              label="Senha"
              type="password"
              autoComplete={setupMode ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {setupMode && (
              <Input
                label="Confirmar senha"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            )}
            {noticeMessage && <Feedback tone="success" title="Primeiro acesso" message={noticeMessage} />}
            {validationMessage && <Feedback tone="danger" title="Confira os dados" message={validationMessage} />}
            {errorMessage && (
              <Feedback
                tone="danger"
                title={setupMode ? 'Não foi possível criar o acesso' : 'Não foi possível entrar'}
                message={errorMessage}
              />
            )}
            <Button type="submit" size="lg" disabled={loading} loading={loading}>
              {setupMode ? 'Criar primeiro acesso' : 'Entrar'}
            </Button>
            <Button type="button" variant="tertiary" disabled={loading} onClick={toggleSetupMode}>
              {setupMode ? 'Voltar para entrar' : 'Configurar primeiro acesso'}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
