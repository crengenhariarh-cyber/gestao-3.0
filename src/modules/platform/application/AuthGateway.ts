export interface AuthUser {
  id: string;
  email: string | null;
}

export interface BootstrapSignUpResult {
  user: AuthUser;
  sessionCreated: boolean;
}

export interface AuthGateway {
  getCurrentUser(): Promise<AuthUser | null>;
  signInWithPassword(email: string, password: string): Promise<AuthUser>;
  signUpFirstOwner(input: {
    email: string;
    password: string;
    bootstrapCode: string;
    tenantName: string;
    companyName: string;
  }): Promise<BootstrapSignUpResult>;
  signOut(): Promise<void>;
}
