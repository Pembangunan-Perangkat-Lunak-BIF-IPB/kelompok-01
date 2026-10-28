import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
// Penambahan: Impor ThemeProvider dari ThemeContext
// Tujuannya: Memungkinkan seluruh komponen di dalam App mengakses state tema global
import { ThemeProvider } from './context/ThemeContext';
import { Layout } from './components/Layout';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { JobMonitoringPage } from './pages/JobMonitoringPage';
import { NewAnalysisPage } from './pages/NewAnalysisPage';

export function App() {
  return (
    // Penambahan: Membungkus seluruh aplikasi dengan <ThemeProvider> di hirarki terluar
    // Tujuannya: Agar pengaturan tema langsung aktif di semua halaman termasuk Login dan Layout
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Halaman Autentikasi Login */}
            <Route path="/login" element={<LoginPage />} />

            {/* Halaman Utama (Menggunakan Layout Navbar & Footer) */}
            <Route
              path="/"
              element={
                <Layout>
                  <LandingPage />
                </Layout>
              }
            />

            {/* Halaman Pemantauan Job / Status Pipeline */}
            <Route
              path="/dashboard"
              element={
                <Layout>
                  <JobMonitoringPage />
                </Layout>
              }
            />

            {/* Halaman Unggah Sampel & Analisis Baru */}
            <Route
              path="/analisis-baru"
              element={
                <Layout>
                  <NewAnalysisPage />
                </Layout>
              }
            />

            {/* Fallback Route: Pengalihan otomatis jika path URL tidak valid */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;