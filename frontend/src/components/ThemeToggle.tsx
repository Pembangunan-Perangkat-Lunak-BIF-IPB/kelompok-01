import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/theme';
export function ThemeToggle(){
 const {theme,toggleTheme}=useTheme();const label=theme==='light'?'Beralih ke Mode Malam':'Beralih ke Mode Siang';
 return <button type="button" onClick={toggleTheme} className="gp-button gp-button--secondary gp-icon-button" title={label} aria-label={label} aria-pressed={theme==='dark'}>{theme==='light'?<Moon size={18} aria-hidden="true"/>:<Sun size={18} aria-hidden="true"/>}</button>;
}
