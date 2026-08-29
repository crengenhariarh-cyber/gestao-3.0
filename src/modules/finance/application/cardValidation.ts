import type { CreateCardPurchase } from '../domain/cards';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeCardPurchase(raw: CreateCardPurchase): CreateCardPurchase {
  const tenantId = raw.tenantId.trim();
  const companyId = raw.companyId.trim();
  const cardId = raw.cardId.trim();
  const description = raw.description.trim();
  const categoryId = raw.categoryId.trim();
  const idempotencyKey = raw.idempotencyKey.trim();
  const counterpartyName = raw.counterpartyName?.trim() || null;
  const costCenterId = raw.costCenterId?.trim() || null;
  const notes = raw.notes?.trim() || null;

  if (!tenantId) throw new Error('tenantId is required');
  if (!companyId) throw new Error('companyId is required');
  if (!cardId) throw new Error('cardId is required');
  if (!description) throw new Error('description is required');
  if (!categoryId) throw new Error('categoryId is required');
  if (!DATE_PATTERN.test(raw.purchaseDate)) throw new Error('purchaseDate must use YYYY-MM-DD');
  if (!Number.isFinite(raw.totalAmount) || raw.totalAmount <= 0) throw new Error('totalAmount must be greater than zero');
  if (Math.round(raw.totalAmount * 100) !== raw.totalAmount * 100) throw new Error('totalAmount supports at most two decimal places');
  if (!Number.isInteger(raw.installmentCount) || raw.installmentCount < 1 || raw.installmentCount > 120) {
    throw new Error('installmentCount must be between 1 and 120');
  }
  if (Math.round(raw.totalAmount * 100) < raw.installmentCount) {
    throw new Error('totalAmount is too small for installmentCount');
  }
  if (!idempotencyKey) throw new Error('idempotencyKey is required');

  return {
    tenantId,
    companyId,
    cardId,
    purchaseDate: raw.purchaseDate,
    description,
    counterpartyName,
    categoryId,
    costCenterId,
    totalAmount: raw.totalAmount,
    installmentCount: raw.installmentCount,
    idempotencyKey,
    notes,
  };
}
