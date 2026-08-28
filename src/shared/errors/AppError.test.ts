import { describe, expect, it } from 'vitest';
import { AppError } from './AppError';

describe('AppError', () => {
  it('preserva categoria, mensagem e causa', () => {
    const cause = new Error('falha original');
    const error = new AppError('business_rule', 'Operação não permitida.', cause);

    expect(error.name).toBe('AppError');
    expect(error.code).toBe('business_rule');
    expect(error.message).toBe('Operação não permitida.');
    expect(error.cause).toBe(cause);
  });
});
