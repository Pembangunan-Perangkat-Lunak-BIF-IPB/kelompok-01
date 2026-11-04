import React, { createContext, useContext, useState } from 'react';
import { 
  loginUser, 
  registerUser, 
  type LoginPayload, 
  type RegisterPayload 
} from '../services/api';

export interface UserProfile {
  username: string;
  name?: string;
  email?: string;
  role?: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  login: (credentials: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('access_token');
  });

  const [user, setUser] = useState<UserProfile | null>(() => {
    const savedUser = localStorage.getItem('user_info');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const login = async (credentials: LoginPayload) => {
    const result = await loginUser(credentials);
    
    // Menggunakan data user dari respons backend jika tersedia, atau fallback ke username masukan
    const profile: UserProfile = {
      username: result.user?.username || credentials.username,
      name: result.user?.name || credentials.username,
      email: result.user?.email,
      role: 'Peneliti Bioinformatika',
    };

    localStorage.setItem('access_token', result.access_token);
    localStorage.setItem('user_info', JSON.stringify(profile));

    setToken(result.access_token);
    setUser(profile);
  };

  const register = async (payload: RegisterPayload) => {
    await registerUser(payload);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_info');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        register,
        logout,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider');
  }
  return context;
};