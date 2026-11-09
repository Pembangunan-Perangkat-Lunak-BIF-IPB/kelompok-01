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
            {/* Halaman Autentikasi Login */}
            <Route path="/login" element={<LoginPage />} />

            {/* Halaman Beranda Utama */}
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

            {/* Halaman Hasil Analisis Varian */}
            <Route
              path="/jobs/:jobId/result"
              element={
                <Layout>
                  <JobResultPage />
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