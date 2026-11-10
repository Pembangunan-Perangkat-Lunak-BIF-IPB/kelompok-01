import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-xl border transition-all duration-200 flex items-center gap-2 text-xs font-semibold shadow-sm cursor-pointer
        bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900
        dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
      title={theme === 'light' ? 'Beralih ke Mode Malam' : 'Beralih ke Mode Siang'}
    >
      {theme === 'light' ? (
        <>
          <Moon className="w-4 h-4 text-slate-600" />
          <span className="hidden sm:inline font-mono">Mode Malam</span>
        </>
      ) : (
        <>
          <Sun className="w-4 h-4 text-amber-400" />
          <span className="hidden sm:inline font-mono">Mode Siang</span>
        </>
      )}
    </button>
  );
};