import React from 'react';
import { Navbar } from './Navbar';

interface LayoutProps {
  children?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col font-sans transition-colors duration-500 bg-gradient-to-br from-slate-100 via-blue-100/60 to-indigo-100/50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/40 text-slate-900 dark:text-slate-100 relative">
      
      {/* Ambient Glow Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[45rem] h-[45rem] bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[45rem] h-[45rem] bg-indigo-400/20 dark:bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse"></div>

      {/* Navigasi Utama */}
      <Navbar />
      
      {/* Konten Utama */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 pb-6 pt-24 relative z-10">
        {children}
    </main>
      
      {/* Footer Tanpa Teks Kiri & Kanan Bawah */}
      <footer className="w-full py-4 mt-auto border-t border-slate-200/30 dark:border-slate-800/30" />
    </div>
  );
};

// Dual Export: Mencegah error 'export default removed' di App.tsx
export default Layout;