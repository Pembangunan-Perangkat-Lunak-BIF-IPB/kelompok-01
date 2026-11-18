import type { ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { App } from '../src/App';
const state=vi.hoisted(()=>({isAuthenticated:true,profileLoading:false}));
vi.mock('../src/context/AuthContext',()=>({AuthProvider:({children}:{children:ReactNode})=>children}));
vi.mock('../src/context/auth',()=>({useAuth:()=>({...state,user:{nama:'Profil persisten',username:'tester'},logout:vi.fn()})}));
vi.mock('../src/context/ThemeContext',()=>({ThemeProvider:({children}:{children:ReactNode})=>children}));
vi.mock('../src/context/theme',()=>({useTheme:()=>({theme:'light',toggleTheme:vi.fn()})}));
vi.mock('../src/pages/DashboardPage',()=>({DashboardPage:()=> <h1>Dashboard uji</h1>}));
vi.mock('../src/pages/HistoryPage',()=>({HistoryPage:()=> <h1>Riwayat uji</h1>}));
vi.mock('../src/pages/JobMonitoringPage',()=>({JobMonitoringPage:()=> <h1>Monitoring uji</h1>}));
vi.mock('../src/pages/JobResultPage',()=>({JobResultPage:()=> <h1>Hasil uji</h1>}));
vi.mock('../src/pages/NewAnalysisPage',()=>({NewAnalysisPage:()=> <h1>Analisis uji</h1>}));
vi.mock('../src/pages/LoginPage',()=>({LoginPage:()=> <h1>Masuk uji</h1>}));
beforeEach(()=>{state.isAuthenticated=true;state.profileLoading=false;});
it.each([['/dashboard','Dashboard uji','Dashboard'],['/riwayat','Riwayat uji','Riwayat'],['/jobs/9','Monitoring uji','Riwayat'],['/jobs/9/result','Hasil uji','Riwayat'],['/analisis-baru','Analisis uji','Analisis Baru']])('routes %s to its owner and marks the correct navigation',async(path,title,active)=>{
 window.history.replaceState(null,'',path);render(<App/>);await screen.findByRole('heading',{name:title});
 const nav=screen.getByRole('navigation',{name:'Navigasi utama'});expect(within(nav).getByRole('link',{name:active}).getAttribute('aria-current')).toBe('page');
});
it('keeps history protected instead of rendering another user context',async()=>{
 state.isAuthenticated=false;window.history.replaceState(null,'','/riwayat');render(<App/>);await screen.findByRole('heading',{name:'Masuk uji'});expect(window.location.pathname).toBe('/login');
});
