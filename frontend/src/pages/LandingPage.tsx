import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { PipelineHero } from '../components/PipelineHero';
import { TeamSection } from '../components/TeamSection';
import { ContextHelp } from '../components/ContextHelp';

export function LandingPage(){
 const process=[{title:'Mulai dari sampel',text:'Pilih FASTQ single-end dan genom reference yang tersedia.',artifact:'FASTQ + reference'},{title:'Tentukan seleksi',text:'Gunakan default atau atur threshold QUAL dan FORMAT/DP.',artifact:'QUAL / FORMAT/DP'},{title:'Pantau analisis',text:'Ikuti status eksekusi pipeline pada analisis Anda.',artifact:'Nextflow'},{title:'Telusuri hasil',text:'Tinjau varian, gunakan filter, lalu unduh VCF atau CSV.',artifact:'VCF / CSV'}];
 return <>
 <section className="gp-hero"><div className="gp-hero-copy"><h1>Dari sampel bawang putih, ke varian DNA.</h1><p>Ruang kerja bioinformatika untuk menyiapkan analisis, mengikuti prosesnya, dan memahami hasil dalam satu alur.</p><PipelineHero/><Link to="/analisis-baru" className="gp-link-button gp-hero-start">Mulai Analisis Baru <ArrowUpRight size={18} aria-hidden="true"/></Link></div><div className="gp-hero-image" role="img" aria-label="Kampus IPB University, identitas lingkungan pengembangan GenoPath"/></section>
 <div className="gp-landing-body"><section><div className="gp-section-title"><h2>Alur yang jelas. Hasil yang dapat ditelusuri.</h2><ContextHelp label="Alur analisis">fastp memeriksa kualitas read, Bowtie2 memetakan read ke reference, SAMtools memproses alignment dan BCFtools memanggil varian. Tidak perlu menjalankan command line.</ContextHelp></div><ol className="gp-process" aria-label="Alur analisis GenoPath">{process.map(({title,text,artifact},index)=><li key={title}><span className="gp-process-node" aria-hidden="true">{index+1}</span><h3>{title}</h3><p>{text}</p><span className="gp-process-artifact">{artifact}</span></li>)}</ol></section>
 <div className="gp-team-wrap"><TeamSection/></div>
 </div></>;
}
export default LandingPage;
