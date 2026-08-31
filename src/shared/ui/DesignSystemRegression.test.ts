/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import appSource from '../../app/App.tsx?raw';
import appShellSource from '../../app/AppShell.tsx?raw';
import engineeringOperationsSource from '../../modules/engineering/ui/EngineeringOperationsPanel.tsx?raw';
import engineeringMaintenanceSource from '../../modules/engineering/ui/EngineeringProvisionalMaintenance.tsx?raw';
import financeSource from '../../modules/finance/ui/FinancePage.tsx?raw';
import hrSource from '../../modules/hr/ui/HrBudgetPage.tsx?raw';
import buttonSource from './Button.tsx?raw';
import dialogSource from './Dialog.tsx?raw';

const operationalSources = [
  financeSource,
  hrSource,
  engineeringOperationsSource,
  engineeringMaintenanceSource,
];

describe('Design System final regression', () => {
  it('keeps business controls on shared UI primitives', () => {
    for (const source of operationalSources) {
      expect(source).not.toMatch(/<button\b/);
      expect(source).not.toMatch(/<input\b/);
      expect(source).not.toMatch(/<select\b/);
      expect(source).not.toMatch(/<dialog\b/);
      expect(source).toContain("shared/ui/");
    }
  });

  it('keeps shared buttons safe outside explicit forms', () => {
    expect(buttonSource).toContain("type = 'button'");
    expect(buttonSource).toContain('type={type}');
  });

  it('keeps the approved modal interaction contract', () => {
    expect(dialogSource).toContain('aria-modal="true"');
    expect(dialogSource).toContain('aria-labelledby={titleId}');
    expect(dialogSource).toContain('aria-describedby={description ? descriptionId : undefined}');
    expect(dialogSource).toContain('event.key === \'Escape\'');
    expect(dialogSource).toContain('event.key !== \'Tab\'');
    expect(dialogSource).toContain('← {backLabel}');
    expect(dialogSource).toContain('aria-label="Fechar"');
    expect(dialogSource).toContain('ui-dialog__footer');
  });

  it('keeps final production navigation free of the UI laboratory', () => {
    expect(appShellSource).not.toContain('UiLab');
    expect(appShellSource).not.toContain('/ui-lab');
    expect(appShellSource).toContain('href="#app-main"');
  });

  it('keeps the final resilience layer enabled', () => {
    expect(appSource).toContain('AppErrorBoundary');
    expect(appSource).toContain("import './final.css'");
  });
});
