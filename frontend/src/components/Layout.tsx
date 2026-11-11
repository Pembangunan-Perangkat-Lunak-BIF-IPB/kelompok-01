import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
export function Layout({children}:{children?:ReactNode}){
 const {pathname}=useLocation();
 const landing=pathname==='/';
 const context=pathname==='/dashboard'?'Dashboard':pathname==='/riwayat'?'Riwayat':pathname==='/analisis-baru'?'Analisis Baru':pathname.endsWith('/result')?'Hasil Analisis':pathname.startsWith('/jobs/')?'Monitoring':'GenoPath';
 return <div className={'gp-shell'+(landing?' gp-landing':'')}>
  {!landing&&<div className="gp-workspace-motif" aria-hidden="true"/>}
  <a className="gp-skip" href="#main-content">Lewati ke konten utama</a><Navbar/>
  <main className="gp-main" id="main-content" tabIndex={-1}>
   <div className={landing ? undefined : 'gp-workspace-content'}>
   {!landing&&<div className="gp-topline"><nav aria-label="Lokasi halaman"><Link to="/dashboard">Ruang kerja</Link><span aria-hidden="true">/</span><span aria-current="page">{context}</span></nav><span className="gp-species-context"><i>Allium sativum</i><span>Bawang putih</span></span></div>}
   {children}
   </div>
   {!landing&&<footer className="gp-footer">GenoPath · Bioinformatika IPB University</footer>}
  </main>
  {landing&&<footer className="gp-footer">GenoPath · Pipeline bioinformatika Allium sativum · IPB University</footer>}
 </div>;
}
export default Layout;
