import React, { useState } from 'react';
import { Navbar } from './Navbar';
import type { BgMode } from './LeftSidebar';

interface LayoutProps {
  children?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  // State Mode Latar Belakang (Default: IPB University)
  const [bgMode, setBgMode] = useState<BgMode>('ipb-university');

  return (
    <div className="min-h-screen flex flex-col font-sans relative overflow-x-hidden text-slate-950 dark:text-slate-100 transition-colors duration-500">
      
      {/* --- LAYER BACKGROUND DINAMIS --- */}
      <div className="fixed inset-0 pointer-events-none -z-50 overflow-hidden">
        
        {/* OPSI 1: IPB UNIVERSITY (Gambar Kampus Siang & Malam) */}
        {bgMode === 'ipb-university' && (
          <>
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

            {/* Overlay Tipis Transparan */}
            <div className="absolute inset-0 bg-slate-900/10 dark:bg-slate-950/45 backdrop-blur-[2px] transition-colors duration-500" />
          </>
        )}

        {/* OPSI 2: AMBIENT LIGHT (Gradasi Warna Halus) */}
        {bgMode === 'ambient' && (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 transition-colors duration-500" />
        )}

        {/* OPSI 3: AMBIENT LIGHT (+ POLA GARLIC-PATTERN SKALA BESAR) */}
        {bgMode === 'ambient-pattern' && (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 transition-colors duration-500">
            {/* Skala Pattern Diperbesar ke 360px x 360px */}
            <div 
              className="absolute inset-0 bg-repeat opacity-30 dark:opacity-20 mix-blend-multiply dark:mix-blend-overlay transition-opacity duration-500"
              style={{ 
                backgroundImage: "url('/garlic-pattern.png')",
                backgroundSize: '360px 360px'
              }}
            />
          </div>
        )}

        {/* Soft Ambient Lighting Atas */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[350px] bg-gradient-to-b from-blue-500/20 via-indigo-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Navigasi Utama Sticky */}
      <Navbar bgMode={bgMode} setBgMode={setBgMode} />

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