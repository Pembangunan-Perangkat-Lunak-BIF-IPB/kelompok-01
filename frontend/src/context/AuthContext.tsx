import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getCurrentProfile, loginUser, registerUser, type LoginPayload, type RegisterPayload, type AccountProfile } from '../services/api';
import { AuthContext, type UserProfile } from './auth';

const displayProfile = (profile: AccountProfile): UserProfile => ({
  username: profile.username, nama: profile.nama, name: profile.nama,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('access_token'));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(() => Boolean(localStorage.getItem('access_token')));
  const generation = useRef(0);
  const hydration = useRef<AbortController | null>(null);

  const logout = useCallback(() => {
    hydration.current?.abort();
    generation.current++;
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_info');
    setToken(null); setUser(null); setProfileLoading(false);
  }, []);

  useEffect(() => {
    const expired = () => logout();
    window.addEventListener('genopath:unauthorized', expired);
    return () => window.removeEventListener('genopath:unauthorized', expired);
  }, [logout]);

  useEffect(() => {
    const stored = localStorage.getItem('access_token');
    if (!stored) return;
    const controller = new AbortController();
    hydration.current = controller;
    const version = generation.current;
    getCurrentProfile(stored, controller.signal).then(profile => {
      if (!controller.signal.aborted && version === generation.current) {
        setUser(displayProfile(profile)); setProfileLoading(false);
      }
    }).catch(() => {
      if (!controller.signal.aborted && version === generation.current) logout();
    });
    return () => controller.abort();
  }, [logout]);

  const login = async (credentials: LoginPayload) => {
    hydration.current?.abort();
    const version = ++generation.current;
    setUser(null); setProfileLoading(true);
    try {
      const result = await loginUser(credentials);
      const profile = await getCurrentProfile(result.access_token);
      if (version !== generation.current) return;
      try {
        localStorage.setItem('access_token', result.access_token);
        localStorage.removeItem('user_info'); // Never treat the old client profile as authoritative.
      } catch {
        throw new Error('Sesi tidak dapat disimpan di peramban. Periksa izin penyimpanan.');
      }
      setToken(result.access_token); setUser(displayProfile(profile));
    } catch (error) {
      if (version === generation.current) logout();
      throw error;
    } finally {
      if (version === generation.current) setProfileLoading(false);
    }
  };

  const register = async (payload: RegisterPayload) => { await registerUser(payload); };
  return <AuthContext.Provider value={{ user, token, login, register, logout, profileLoading,
    isAuthenticated: !!token && !!user }}>{children}</AuthContext.Provider>;
};
