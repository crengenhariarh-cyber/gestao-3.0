import { useState, type FormEvent } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Feedback } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';

export interface LoginPageProps {
  loading: boolean;
  errorMessage: string | null;
  onSignIn(email: string, password: string): Promise<void>;
}

export function LoginPage({ loading, errorMessage, onSignIn }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSignIn(email.trim(), password);
  }

  return (
    <main className="auth-page">
      <div className="auth-page__panel">
        <div className="auth-page__brand">
          <span className="auth-page__eyebrow">Gestão 3.0</span>
          <h1>Entrar</h1>
          <p>Acesso seguro por empresa e permissões autorizadas.</p>
        </div>

        <Card>
          <form className="ui-stack" onSubmit={handleSubmit}>
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
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {errorMessage && (
              <Feedback tone="danger" title="Não foi possível entrar">
                {errorMessage}
              </Feedback>
            )}
            <Button type="submit" size="lg" disabled={loading} loading={loading}>
              Entrar
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
