import React from 'react';
import { Navbar } from './Navbar';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    // Penambahan: Menghapus `overflow-x-hidden` agar konteks position: sticky Navbar tidak terputus
    <div className="min-h-screen flex flex-col font-sans transition-colors duration-500 bg-gradient-to-br from-slate-100 via-blue-100/60 to-indigo-100/50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/40 text-slate-900 dark:text-slate-100 relative">
      
      {/* Ambient Glow Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[45rem] h-[45rem] bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[45rem] h-[45rem] bg-indigo-400/20 dark:bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse"></div>

      <Navbar />
      
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 relative z-10">
        {children}
      </main>
      
      <footer className="glass-card rounded-none border-x-0 border-b-0 text-slate-500 dark:text-slate-400 text-[11px] py-4 px-6 font-mono transition-colors duration-300 mt-auto">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <p>© 2026 Tim GenoPath (Bioinformatika IPB University). Dibuat untuk Proyek Praktikum Bioinformatika.</p>
          <span>v1.0-prod :: Garlic Genome Assembly ASM1234v1</span>
        </div>
      </footer>
    </div>
  );
};