import React, { useState } from 'react';
import { 
  Palette, 
  MessageSquarePlus, 
  X, 
  Check, 
  Sparkles, 
  Building2, 
  SunMedium, 
  Grid,
  ChevronDown,
  ExternalLink,
  HelpCircle
} from 'lucide-react';

export type BgMode = 'ambient' | 'ambient-pattern' | 'ipb-university';

interface LeftSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  bgMode: BgMode;
  setBgMode: (mode: BgMode) => void;
  googleFormUrl?: string;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  isOpen,
  onClose,
  bgMode,
  setBgMode,
  googleFormUrl = "https://forms.gle/YOUR_GOOGLE_FORM_LINK_HERE" // Ganti dengan URL Google Form Anda
}) => {
  // State Collapse/Expand Seksi
  const [isBgExpanded, setIsBgExpanded] = useState<boolean>(true);
  const [isFeedbackExpanded, setIsFeedbackExpanded] = useState<boolean>(true);

  return (
    <>
      {/* Overlay Tipis */}
      {isOpen && (
        <div 
          onClick={onClose} 
          className="fixed inset-0 z-40 bg-slate-950/20 dark:bg-slate-950/40 backdrop-blur-[2px] transition-opacity duration-300"
        />
      )}

      {/* Sidebar Panel Sisi Kiri */}
      <aside
        className={`fixed top-16 left-0 z-50 h-[calc(100vh-4rem)] w-80 max-w-[85vw] bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border-r border-slate-200/70 dark:border-slate-800/70 shadow-2xl transition-transform duration-300 ease-in-out overflow-y-auto flex flex-col justify-between ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 space-y-4">
          {/* Header Sidebar */}
          <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="font-mono text-xs font-black tracking-wider uppercase text-slate-950 dark:text-white">
                Panel Kontrol & Layanan
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 1. SEKSI PENGATURAN LATAR BELAKANG (EXPANDABLE) */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setIsBgExpanded(!isBgExpanded)}
              className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors text-left"
            >
              <div className="flex items-center gap-2 text-xs font-mono font-black text-slate-800 dark:text-slate-200 uppercase">
                <Palette className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Tampilan Latar Belakang</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${
                  isBgExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Konten Opsi Latar Belakang */}
            <div
              className={`grid transition-all duration-300 ease-in-out ${
                isBgExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
              }`}
            >
              <div className="overflow-hidden space-y-2 pt-1">
                {/* Opsi 1: Ambient Light */}
                <button
                  type="button"
                  onClick={() => setBgMode('ambient')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold border transition-all ${
                    bgMode === 'ambient'
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300 shadow-sm'
                      : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <SunMedium className="w-4 h-4 text-amber-500" />
                    <span>Ambient Light</span>
                  </div>
                  {bgMode === 'ambient' && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                </button>

                {/* Opsi 2: Ambient Light (+Pola) */}
                <button
                  type="button"
                  onClick={() => setBgMode('ambient-pattern')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold border transition-all ${
                    bgMode === 'ambient-pattern'
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300 shadow-sm'
                      : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Grid className="w-4 h-4 text-indigo-500" />
                    <span>Ambient Light (+Pola)</span>
                  </div>
                  {bgMode === 'ambient-pattern' && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                </button>

                {/* Opsi 3: IPB University */}
                <button
                  type="button"
                  onClick={() => setBgMode('ipb-university')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold border transition-all ${
                    bgMode === 'ipb-university'
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300 shadow-sm'
                      : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Building2 className="w-4 h-4 text-emerald-500" />
                    <span>IPB University</span>
                  </div>
                  {bgMode === 'ipb-university' && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                </button>
              </div>
            </div>
          </div>

          <hr className="border-slate-200/60 dark:border-slate-800/60" />

          {/* 2. SEKSI PUSAT PENGADUAN & MASUKAN (TOMBOL PENGALIHAN GOOGLE FORM) */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setIsFeedbackExpanded(!isFeedbackExpanded)}
              className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors text-left"
            >
              <div className="flex items-center gap-2 text-xs font-mono font-black text-slate-800 dark:text-slate-200 uppercase">
                <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Pusat Pengaduan & Masukan</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${
                  isFeedbackExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Card Tautan Google Form */}
            <div
              className={`grid transition-all duration-300 ease-in-out ${
                isFeedbackExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
              }`}
            >
              <div className="overflow-hidden pt-1">
                <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <p className="text-xs font-extrabold text-slate-700 dark:text-slate-300 leading-relaxed">
                    Mengalami kendala sistem (seperti error login, proses pipeline) atau memiliki saran perbaikan UI/UX? Kirimkan laporan resmi Anda melalui Google Form.
                  </p>

                  <a
                    href={googleFormUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquarePlus className="w-4 h-4 shrink-0" />
                      <span>Buka Google Form Pengaduan</span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-80 group-hover:translate-x-0.5 transition-transform" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Sidebar */}
        <div className="p-4 border-t border-slate-200/60 dark:border-slate-800/60 text-center text-[10px] font-mono text-slate-500">
          GenoPath Bioinformatika v1.0 • IPB University
        </div>
      </aside>
    </>
  );
};

export default LeftSidebar;