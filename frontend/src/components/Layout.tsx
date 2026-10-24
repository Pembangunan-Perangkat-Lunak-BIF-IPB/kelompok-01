import React from 'react';
import { Navbar } from './Navbar';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">{children}</main>
      <footer className="bg-slate-900 text-slate-400 text-[11px] py-4 px-6 border-t border-slate-800 font-mono">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <p>© 2026 Tim GenoPath (Bioinformatika IPB University). Dibuat untuk Proyek Praktikum Bioinformatika.</p>
          <span>v1.0-prod :: Garlic Genome Assembly ASM1234v1</span>
        </div>
      </footer>
    </div>
  );
};