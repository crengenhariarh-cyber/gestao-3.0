/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import appShellSource from '../../app/AppShell.tsx?raw';
import engineeringOperationsSource from '../../modules/engineering/ui/EngineeringOperationsPanel.tsx?raw';
import engineeringMaintenanceSource from '../../modules/engineering/ui/EngineeringProvisionalMaintenance.tsx?raw';
import financeSource from '../../modules/finance/ui/FinancePage.tsx?raw';
import hrSource from '../../modules/hr/ui/HrBudgetPage.tsx?raw';
import loginSource from '../../modules/platform/ui/LoginPage.tsx?raw';
import authGatewaySource from '../../modules/platform/infrastructure/SupabaseAuthGateway.ts?raw';
import buttonSource from './Button.tsx?raw';
import dialogSource from './Dialog.tsx?raw';

const operationalSources = [financeSource, hrSource, engineeringOperationsSource, engineeringMaintenanceSource];

describe('Design System final regression', () => {
  it('keeps business controls on shared UI primitives', () => {
    for (const source of operationalSources) {
      expect(source).not.toMatch(/<button\b/);
      expect(source).not.toMatch(/<input\b/);
      expect(source).not.toMatch(/<select\b/);
      expect(source).not.toMatch(/<textarea\b/);
      expect(source).not.toMatch(/<dialog\b/);
      expect(source).not.toMatch(/style=\{\{/);
      expect(source).not.toMatch(/className=["'`]ui-card\b/);
    }
  });

  it('keeps shared buttons safe outside explicit forms', () => {
    expect(buttonSource).toContain("type = 'button'");
    expect(buttonSource).toContain('type={type}');
  });

  it('keeps the approved fullscreen modal semantics in the canonical Dialog', () => {
    expect(dialogSource).toContain('role="dialog"');
    expect(dialogSource).toContain('aria-modal="true"');
    expect(dialogSource).toContain('aria-labelledby={titleId}');
    expect(dialogSource).toContain('aria-describedby={description ? descriptionId : undefined}');
    expect(dialogSource).toContain('← {backLabel}');
    expect(dialogSource).toContain('aria-label="Fechar"');
    expect(dialogSource).toContain('className="ui-dialog"');
    expect(dialogSource).toContain('className="ui-dialog__header"');
    expect(dialogSource).toContain('className="ui-dialog__content"');
    expect(dialogSource).toContain('className="ui-dialog__footer"');
  });

  it('keeps final production navigation free of the UI laboratory', () => {
    expect(appShellSource).not.toContain('UiLab');
    expect(appShellSource).not.toContain('/ui-lab');
    expect(appShellSource).toContain('href="#app-main"');
  });

  it('keeps secure first-access wiring', () => {
    expect(loginSource).toContain('Configurar primeiro acesso');
    expect(loginSource).toContain('Código inicial');
    expect(authGatewaySource).toContain('signUpFirstOwner');
    expect(authGatewaySource).toContain("gestao_bootstrap: 'true'");
    expect(authGatewaySource).toContain('gestao_bootstrap_code');
  });
});
