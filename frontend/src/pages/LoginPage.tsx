import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Dna, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { Button, Alert, FormField } from '../components/ui/Foundation';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../context/auth';
import { ApiError } from '../services/api';

const GOOGLE_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdgawk5QzHe6_aktNuwwRGO4lnmAkt3gfrZzHnL9w1BRLfllQ/viewform?usp=dialog";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const requestedPath = (location.state as { from?: unknown } | null)?.from;
  const destination = typeof requestedPath === 'string' && /^\/(?:dashboard|riwayat|analisis-baru|jobs\/[1-9]\d*(?:\/result)?)$/.test(requestedPath)
    ? requestedPath : '/analisis-baru';
  const { login, register } = useAuth();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // State Input Form (nama diselaraskan dengan skema backend)
  const [username, setUsername] = useState('');
  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (activeTab === 'login') {
      if (!username.trim() || !password.trim()) {
        setErrorMessage('Username dan password wajib diisi.');
        return;
      }

      setLoading(true);

      try {
        await login({ username: username.trim(), password });
        navigate(destination, { replace: true });
      } catch (err) {
        if (err instanceof ApiError) {
          setErrorMessage(err.message);
        } else {
          setErrorMessage('Server belum dapat dijangkau. Coba masuk kembali.');
        }
      } finally {
        setLoading(false);
      }
    } else {
      if (!username.trim() || !nama.trim() || !email.trim() || !password.trim()) {
        setErrorMessage('Seluruh kolom formulir pendaftaran wajib diisi.');
        return;
      }

      if (password.length < 12) {
        setErrorMessage('Kata sandi minimal 12 karakter.');
        return;
      }

      setLoading(true);

      try {
        // 1. Panggil register dengan properti 'nama' (bukan 'name') agar sesuai BE
        await register({
          username: username.trim(),
          nama: nama.trim(),
          email: email.trim(),
          password,
        });

        setSuccessMessage('Akun berhasil dibuat. Sedang masuk...' );
        setActiveTab('login');

        await login({ username: username.trim(), password });

        navigate(destination, { replace: true });

      } catch (err) {
        if (err instanceof ApiError) {
          setErrorMessage(err.message);
        } else {
          setErrorMessage('Terjadi kesalahan saat pendaftaran akun baru.');
        }
      } finally {
        setLoading(false);
      }
    }
  };

  return <div className="gp-login">
    <div className="flex justify-between items-center max-w-6xl mx-auto"><Link to="/" className="gp-data-title text-sm"><ArrowLeft className="inline mr-2" size={16}/>Kembali ke Beranda</Link><ThemeToggle/></div>
    <div className="gp-login-layout"><section className="gp-login-intro"><div className="inline-flex items-center gap-3 text-2xl font-semibold"><Dna size={30} aria-hidden="true"/>GenoPath</div><h1>Analisis Anda.<br/>Dalam satu ruang kerja.</h1><p>Siapkan sampel, pantau proses, dan telusuri hasil varian bawang putih dengan konteks yang tetap terhubung.</p><p className="mt-6 text-sm">Bioinformatika IPB University</p></section>
    <section className="gp-auth-form" aria-label="Akses akun GenoPath"><div className="gp-auth-tabs" role="tablist" aria-label="Akses akun" onKeyDown={event => { if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) { event.preventDefault(); const tab = event.key === 'Home' ? 'login' : event.key === 'End' ? 'register' : activeTab === 'login' ? 'register' : 'login'; setActiveTab(tab); setErrorMessage(null); setSuccessMessage(null); document.getElementById(tab + '-tab')?.focus(); } }}><button type="button" role="tab" id="login-tab" aria-controls="auth-panel" aria-selected={activeTab==='login'} onClick={()=>{setActiveTab('login');setErrorMessage(null);setSuccessMessage(null);}}>Masuk Akun</button><button type="button" role="tab" id="register-tab" aria-controls="auth-panel" aria-selected={activeTab==='register'} onClick={()=>{setActiveTab('register');setErrorMessage(null);setSuccessMessage(null);}}>Buat Akun</button></div>
    <div id="auth-panel" role="tabpanel" aria-labelledby={activeTab==='login'?'login-tab':'register-tab'}><h2 className="text-xl font-semibold mb-2">{activeTab==='login'?'Selamat datang kembali':'Mulai dengan akun Anda'}</h2><p className="gp-muted text-sm mb-6">{activeTab==='login'?'Masuk untuk melanjutkan analisis dan melihat riwayat.':'Daftar untuk menyimpan dan meninjau analisis Anda.'}</p>
    {errorMessage&&<Alert>{errorMessage}</Alert>}{successMessage&&<Alert tone="success">{successMessage}</Alert>}
    <form onSubmit={handleSubmit}>
     <FormField htmlFor="username" label="Nama pengguna" hint="Identitas untuk masuk ke akun Anda."><input className="gp-input" id="username" required autoComplete="username" value={username} onChange={event=>setUsername(event.target.value)} aria-describedby="username-help" placeholder="Nama pengguna" disabled={loading}/></FormField>
     {activeTab==='register'&&<>
      <FormField htmlFor="nama" label="Nama lengkap"><input className="gp-input" id="nama" required autoComplete="name" value={nama} onChange={event=>setNama(event.target.value)} disabled={loading}/></FormField>
      <FormField htmlFor="email" label="Email"><input className="gp-input" id="email" required type="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} placeholder="nama@institusi.ac.id" disabled={loading}/></FormField>
     </>}
     <FormField htmlFor="password" label="Kata sandi" hint={activeTab==='register'?'Minimal 12 karakter. Jangan gunakan kata sandi yang sama dengan password demo.':undefined}>
      <div className="gp-password"><input className="gp-input" id="password" required type={showPassword?'text':'password'} autoComplete={activeTab==='register'?'new-password':'current-password'} value={password} onChange={event=>setPassword(event.target.value)} disabled={loading} aria-describedby={activeTab==='register'?'password-help':undefined}/><button type="button" aria-label={showPassword?'Sembunyikan kata sandi':'Tampilkan kata sandi'} aria-pressed={showPassword} onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff size={18} aria-hidden="true"/>:<Eye size={18} aria-hidden="true"/>}</button></div>
     </FormField>
     <Button type="submit" loading={loading}>{loading?'Sedang memproses...':activeTab==='login'?'Masuk Akun':'Buat Akun'}</Button>
    </form></div>
    <details className="gp-demo-note mt-6"><summary className="cursor-pointer">Butuh bantuan?</summary><p className="mt-2">Password demo dan kata sandi akun GenoPath berbeda. <a href={GOOGLE_FORM_URL} target="_blank" rel="noreferrer" className="underline">Hubungi tim melalui formulir bantuan.</a></p></details></section></div>
    <footer className="gp-login-footer">GenoPath · Bioinformatika IPB University</footer>
  </div>;
};
export default LoginPage;
