import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Dna, Lock, Mail, Eye, EyeOff, User, ShieldCheck, ExternalLink, ArrowLeft } from 'lucide-react';

// =========================================================================
// TEMPELKAN LINK GOOGLE FORM KAMU DI SINI:
// =========================================================================
const GOOGLE_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdgawk5QzHe6_aktNuwwRGO4lnmAkt3gfrZzHnL9w1BRLfllQ/viewform?usp=dialog"; // <--- Ganti dengan link GForm kamu
export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  
  // State Input
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulasi autentikasi dummy: langsung alihkan pengguna ke dashboard job
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 flex flex-col justify-between p-4 md:p-6">
      {/* Tombol Kembali ke Beranda */}
      <div className="max-w-md w-full mx-auto mb-2">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Beranda
        </Link>
      </div>

      <div className="max-w-md w-full mx-auto space-y-4">
        {/* Header Kartu Institusi */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
          <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-xl text-blue-600">
            <Dna className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xs font-bold tracking-wider text-slate-900 uppercase">INSTITUT PERTANIAN BOGOR</h2>
            <p className="text-[11px] text-slate-500 font-medium">Bioinformatika & Genomika</p>
          </div>
        </div>

        {/* Kartu Utama Formulir Autentikasi */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
          {/* Badge Portal */}
          <div className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            GenoPath Auth Portal
          </div>

          <div>
            <h1 className="text-xl font-bold text-slate-900">Sistem Autentikasi & Token Sesi JWT</h1>
            <p className="text-xs text-slate-500 mt-1">Gerbang komputasi analisis sekuensing patogen tanaman tropis</p>
          </div>

          {/* Tab Navigasi Masuk / Buat Akun */}
          <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('login')}
              className={`py-2 rounded-lg transition-all ${
                activeTab === 'login' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              ➔ Masuk Akun
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('register')}
              className={`py-2 rounded-lg transition-all ${
                activeTab === 'register' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              + Buat Akun Baru
            </button>
          </div>

          {/* Form Input Dinamis */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            
            {/* TAMPILAN TAB LOG IN */}
            {activeTab === 'login' && (
              <>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Nama Pengguna atau Alamat Email:</label>
                    <span className="text-[10px] font-mono text-slate-400">UID / RFC-5322</span>
                  </div>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contoh: peneliti_garlic@ipb.ac.id atau rafif_al"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Kata Sandi:</label>
                    <button type="button" className="text-[10px] font-semibold text-blue-600 hover:underline">
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
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-9 py-2.5 text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    />
                    {/* HANYA 1 TOMBOL IKON MATA TUNGGAL */}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input type="checkbox" id="remember" defaultChecked className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  <label htmlFor="remember" className="text-slate-600 text-[11px]">
                    Ingat token sesi di peramban ini <span className="font-mono text-slate-400">(TTL: 72 Jam)</span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-blue-500/20 text-xs flex items-center justify-center gap-2"
                >
                  🔑 Masuk (Autentikasi JWT)
                </button>
              </>
            )}

            {/* TAMPILAN TAB BUAT AKUN BARU (REGISTER) */}
            {activeTab === 'register' && (
              <>
                {/* Kolom 1: Nama Pengguna */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Nama Pengguna (Username):</label>
                    <span className="text-[10px] font-mono text-slate-400">USERNAME</span>
                  </div>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="contoh: rafif_al"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Kolom 2: Alamat Email */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Alamat Email IPB / Institusi:</label>
                    <span className="text-[10px] font-mono text-slate-400">RFC-5322</span>
                  </div>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contoh: peneliti_garlic@ipb.ac.id"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Kolom 3: Kata Sandi */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Buat Kata Sandi:</label>
                    <span className="text-[10px] font-mono text-slate-400">MIN. 8 KARAKTER</span>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-9 py-2.5 text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    />
                    {/* HANYA 1 TOMBOL IKON MATA TUNGGAL */}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-blue-500/20 text-xs flex items-center justify-center gap-2 mt-2"
                >
                  📝 Buat Akun Baru (Daftar)
                </button>
              </>
            )}

          </form>

          {/* Informasi Keamanan */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-start gap-2.5 text-[11px] text-slate-600">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-slate-800 font-semibold mb-0.5">Catatan Keamanan & Integritas Data:</strong>
              Token JWT diverifikasi pada setiap request API. Sesi job terisolasi per ID pengguna untuk menjamin kerahasian berkas FASTQ serta replikasi metagenomik sampel penelitian.
            </div>
          </div>

          {/* Link Administrator Ke Google Form */}
          <div className="text-center pt-2 text-[11px] text-slate-500">
            Belum memiliki akun atau butuh alokasi cluster HPC? <br />
            <a 
              href={GOOGLE_FORM_URL} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-600 font-semibold hover:underline inline-flex items-center gap-1 mt-1"
            >
              [ Hubungi Administrator Lab Bioinformatika IPB <ExternalLink className="w-3 h-3" /> ]
            </a>
          </div>
        </div>
      </div>

      {/* Footer Version */}
      <footer className="text-center text-[11px] font-mono text-slate-400 mt-6">
        GenoPath v2.4.1-build88 • Program Studi Bioinformatika IPB Dramaga
      </footer>
    </div>
  );
};