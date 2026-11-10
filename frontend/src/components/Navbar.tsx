import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Dna, LogIn, LogOut } from 'lucide-react';
import { useAuth } from '../context/auth';
import { ThemeToggle } from './ThemeToggle';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  const navItems = [
    { label: 'Beranda', path: '/' },
    { label: 'Riwayat', path: '/dashboard' },
    { label: 'Analisis Baru', path: '/analisis-baru' },
  ];

  const displayName = user?.nama || user?.name || user?.username || 'Peneliti';
  const displayInitial = displayName.charAt(0).toUpperCase();

  return (
    <header className="fixed top-0 z-50 w-full bg-white/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 min-h-16 py-2 flex flex-wrap items-center justify-between gap-2">
        {/* Logo GenoPath */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="p-2 bg-blue-600 rounded-xl text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <Dna className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-lg tracking-tight text-slate-900 dark:text-slate-100">GenoPath</span>
              <span className="bg-blue-500/10 dark:bg-blue-400/10 text-blue-700 dark:text-blue-300 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border border-blue-300/40 dark:border-blue-700/40 backdrop-blur-md">
                v1.0
              </span>
            </div>
            <p className="hidden sm:block text-[10px] text-slate-600 dark:text-slate-400 -mt-0.5 font-medium">Pipeline Bioinformatika Allium sativum</p>
          </div>
        </Link>

        {/* Menu Navigasi Tengah */}
        <nav aria-label="Navigasi utama" className="order-3 w-full sm:w-auto sm:order-none flex justify-center items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path === '/dashboard' && location.pathname.startsWith('/jobs/'));
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={isActive ? 'page' : undefined}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-white/80 dark:bg-slate-700/80 text-blue-600 dark:text-blue-400 shadow-sm backdrop-blur-md'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Kanan: Switch Tema & Profil Pengguna */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          {isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5 bg-white/40 dark:bg-slate-800/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/50 dark:border-slate-700/50">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-sm shrink-0 overflow-hidden">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={displayName} className="w-full h-full rounded-lg object-cover" />
                  ) : (
                    displayInitial
                  )}
                </div>

                <div className="hidden md:flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                    {displayName}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 leading-tight">
                    @{user.username}
                  </span>
                </div>
              </div>

              <button
                onClick={logout}
                className="p-2 border border-rose-200/60 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/40 backdrop-blur-md text-rose-600 dark:text-rose-400 hover:bg-rose-100/80 dark:hover:bg-rose-900/60 rounded-xl transition-colors cursor-pointer"
                title="Keluar / Logout"
                aria-label="Keluar / Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-2 bg-blue-600/90 hover:bg-blue-600 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md shadow-blue-500/20 backdrop-blur-md transition-all"
            >
              <LogIn className="w-4 h-4" />
              <span>Masuk / Daftar</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
