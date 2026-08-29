export interface InstallmentAmount {
  installmentNumber: number;
  installmentCount: number;
  amount: number;
}

export function splitAmountIntoInstallments(totalAmount: number, installmentCount: number): readonly InstallmentAmount[] {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) throw new Error('totalAmount must be greater than zero');
  if (!Number.isInteger(installmentCount) || installmentCount < 1) throw new Error('installmentCount must be a positive integer');

  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / installmentCount);
  const remainder = totalCents % installmentCount;

  return Array.from({ length: installmentCount }, (_, index) => {
    const installmentNumber = index + 1;
    const cents = baseCents + (installmentNumber <= remainder ? 1 : 0);
    return { installmentNumber, installmentCount, amount: cents / 100 };
  });
}
