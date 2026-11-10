import React, { useEffect, useState } from 'react';
import {
  loginUser,
  registerUser,
  type LoginPayload,
  type RegisterPayload
} from '../services/api';
import { AuthContext, type UserProfile } from './auth';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('access_token');
  });

  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('user_info') || 'null') as UserProfile | null;
      return saved && typeof saved.username === 'string' && saved.username ? saved : null;
    } catch { return null; }
  });

  const login = async (
    credentials: LoginPayload,
    extraInfo?: { nama?: string; name?: string; email?: string }
  ) => {
    const result = await loginUser(credentials);

    const profileName = extraInfo?.nama || extraInfo?.name || credentials.username;

    const profile: UserProfile = {
      username: credentials.username,
      name: profileName,
      nama: profileName,
      email: extraInfo?.email,
    };

    try {
      localStorage.setItem('access_token', result.access_token);
      localStorage.setItem('user_info', JSON.stringify(profile));
    } catch {
      localStorage.removeItem('access_token'); localStorage.removeItem('user_info');
      throw new Error('Sesi tidak dapat disimpan di peramban. Periksa izin penyimpanan.');
    }

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

  useEffect(() => {
    const expired = () => { setToken(null); setUser(null); };
    window.addEventListener('genopath:unauthorized', expired);
    return () => window.removeEventListener('genopath:unauthorized', expired);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        register,
        logout,
        isAuthenticated: !!token && !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
