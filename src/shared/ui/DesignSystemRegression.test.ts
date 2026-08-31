/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import appShellSource from '../../app/AppShell.tsx?raw';
import finalCssSource from '../../app/final.css?raw';
import engineeringOperationsSource from '../../modules/engineering/ui/EngineeringOperationsPanel.tsx?raw';
import engineeringMaintenanceSource from '../../modules/engineering/ui/EngineeringProvisionalMaintenance.tsx?raw';
import financeSource from '../../modules/finance/ui/FinancePage.tsx?raw';
import hrSource from '../../modules/hr/ui/HrBudgetPage.tsx?raw';
import buttonSource from './Button.tsx?raw';
import dialogSource from './Dialog.tsx?raw';
import sharedStylesSource from './styles.css?raw';

const operationalSources = [
  financeSource,
  hrSource,
  engineeringOperationsSource,
  engineeringMaintenanceSource,
];

describe('Design System final regression', () => {
  it('keeps business controls on shared UI primitives', () => {
    for (const source of operationalSources) {
      expect(source).not.toMatch(/<button\b/i);
      expect(source).not.toMatch(/<input\b/i);
      expect(source).not.toMatch(/<select\b/i);
      expect(source).not.toMatch(/<dialog\b/i);
    }
  });

  it('keeps shared buttons safe outside explicit forms', () => {
    expect(buttonSource).toContain("type = 'button'");
    expect(buttonSource).toContain('type={type}');
  });

  it('keeps the approved fullscreen modal contract', () => {
    expect(dialogSource).toContain('aria-modal="true"');
    expect(dialogSource).toContain('aria-labelledby={titleId}');
    expect(dialogSource).toContain('aria-describedby={description ? descriptionId : undefined}');
    expect(dialogSource).toContain('← {backLabel}');
    expect(dialogSource).toContain('aria-label="Fechar"');
    expect(sharedStylesSource).toMatch(/\.ui-dialog\s*\{[^}]*height:\s*100dvh/s);
    expect(sharedStylesSource).toMatch(/\.ui-dialog__header\s*\{[^}]*position:\s*sticky/s);
    expect(sharedStylesSource).toMatch(/\.ui-dialog__footer\s*\{[^}]*position:\s*sticky/s);
  });

  it('keeps final production navigation free of the UI laboratory', () => {
    expect(appShellSource).not.toContain('UiLab');
    expect(appShellSource).not.toContain('/ui-lab');
    expect(appShellSource).toContain('href="#app-main"');
  });

  it('keeps safe-area and reduced-motion final polish', () => {
    expect(finalCssSource).toContain('env(safe-area-inset-top)');
    expect(finalCssSource).toContain('env(safe-area-inset-bottom)');
    expect(finalCssSource).toContain('prefers-reduced-motion: reduce');
  });
});
