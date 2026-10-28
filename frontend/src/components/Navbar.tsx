import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Dna, LogIn, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from './ThemeToggle';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  const navItems = [
    { label: 'Beranda', path: '/' },
    { label: 'Dashboard Job', path: '/dashboard' },
    { label: 'Analisis Baru', path: '/analisis-baru' },
  ];

  return (
    // Penambahan: Menerapkan .glass-card dan sticky top-0 agar Navbar menempel melayang saat halaman discroll
    <header className="sticky top-0 z-50 glass-card rounded-none border-x-0 border-t-0 shadow-sm transition-all duration-300">
      {/* Bar Atas Informasi Server */}
      <div className="bg-slate-900/90 dark:bg-slate-950/90 text-slate-300 dark:text-slate-400 text-[11px] py-1 px-6 border-b border-slate-800/80 font-mono flex justify-between items-center transition-colors duration-300">
        <div className="flex items-center gap-4">
          <span>• Institut Pertanian Bogor • Lab Bioinformatika & Genomika</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            SERVER: ONLINE
          </span>
          <span>BLAST+ v2.14</span>
          <span>GATK 4.5</span>
        </div>
      </div>

      {/* Navigasi Utama */}
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo GenoPath */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="p-2 bg-blue-600 rounded-xl text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <Dna className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-lg tracking-tight text-slate-900 dark:text-slate-100">GenoPath</span>
              <span className="glass-card text-blue-700 dark:text-blue-400 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border border-blue-200/60 dark:border-blue-800/60">v1.0</span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 -mt-0.5">Pipeline Bioinformatika Allium sativum</p>
          </div>
        </Link>

        {/* Menu Navigasi Tengah */}
        <nav className="flex items-center gap-1 glass-card p-1 rounded-xl">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-white/80 dark:bg-slate-700/80 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Kanan: Switch Tema & Profil */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          {isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 glass-card px-3 py-1.5 rounded-xl">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                  {user.username}
                </span>
              </div>
              <button
                onClick={logout}
                className="p-2 border border-rose-200 dark:border-rose-900/50 bg-rose-50/80 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-xl transition-colors cursor-pointer"
                title="Keluar / Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md shadow-blue-500/20 transition-all"
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