import type { AccessContext } from '../domain/AccessContext';

export interface AccessRepository {
  listContextsForCurrentUser(): Promise<readonly AccessContext[]>;
}
