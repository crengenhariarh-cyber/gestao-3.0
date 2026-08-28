export interface AuthUser {
  id: string;
  email: string | null;
}

export interface AuthGateway {
  getCurrentUser(): Promise<AuthUser | null>;
  signInWithPassword(email: string, password: string): Promise<AuthUser>;
  signOut(): Promise<void>;
}
