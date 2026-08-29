import { describe, expect, it } from 'vitest';
import { splitAmountIntoInstallments } from './installmentMath';

describe('splitAmountIntoInstallments', () => {
  it('preserves the exact total in cents', () => {
    const installments = splitAmountIntoInstallments(100, 3);
    expect(installments).toEqual([
      { installmentNumber: 1, installmentCount: 3, amount: 33.34 },
      { installmentNumber: 2, installmentCount: 3, amount: 33.33 },
      { installmentNumber: 3, installmentCount: 3, amount: 33.33 },
    ]);
    expect(Math.round(installments.reduce((sum, item) => sum + item.amount, 0) * 100)).toBe(10000);
  });

  it('represents one-time payments as 1/1', () => {
    expect(splitAmountIntoInstallments(123.45, 1)).toEqual([
      { installmentNumber: 1, installmentCount: 1, amount: 123.45 },
    ]);
  });

  it('rejects invalid installment counts', () => {
    expect(() => splitAmountIntoInstallments(100, 0)).toThrow('installmentCount must be a positive integer');
    expect(() => splitAmountIntoInstallments(100, 1.5)).toThrow('installmentCount must be a positive integer');
  });

  it('rejects invalid totals', () => {
    expect(() => splitAmountIntoInstallments(0, 2)).toThrow('totalAmount must be greater than zero');
  });
});
