import { Link } from 'react-router-dom';
import type { JobItem } from '../../services/api';
import { StatusBadge, TableFrame } from '../ui/Foundation';
const time=(value:string|null)=>value?new Date(value).toLocaleString('id-ID'):'Tidak tersedia';
export function JobTable({jobs}:{jobs:JobItem[]}){
 return <TableFrame label="Daftar analisis"><table><caption className="sr-only">Analisis milik akun, status, waktu dan hasil yang tersedia</caption><thead><tr>{['Analisis','Status','Mulai / Selesai','Aksi'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{jobs.map(job=><tr key={job.id_job}>
 <td><Link className="gp-data-title" to={'/jobs/'+job.id_job}>{job.analysis_name??'Analisis'}</Link><p className="gp-row-meta">Analisis #{job.analysis_number??'?'} · {job.execution_mode??'Mode tidak tersedia'}</p></td>
 <td><StatusBadge status={job.status}/>{job.status==='Failed'&&<p role="status" className="gp-row-meta">{job.pesan_error||'Job gagal. Minta operator memeriksa log eksekusi.'}</p>}{job.status==='Queued'&&<p className="gp-row-meta">Menunggu eksekusi; belum berarti pipeline sedang berjalan.</p>}</td>
 <td><p className="gp-row-meta">Mulai: {time(job.waktu_mulai)}</p><p className="gp-row-meta">Selesai: {time(job.waktu_selesai)}</p></td>
 <td>{job.status==='Completed'&&job.has_result?<Link className="gp-data-title" to={'/jobs/'+job.id_job+'/result'}>Lihat Hasil</Link>:job.status==='Failed'?<Link className="gp-data-title" to="/analisis-baru">Analisis Baru</Link>:job.status==='Completed'?'Hasil belum tersedia':<Link className="gp-data-title" to={'/jobs/'+job.id_job}>Pantau status</Link>}</td>
 </tr>)}</tbody></table></TableFrame>;
}
