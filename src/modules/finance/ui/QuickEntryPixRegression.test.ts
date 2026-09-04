import { describe, expect, it } from 'vitest';
import quickEntrySource from './QuickEntryDialog.tsx?raw';

describe('quick entry Pix regression guard', () => {
  it('keeps Pix single entries tied to a bank account and auto-settled', () => {
    expect(quickEntrySource).toContain("form.paymentMethod === 'pix' && form.launchType === 'single' && !form.accountRef");
    expect(quickEntrySource).toContain("payment_method: form.paymentMethod");
    expect(quickEntrySource).toContain('await operations.settleInstallment({');
    expect(quickEntrySource).toContain("idempotencyKey('quick-pix-settlement')");
    expect(quickEntrySource).toContain("window.dispatchEvent(new Event('finance-bank-order-changed'))");
  });

  it('does not auto-settle installment or recurring Pix as an immediate single payment', () => {
    expect(quickEntrySource).toContain("form.paymentMethod === 'pix' && form.launchType === 'single'");
  });
});
