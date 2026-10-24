import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { JobMonitoringPage } from './pages/JobMonitoringPage';
import { NewAnalysisPage } from './pages/NewAnalysisPage'; // <--- Impor Halaman Baru

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Halaman Login */}
          <Route path="/login" element={<LoginPage />} />

          {/* Halaman Beranda */}
          <Route
            path="/"
            element={
              <Layout>
                <LandingPage />
              </Layout>
            }
          />

          {/* Halaman Dashboard Pemantauan Job */}
          <Route
            path="/dashboard"
            element={
              <Layout>
                <JobMonitoringPage />
              </Layout>
            }
          />

          {/* Halaman Analisis Baru */}
          <Route
            path="/analisis-baru"
            element={
              <Layout>
                <NewAnalysisPage />
              </Layout>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;