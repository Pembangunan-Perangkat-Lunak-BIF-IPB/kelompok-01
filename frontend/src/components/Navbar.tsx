import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Dna, Moon, Sun, LogIn, LogOut, LayoutDashboard, PlusCircle, Home, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  darkMode: boolean;
  setDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
}

export const Navbar: React.FC<NavbarProps> = ({ darkMode, setDarkMode }) => {
  const location = useLocation();
  const { user, logout, isAuthenticated } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 w-full transition-colors backdrop-blur-md">
      {/* Sub-bar Atas */}
      <div className="bg-slate-100/90 dark:bg-slate-950/90 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800/80 px-4 py-1 text-xs font-mono transition-colors">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 inline-block"></span>
            <span>Institut Pertanian Bogor • Lab Bioinformatika & Genomika</span>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              SERVER: ONLINE
            </span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span>BLAST+ v2.14</span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span>GATK 4.5</span>
          </div>
        </div>
      </div>

      {/* Main Nav */}
      <div className="glass-card border-b border-slate-200 dark:border-slate-800/80 px-4 py-2.5 transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          <Link to="/" className="flex items-center gap-3 group">
            <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm group-hover:bg-blue-500 transition-colors">
              <Dna className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-slate-900 dark:text-slate-100">GenoPath</span>
                <span className="bg-blue-50 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60 text-xs font-mono font-semibold px-1.5 py-0.5 rounded">
                  v1.0
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-none mt-0.5">
                Pipeline Bioinformatika Allium sativum
              </p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 bg-slate-200/50 dark:bg-slate-800/60 p-1 rounded-lg border border-slate-300/40 dark:border-slate-700/60 text-xs font-semibold">
            <Link
              to="/"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                isActive('/')
                  ? 'bg-blue-600 text-white shadow-sm font-bold'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/50'
              }`}
            >
              <Home className="w-3.5 h-3.5" /> Beranda
            </Link>

            <Link
              to="/dashboard"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                isActive('/dashboard')
                  ? 'bg-blue-600 text-white shadow-sm font-bold'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/50'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard Job
            </Link>

            <Link
              to="/analisis-baru"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                isActive('/analisis-baru')
                  ? 'bg-blue-600 text-white shadow-sm font-bold'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/50'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" /> Analisis Baru
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDarkMode((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              {darkMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-500" /> Mode Siang
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" /> Mode Malam
                </>
              )}
            </button>

            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <span className="hidden sm:flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 rounded-lg">
                  <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  {user?.nama || user?.username || 'Peneliti'}
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" /> Keluar
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" /> Masuk / Daftar
              </Link>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};

export default Navbar;