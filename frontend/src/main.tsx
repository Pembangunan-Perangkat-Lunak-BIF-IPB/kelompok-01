import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx' // 1. Impor AuthProvider

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* 2. Membungkus <App /> dengan <AuthProvider> */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
