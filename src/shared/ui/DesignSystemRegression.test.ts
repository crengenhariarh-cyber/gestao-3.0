/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import appSource from '../../app/App.tsx?raw';
import appShellSource from '../../app/AppShell.tsx?raw';
import finalCssSource from '../../app/final.css?raw';
import shellCssSource from '../../app/shell.css?raw';
import centralMenuCssSource from '../../app/central-menu.css?raw';
import mainSource from '../../main.tsx?raw';
import engineeringOperationsSource from '../../modules/engineering/ui/EngineeringOperationsPanel.tsx?raw';
import engineeringMaintenanceSource from '../../modules/engineering/ui/EngineeringProvisionalMaintenance.tsx?raw';
import engineeringCssSource from '../../modules/engineering/ui/engineering.css?raw';
import banksSource from '../../modules/finance/ui/BanksPage.tsx?raw';
import financeSource from '../../modules/finance/ui/FinancePage.tsx?raw';
import monthlyAccountsSource from '../../modules/finance/ui/MonthlyAccountsPage.tsx?raw';
import quickEntrySource from '../../modules/finance/ui/QuickEntryDialog.tsx?raw';
import financeCssSource from '../../modules/finance/ui/finance.css?raw';
import monthlyAccountsCssSource from '../../modules/finance/ui/monthly-accounts.css?raw';
import quickEntryCssSource from '../../modules/finance/ui/quick-entry.css?raw';
import homeSource from '../../modules/home/ui/HomePage.tsx?raw';
import homeCssSource from '../../modules/home/ui/home.css?raw';
import bankBrandCssSource from '../../modules/home/ui/bank-brand.css?raw';
import hrSource from '../../modules/hr/ui/HrBudgetPage.tsx?raw';
import hrCssSource from '../../modules/hr/ui/hr.css?raw';
import loginSource from '../../modules/platform/ui/LoginPage.tsx?raw';
import authGatewaySource from '../../modules/platform/infrastructure/SupabaseAuthGateway.ts?raw';
import buttonSource from './Button.tsx?raw';
import dialogSource from './Dialog.tsx?raw';
import sharedStylesSource from './styles.css?raw';

const operationalSources = [
  homeSource,
  financeSource,
  banksSource,
  monthlyAccountsSource,
  quickEntrySource,
  hrSource,
  engineeringOperationsSource,
  engineeringMaintenanceSource,
];

const nonCanonicalCssSources = [
  finalCssSource,
  shellCssSource,
  centralMenuCssSource,
  financeCssSource,
  monthlyAccountsCssSource,
  quickEntryCssSource,
  homeCssSource,
  bankBrandCssSource,
  hrCssSource,
  engineeringCssSource,
];

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

  it('keeps canonical component appearance centralized in shared styles', () => {
    expect(sharedStylesSource).toContain('--primary:#2563eb');
    expect(sharedStylesSource).toContain('.ui-button--primary');
    expect(sharedStylesSource).toContain('.ui-card{');
    expect(sharedStylesSource).toContain('.ui-dialog{');
    expect(sharedStylesSource).toContain('.ui-tab{');
    expect(sharedStylesSource).toContain('.ui-input{');

    for (const css of nonCanonicalCssSources) {
      expect(css).not.toContain(':has(');
      expect(css).not.toMatch(/\.ui-button--(?:primary|secondary|tertiary|success|danger)\s*\{/);
      expect(css).not.toMatch(/\.ui-dialog(?:__|\s|\{|\.)/);
      expect(css).not.toMatch(/\.ui-tab(?:--|__|\s|\{|\.)/);
      expect(css).not.toMatch(/\.ui-input(?:--|\s|\{|\.)/);
      expect(css).not.toMatch(/\.ui-(?:button|card|dialog|tab|input)[^{]*:(?:nth-child|first-child|last-child|last-of-type)\(/);
    }
  });

  it('keeps legacy visual layers out of production imports', () => {
    expect(appSource).not.toContain('home-polish.css');
    expect(mainSource).not.toContain('modal-theme.css');
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
