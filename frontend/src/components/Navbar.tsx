import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Dna, LogIn, LogOut, PanelLeftOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import { LeftSidebar, type BgMode } from './LeftSidebar';

// Pendaftaran Props agar TypeScript Mengenali bgMode dan setBgMode
interface NavbarProps {
  bgMode?: BgMode;
  setBgMode?: (mode: BgMode) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ bgMode = 'ipb-university', setBgMode }) => {
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  // State Drawer Sidebar Kiri
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  const navItems = [
    { label: 'Beranda', path: '/' },
    { label: 'Dashboard Job', path: '/dashboard' },
    { label: 'Analisis Baru', path: '/analisis-baru' },
  ];

  const displayName = user?.nama || user?.name || user?.username || 'Peneliti';
  const displayInitial = displayName.charAt(0).toUpperCase();

  return (
    <>
      <header className="fixed top-0 left-0 w-full z-50 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60 shadow-sm transition-all duration-300">
        
        {/* Navigasi Utama */}
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          
          {/* Logo GenoPath (Pemicu Membuka Sidebar Kiri) */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="flex items-center gap-3 group text-left cursor-pointer focus:outline-none"
            title="Klik untuk membuka Panel Kontrol & Latar Belakang"
          >
            <div className="p-2 bg-blue-600 rounded-xl text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform flex items-center gap-1">
              <Dna className="w-5 h-5 animate-pulse" />
              <PanelLeftOpen className="w-3.5 h-3.5 text-blue-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg tracking-tight text-slate-900 dark:text-slate-100 group-hover:text-blue-600 transition-colors">
                  GenoPath
                </span>
                <span className="glass-card text-blue-700 dark:text-blue-400 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border border-blue-200/60 dark:border-blue-800/60">
                  v1.0
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 -mt-0.5">
                Pipeline Bioinformatika Allium sativum
              </p>
            </div>
          </button>

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
                      ? 'bg-white/90 dark:bg-slate-700/90 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Kanan: Saklar Tema & Profil Pengguna */}
          <div className="flex items-center gap-3">
            <ThemeToggle />

            {isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2.5 glass-card px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-sm shrink-0 overflow-hidden">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={displayName} className="w-full h-full rounded-lg object-cover" />
                    ) : (
                      displayInitial
                    )}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                      {displayName}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 leading-tight">
                      @{user.username}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
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

      {/* LeftSidebar Menyerap State BgMode */}
      <LeftSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        bgMode={bgMode}
        setBgMode={setBgMode || (() => {})}
      />
    </>
  );
};

export default Navbar;