import { createContext, useContext } from 'react';
import type { LoginPayload, RegisterPayload } from '../services/api';

export interface UserProfile {
  username: string;
  name?: string;
  nama?: string;
  email?: string;
  role?: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  profileLoading?: boolean;
  login: (
    credentials: LoginPayload
  ) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider');
  }
  return context;
};
