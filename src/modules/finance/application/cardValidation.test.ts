import { describe, expect, it } from 'vitest';
import { normalizeCardPurchase } from './cardValidation';

const base = {
  tenantId: ' tenant ',
  companyId: ' company ',
  cardId: ' card ',
  purchaseDate: '2026-09-11',
  description: ' compra ',
  counterpartyName: ' fornecedor ',
  categoryId: ' category ',
  costCenterId: ' cost ',
  totalAmount: 100,
  installmentCount: 3,
  idempotencyKey: ' purchase-1 ',
  notes: ' observação ',
};

describe('normalizeCardPurchase', () => {
  it('normalizes required and optional strings', () => {
    expect(normalizeCardPurchase(base)).toEqual({
      tenantId: 'tenant', companyId: 'company', cardId: 'card', purchaseDate: '2026-09-11',
      description: 'compra', counterpartyName: 'fornecedor', categoryId: 'category', costCenterId: 'cost',
      totalAmount: 100, installmentCount: 3, idempotencyKey: 'purchase-1', notes: 'observação',
    });
  });

  it('rejects invalid money and installment counts', () => {
    expect(() => normalizeCardPurchase({ ...base, totalAmount: 0 })).toThrow(/greater than zero/);
    expect(() => normalizeCardPurchase({ ...base, totalAmount: 10.001 })).toThrow(/two decimal/);
    expect(() => normalizeCardPurchase({ ...base, installmentCount: 0 })).toThrow(/between 1 and 120/);
  });

  it('rejects zero-value installments', () => {
    expect(() => normalizeCardPurchase({ ...base, totalAmount: 0.02, installmentCount: 3 })).toThrow(/too small/);
  });

  it('requires ISO date and idempotency key', () => {
    expect(() => normalizeCardPurchase({ ...base, purchaseDate: '11/09/2026' })).toThrow(/YYYY-MM-DD/);
    expect(() => normalizeCardPurchase({ ...base, idempotencyKey: ' ' })).toThrow(/idempotencyKey/);
  });
});
