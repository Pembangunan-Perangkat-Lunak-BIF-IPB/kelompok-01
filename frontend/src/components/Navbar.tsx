import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Dna, User as UserIcon, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const navItems = [
    { label: 'Beranda', path: '/' },
    { label: 'Dashboard Job', path: '/dashboard' },
    { label: 'Analisis Baru', path: '/analisis-baru' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="bg-slate-900 text-slate-300 text-[11px] py-1.5 px-6 flex justify-between items-center font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Institut Pertanian Bogor • Lab Bioinformatika & Genomika</span>
        </div>
        <div className="flex gap-4">
          <span>SERVER: <strong className="text-emerald-400">ONLINE</strong></span>
          <span>BLAST+ v2.14</span>
          <span>GATK 4.5</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <div 
          onClick={() => navigate('/')} 
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="p-2 bg-blue-600 rounded-xl text-white group-hover:bg-blue-700 transition-colors">
            <Dna className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-slate-900 tracking-wide">GenoPath</span>
              <span className="text-[10px] bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded font-mono border border-blue-200">v1.0</span>
            </div>
            <p className="text-[10px] text-slate-400">Pipeline Bioinformatika Allium sativum</p>
          </div>
        </div>

        <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`px-4 py-2 rounded-lg transition-all ${
                  isActive 
                    ? 'bg-white text-blue-600 shadow-sm font-bold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {user ? (
          <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
            <div className="text-right hidden sm:block">
              <span className="block text-xs font-bold text-slate-800 uppercase tracking-wide">{user.name}</span>
              <span className="block text-[10px] text-slate-400 font-mono">{user.role || 'Peneliti'}</span>
            </div>
            <div className="relative group cursor-pointer">
              {user.avatarUrl ? (
                <img 
                  src={user.avatarUrl} 
                  alt={user.name} 
                  className="w-9 h-9 rounded-full border-2 border-blue-600 object-cover shadow-sm"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  <UserIcon className="w-5 h-5" />
                </div>
              )}
              <button
                onClick={logout}
                title="Keluar / Logout"
                className="absolute -bottom-1 -right-1 bg-rose-500 text-white p-1 rounded-full shadow hover:bg-rose-600 transition-colors"
              >
                <LogOut className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            Masuk / Daftar
          </button>
        )}
      </div>
    </header>
  );
};