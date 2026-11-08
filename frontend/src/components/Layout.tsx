import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';

interface LayoutProps {
  children?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 relative overflow-x-hidden">
      {/* Ambient Layer */}
      <div className="fixed top-[-10%] left-[-10%] w-[35rem] h-[35rem] bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-3xl pointer-events-none z-0"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[35rem] h-[35rem] bg-indigo-500/10 dark:bg-indigo-600/10 rounded-full blur-3xl pointer-events-none z-0"></div>

      {/* Navbar Atas */}
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />

      {/* Konten Halaman (Mendukung props children & Outlet secara otomatis) */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 relative z-10">
        {children || <Outlet />}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-200/80 dark:border-slate-800/80 glass-card py-4 px-4 text-center text-xs font-mono text-slate-600 dark:text-slate-400 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>© 2026 Tim GenoPath (Bioinformatika IPB University). Dibuat untuk Proyek Praktikum Bioinformatika.</span>
          <span>v1.0-prod :: Garlic Genome Assembly ASM1234v1</span>
        </div>
      </footer>
    </div>
  );
};

export default Layout;