import type { ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/auth';
import { ThemeProvider } from './context/ThemeContext';
import { Layout } from './components/Layout';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { JobMonitoringPage } from './pages/JobMonitoringPage';
import { NewAnalysisPage } from './pages/NewAnalysisPage';
import { JobResultPage } from './pages/JobResultPage';

function Authenticated({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <Layout>{children}</Layout>;
}
export function App() {
  return <ThemeProvider><AuthProvider><Router><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/" element={<Layout><LandingPage /></Layout>} />
    <Route path="/dashboard" element={<Authenticated><JobMonitoringPage /></Authenticated>} />
    <Route path="/jobs/:jobId" element={<Authenticated><JobMonitoringPage /></Authenticated>} />
    <Route path="/analisis-baru" element={<Authenticated><NewAnalysisPage /></Authenticated>} />
    <Route path="/jobs/:jobId/result" element={<Authenticated><JobResultPage /></Authenticated>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Router></AuthProvider></ThemeProvider>;
}
export default App;
