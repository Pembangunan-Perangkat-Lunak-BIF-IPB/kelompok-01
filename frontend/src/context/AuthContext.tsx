import React, { createContext, useContext, useState } from 'react';
import { loginUser, type LoginPayload } from '../services/api';

export interface UserProfile {
  username: string;
  name?: string;
  email?: string; // Menambahkan email agar Navbar.tsx tidak error
  role?: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  login: (credentials: LoginPayload) => Promise<void>;
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
    
    const profile: UserProfile = {
      username: credentials.username,
      name: credentials.username,
      role: 'Peneliti Bioinformatika',
    };

    localStorage.setItem('access_token', result.access_token);
    localStorage.setItem('user_info', JSON.stringify(profile));

    setToken(result.access_token);
    setUser(profile);
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