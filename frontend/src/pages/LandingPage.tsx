import { Link } from 'react-router-dom';
import { ArrowUpRight, FileInput, SlidersHorizontal, Dna, FileDown } from 'lucide-react';
import { TeamSection } from '../components/TeamSection';
import { ContextHelp } from '../components/ContextHelp';

export function LandingPage(){
 const process=[{title:'Mulai dari sampel',text:'Pilih FASTQ single-end dan genom reference yang tersedia.',icon:FileInput},{title:'Tentukan seleksi',text:'Gunakan default atau atur threshold QUAL dan FORMAT/DP.',icon:SlidersHorizontal},{title:'Pantau analisis',text:'Ikuti status eksekusi pipeline pada analisis Anda.',icon:Dna},{title:'Telusuri hasil',text:'Tinjau varian, gunakan filter, lalu unduh VCF atau CSV.',icon:FileDown}];
 return <>
 <section className="gp-hero"><div className="gp-hero-copy"><h1>Dari sampel bawang putih, ke varian DNA.</h1><p>Ruang kerja bioinformatika untuk menyiapkan analisis, mengikuti prosesnya, dan memahami hasil dalam satu alur.</p><Link to="/analisis-baru" className="gp-link-button">Mulai Analisis Baru <ArrowUpRight size={18} aria-hidden="true"/></Link></div><div className="gp-hero-image" role="img" aria-label="Kampus IPB University, identitas lingkungan pengembangan GenoPath"/></section>
 <div className="gp-landing-body"><section><div className="gp-section-title"><h2>Alur yang jelas. Hasil yang dapat ditelusuri.</h2><ContextHelp label="Alur analisis">fastp memeriksa kualitas read, Bowtie2 memetakan read ke reference, SAMtools memproses alignment dan BCFtools memanggil varian. Tidak perlu menjalankan command line.</ContextHelp></div><div className="gp-process">{process.map(({title,text,icon:Icon})=><article key={title}><Icon size={22} aria-hidden="true"/><h3>{title}</h3><p>{text}</p></article>)}</div></section>
 <div className="gp-team-wrap"><TeamSection/></div>
 </div></>;
}
export default LandingPage;
