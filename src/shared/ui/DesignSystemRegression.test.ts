/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import appShellSource from '../../app/AppShell.tsx?raw';
import shellCssSource from '../../app/shell.css?raw';
import engineeringOperationsSource from '../../modules/engineering/ui/EngineeringOperationsPanel.tsx?raw';
import engineeringMaintenanceSource from '../../modules/engineering/ui/EngineeringProvisionalMaintenance.tsx?raw';
import engineeringCssSource from '../../modules/engineering/ui/engineering.css?raw';
import financeSource from '../../modules/finance/ui/FinancePage.tsx?raw';
import financeCssSource from '../../modules/finance/ui/finance.css?raw';
import hrSource from '../../modules/hr/ui/HrBudgetPage.tsx?raw';
import hrCssSource from '../../modules/hr/ui/hr.css?raw';
import loginSource from '../../modules/platform/ui/LoginPage.tsx?raw';
import authGatewaySource from '../../modules/platform/infrastructure/SupabaseAuthGateway.ts?raw';
import buttonSource from './Button.tsx?raw';
import dialogSource from './Dialog.tsx?raw';
import stylesSource from './styles.css?raw';

const operationalSources = [financeSource, hrSource, engineeringOperationsSource, engineeringMaintenanceSource];
const moduleCssSources = [financeCssSource, hrCssSource, engineeringCssSource, shellCssSource];

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

  it('keeps module CSS free of legacy parallel color tokens and hardcoded palette', () => {
    for (const source of moduleCssSources) {
      expect(source).not.toContain('--color-border');
      expect(source).not.toContain('--color-text-muted');
      expect(source).not.toContain('--ui-border');
      expect(source).not.toMatch(/#[0-9a-fA-F]{6}\b/);
    }
  });

  it('keeps desktop light and mobile dark theme centralized in shared tokens', () => {
    expect(stylesSource).toContain('color-scheme: light');
    expect(stylesSource).toContain('@media(max-width:760px)');
    expect(stylesSource).toContain('color-scheme:dark');
    expect(stylesSource).toContain('--surface:');
    expect(stylesSource).toContain('--text:');
    expect(stylesSource).toContain('--border:');
  });

  it('keeps shared buttons safe outside explicit forms', () => {
    expect(buttonSource).toContain("type = 'button'");
    expect(buttonSource).toContain('type={type}');
  });

  it('keeps the approved fullscreen modal semantics', () => {
    expect(dialogSource).toContain('aria-modal="true"');
    expect(dialogSource).toContain('aria-labelledby={titleId}');
    expect(dialogSource).toContain('aria-describedby={description ? descriptionId : undefined}');
    expect(dialogSource).toContain('← {backLabel}');
    expect(dialogSource).toContain('aria-label="Fechar"');
    expect(stylesSource).toContain('height:100dvh');
    expect(stylesSource).toContain('grid-template-rows:auto minmax(0,1fr) auto');
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
