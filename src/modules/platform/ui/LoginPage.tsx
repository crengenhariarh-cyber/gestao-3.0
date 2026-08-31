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
  const [bootstrapCode, setBootstrapCode] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [companyName, setCompanyName] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (setupMode) {
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

  return (
    <main className="auth-page">
      <div className="auth-page__panel">
        <div className="auth-page__brand">
          <span className="auth-page__eyebrow">Gestão 3.0</span>
          <h1>{setupMode ? 'Primeiro acesso' : 'Entrar'}</h1>
          <p>{setupMode ? 'Crie o proprietário inicial e a primeira empresa do ambiente.' : 'Acesso seguro por empresa e permissões autorizadas.'}</p>
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
            {noticeMessage && <Feedback tone="success" title="Primeiro acesso" message={noticeMessage} />}
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
            <Button type="button" variant="tertiary" disabled={loading} onClick={() => setSetupMode((current) => !current)}>
              {setupMode ? 'Já tenho acesso' : 'Configurar primeiro acesso'}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
