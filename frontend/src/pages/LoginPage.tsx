import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Dna, Lock, Mail, Eye, EyeOff, User, ShieldCheck, ExternalLink, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';

const GOOGLE_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdgawk5QzHe6_aktNuwwRGO4lnmAkt3gfrZzHnL9w1BRLfllQ/viewform?usp=dialog";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (activeTab === 'login') {
      const loginIdentifier = email.trim() || username.trim();
      if (!loginIdentifier || !password.trim()) {
        setErrorMessage('Username/email dan password tidak boleh kosong.');
        return;
      }

      setLoading(true);

      try {
        await login({ username: loginIdentifier, password });
        navigate('/analisis-baru');
      } catch (err) {
        if (err instanceof ApiError) {
          setErrorMessage(err.message);
        } else {
          setErrorMessage('Gagal terhubung ke server backend FastAPI.');
        }
      } finally {
        setLoading(false);
      }
    } else {
      setErrorMessage('Pendaftaran mandiri belum dibuka oleh sistem BE M7. Silakan hubungi Administrator untuk pembuatan akun.');
    }
  };

  return (
    // Penambahan: Latar utama dengan gradasi tema direktori global
    <div className="min-h-screen relative overflow-hidden flex flex-col justify-between p-4 md:p-6 font-sans text-slate-800 dark:text-slate-200 transition-colors duration-500 bg-gradient-to-br from-slate-100 via-blue-100/60 to-indigo-100/50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/40">
      
      {/* Penambahan: Layer Motif Bawang Putih Berulang (Background Pattern) */}
      {/* dark:invert merubah sketsa hitam menjadi garis putih di mode malam, opacity menjaga transparansi agar tidak mengganggu keterbacaan */}
      <div 
        className="absolute inset-0 bg-repeat pointer-events-none z-0 opacity-[0.08] dark:opacity-[0.05] dark:invert transition-opacity duration-300"
        style={{ backgroundImage: "url('/garlic-pattern.png')", backgroundSize: '360px' }}
      ></div>

      {/* Penambahan: Ambient Glow Orbs untuk efek kilau di balik panel kristal */}
      <div className="fixed top-[-10%] left-[-10%] w-[45rem] h-[45rem] bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-3xl pointer-events-none z-0 animate-pulse"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[45rem] h-[45rem] bg-indigo-400/20 dark:bg-indigo-600/10 rounded-full blur-3xl pointer-events-none z-0 animate-pulse"></div>

      {/* Konten Utama (Posisi z-10 di atas motif latar) */}
      <div className="relative z-10 max-w-md w-full mx-auto mb-2">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Beranda
        </Link>
      </div>

      <div className="relative z-10 max-w-md w-full mx-auto space-y-4">
        
        {/* Header Kartu Institusi (Kristal) */}
        <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 glass-card rounded-xl text-blue-600 dark:text-blue-400">
            <Dna className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xs font-bold tracking-wider text-slate-900 dark:text-slate-100 uppercase">INSTITUT PERTANIAN BOGOR</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Bioinformatika & Genomika</p>
          </div>
        </div>

        {/* Kartu Utama Formulir Autentikasi (Kristal) */}
        <div className="glass-card rounded-2xl p-6 space-y-5">
          
          {/* Badge Portal */}
          <div className="inline-flex items-center gap-1.5 glass-card rounded-full px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
            <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse"></span>
            GenoPath Auth Portal
          </div>

          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Sistem Autentikasi & Token Sesi JWT</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Gerbang komputasi analisis sekuensing patogen tanaman tropis</p>
          </div>

          {/* Tab Navigasi Masuk / Buat Akun */}
          <div className="grid grid-cols-2 gap-1 glass-card p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => { setActiveTab('login'); setErrorMessage(null); }}
              className={`py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === 'login' 
                  ? 'bg-white/80 dark:bg-slate-700/80 text-blue-600 dark:text-blue-400 shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              ➔ Masuk Akun
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('register'); setErrorMessage(null); }}
              className={`py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === 'register' 
                  ? 'bg-white/80 dark:bg-slate-700/80 text-blue-600 dark:text-blue-400 shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              + Buat Akun Baru
            </button>
          </div>

          {/* Alert Error */}
          {errorMessage && (
            <div className="p-3 bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form Input */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {activeTab === 'login' && (
              <>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">Nama Pengguna atau Alamat Email:</label>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">UID / RFC-5322</span>
                  </div>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contoh: peneliti_garlic@ipb.ac.id atau rafif_al"
                      className="w-full glass-card rounded-xl pl-9 pr-3 py-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">Kata Sandi:</label>
                    <button type="button" className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                      [ Lupa Sandi? ]
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full glass-card rounded-xl pl-9 pr-9 py-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input type="checkbox" id="remember" defaultChecked className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                  <label htmlFor="remember" className="text-slate-600 dark:text-slate-400 text-[11px] cursor-pointer">
                    Ingat token sesi di peramban ini <span className="font-mono text-slate-400 dark:text-slate-500">(TTL: 72 Jam)</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/25 text-xs flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Memverifikasi Token JWT...</span>
                    </>
                  ) : (
                    <span>🔑 Masuk (Autentikasi JWT)</span>
                  )}
                </button>
              </>
            )}

            {activeTab === 'register' && (
              <>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">Nama Pengguna (Username):</label>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">USERNAME</span>
                  </div>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="contoh: rafif_al"
                      className="w-full glass-card rounded-xl pl-9 pr-3 py-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">Alamat Email:</label>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">RFC-5322</span>
                  </div>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contoh: peneliti_garlic@ipb.ac.id"
                      className="w-full glass-card rounded-xl pl-9 pr-3 py-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">Buat Kata Sandi:</label>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">MIN. 8 KARAKTER</span>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full glass-card rounded-xl pl-9 pr-9 py-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/25 text-xs flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  📝 Buat Akun Baru (Daftar)
                </button>
              </>
            )}
          </form>

          {/* Informasi Keamanan */}
          <div className="glass-card rounded-xl p-3 flex items-start gap-2.5 text-[11px] text-slate-600 dark:text-slate-300">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-slate-800 dark:text-slate-200 font-semibold mb-0.5">Catatan Keamanan & Integritas Data:</strong>
              Token JWT diverifikasi pada setiap request API. Sesi job terisolasi per ID pengguna untuk menjamin kerahasian berkas FASTQ serta replikasi metagenomik sampel penelitian.
            </div>
          </div>

          {/* Link Administrator Ke Google Form */}
          <div className="text-center pt-2 text-[11px] text-slate-500 dark:text-slate-400">
            Belum memiliki akun atau butuh alokasi cluster HPC? <br />
            <a 
              href={GOOGLE_FORM_URL} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-600 dark:text-blue-400 font-semibold hover:underline inline-flex items-center gap-1 mt-1"
            >
              [ Hubungi Administrator Lab Bioinformatika IPB <ExternalLink className="w-3 h-3" /> ]
            </a>
          </div>
        </div>
      </div>

      {/* Footer Version */}
      <footer className="relative z-10 text-center text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-6">
        GenoPath v2.4.1-build88 • Program Studi Bioinformatika IPB Dramaga
      </footer>
    </div>
  );
};