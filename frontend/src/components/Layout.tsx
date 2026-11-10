import React from 'react';
import { Navbar } from './Navbar';

interface LayoutProps {
  children?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col font-sans relative overflow-x-hidden text-slate-950 dark:text-slate-100">
      
      {/* --- LAYER BACKGROUND IPB UTAMA (APPLIES TO ALL PAGES) --- */}
      <div className="fixed inset-0 pointer-events-none -z-50 overflow-hidden">
        {/* Latar Belakang Kampus Siang */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700 opacity-100 dark:opacity-0"
          style={{ backgroundImage: "url('/bg-day.png')" }}
        />

        {/* Latar Belakang Kampus Malam */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700 opacity-0 dark:opacity-100"
          style={{ backgroundImage: "url('/bg-night.png')" }}
        />

        {/* Overlay Tipis Transparan (Memastikan Gambar Tetap Kelihatan, Bukan Hitam Pekat) */}
        <div className="absolute inset-0 bg-slate-900/10 dark:bg-slate-950/45 backdrop-blur-[2px] transition-colors duration-500" />

        {/* Soft Ambient Lighting Atas */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[350px] bg-gradient-to-b from-blue-500/20 via-indigo-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Navigasi Utama Sticky */}
      <Navbar />

      {/* Konten Utama Halaman */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pb-12 pt-24 relative z-10">
        {children}
      </main>

      {/* Footer Minimalis */}
      <footer className="w-full py-4 mt-auto border-t border-white/30 dark:border-slate-800/60 relative z-10 text-center text-xs font-mono text-slate-900 dark:text-slate-200 font-bold backdrop-blur-md bg-white/20 dark:bg-slate-900/40">
        GenoPath v1.0 • Pipeline Bioinformatika Allium sativum IPB Dramaga
      </footer>
    </div>
  );
};

export default Layout;