import { Link, useLocation } from 'react-router-dom';
import { House, LayoutDashboard, History, FlaskConical, LogOut, LogIn } from 'lucide-react';
import { useAuth } from '../context/auth';
import { ThemeToggle } from './ThemeToggle';
import { BrandIdentity } from './BrandIdentity';

export function Navbar(){
 const {pathname}=useLocation();const {user,isAuthenticated,logout}=useAuth();
 const items=[{label:'Beranda',path:'/',icon:House},{label:'Dashboard',path:'/dashboard',icon:LayoutDashboard},{label:'Riwayat',path:'/riwayat',icon:History},{label:'Analisis Baru',path:'/analisis-baru',icon:FlaskConical}];
 const name=user?.nama||user?.name||'Profil';
 return <header className="gp-nav">
  <div><BrandIdentity/><p className="gp-brand-note">Analisis varian bawang putih</p></div>
  <nav aria-label="Navigasi utama">{items.map(({label,path,icon:Icon})=>{
   const active=pathname===path||(path==='/riwayat'&&pathname.startsWith('/jobs/'));
   return <Link key={path} to={path} aria-current={active?'page':undefined} className="gp-nav-link"><Icon size={18} aria-hidden="true"/>{label}</Link>;
  })}</nav>
  <div className="gp-nav-footer"><p>Bioinformatika IPB University</p>
   {isAuthenticated&&user&&<div className="gp-profile"><span className="gp-avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</span><div><p className="gp-profile-name">{name}</p><p className="gp-profile-handle">@{user.username}</p></div></div>}
   <div className="gp-nav-controls"><ThemeToggle/>{isAuthenticated?<button type="button" onClick={logout} title="Keluar / Logout" aria-label="Keluar / Logout" className="gp-button gp-button--secondary gp-icon-button"><LogOut size={18} aria-hidden="true"/></button>:<Link to="/login" className="gp-nav-link"><LogIn size={18} aria-hidden="true"/>Masuk</Link>}</div>
  </div>
 </header>;
}
export default Navbar;
