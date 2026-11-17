import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle Mode Malam dan Siang"
      className={`relative inline-flex h-8 w-16 shrink-0 cursor-pointer rounded-full p-1 border backdrop-blur-2xl transition-colors duration-300 ease-in-out focus:outline-none shadow-md ${
        isDark 
          ? 'bg-slate-900/80 border-slate-700/80 text-blue-400' 
          : 'bg-white/80 border-slate-200/80 text-amber-500'
      }`}
    >
      {/* Ikon Latar Belakang Kiri (Siang/Sun) */}
      <span className="absolute left-1.5 top-1.5 flex items-center justify-center text-amber-500">
        <Sun className="w-4 h-4" />
      </span>

      {/* Ikon Latar Belakang Kanan (Malam/Moon) */}
      <span className="absolute right-1.5 top-1.5 flex items-center justify-center text-blue-400">
        <Moon className="w-4 h-4" />
      </span>

      {/* Tombol Geser Bulat (Knob) */}
      <span
        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white dark:bg-slate-800 shadow-md z-10 flex items-center justify-center transition-transform duration-300 ease-in-out ${
          isDark ? 'translate-x-8 text-blue-400' : 'translate-x-0 text-amber-500'
        }`}
      >
        {isDark ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
      </span>
    </button>
  );
};