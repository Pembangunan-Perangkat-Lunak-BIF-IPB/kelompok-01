import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
export function Layout({children}:{children?:ReactNode}){
 const landing=useLocation().pathname==='/';
 return <div className={'gp-shell'+(landing?' gp-landing':'')}>
  {!landing&&<div className="gp-workspace-motif" aria-hidden="true"/>}
  <a className="gp-skip" href="#main-content">Lewati ke konten utama</a><Navbar/>
  <main className="gp-main" id="main-content" tabIndex={-1}>
   <div className={landing ? undefined : 'gp-workspace-content'}>
   {!landing&&<div className="gp-topline"><span>Analisis varian DNA</span><span className="gp-species-context"><i>Allium sativum</i><span>Bawang putih</span></span></div>}
   {children}
   </div>
   {!landing&&<footer className="gp-footer">GenoPath · Bioinformatika IPB University</footer>}
  </main>
  {landing&&<footer className="gp-footer">GenoPath · Pipeline bioinformatika Allium sativum · IPB University</footer>}
 </div>;
}
export default Layout;
