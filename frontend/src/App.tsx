import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Layout } from './components/Layout';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { JobMonitoringPage } from './pages/JobMonitoringPage';
import { NewAnalysisPage } from './pages/NewAnalysisPage';
import { JobResultPage } from './pages/JobResultPage';

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Halaman Autentikasi Login (Terpisah dari Layout Utama) */}
            <Route path="/login" element={<LoginPage />} />

            {/* Wrapper Layout Utama (Merender Navbar, Outlet Konten, & Footer) */}
            <Route element={<Layout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/dashboard" element={<JobMonitoringPage />} />
              <Route path="/analisis-baru" element={<NewAnalysisPage />} />
              
              {/* Alias Rute Laporan/Hasil Analisis untuk Mengakomodasi Seluruh Tombol Navigasi */}
              <Route path="/jobs/:jobId" element={<JobResultPage />} />
              <Route path="/jobs/:jobId/result" element={<JobResultPage />} />
              <Route path="/report/:jobId" element={<JobResultPage />} />
            </Route>

            {/* Fallback Route: Pengalihan Otomatis ke Beranda jika URL Tidak Ditemukan */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;