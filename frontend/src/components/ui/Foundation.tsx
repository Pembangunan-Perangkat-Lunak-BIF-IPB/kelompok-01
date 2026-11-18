import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import type { JobStatus } from '../../services/api';

export function Button({variant='primary',loading=false,className='',children,disabled,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'secondary'|'ghost';loading?:boolean}){
 return <button {...props} disabled={disabled||loading} aria-busy={loading||undefined} className={'gp-button gp-button--'+variant+' '+className}>{loading&&<Loader2 aria-hidden="true" size={16} className="animate-spin"/>}{children}</button>;
}
export function PageHeader({title,description,actions}: {title:string;description?:ReactNode;actions?:ReactNode}){
 return <header className="gp-page-header"><div><h1>{title}</h1>{description&&<div className="gp-page-description">{description}</div>}</div>{actions&&<div className="gp-actions">{actions}</div>}</header>;
}
export function Alert({children,tone='error',...props}:HTMLAttributes<HTMLDivElement>&{tone?:'error'|'info'|'success'|'warning'}){
 return <div {...props} role={props.role??(tone==='error'?'alert':'status')} className={'gp-alert gp-alert--'+tone+(props.className?' '+props.className:'')}>{children}</div>;
}
export function StatePanel({title,children,action,loading=false}: {title:string;children?:ReactNode;action?:ReactNode;loading?:boolean}){
 return <div className="gp-state" role={loading?'status':undefined} aria-busy={loading||undefined}>{loading&&<Loader2 aria-hidden="true" size={22} className="animate-spin"/>}<p className="gp-state-title">{title}</p>{children&&<div className="gp-muted">{children}</div>}{action&&<div className="gp-actions">{action}</div>}</div>;
}
const stateLabel:Record<JobStatus,string>={Queued:'Dalam antrean',Running:'Sedang berjalan',Completed:'Selesai',Failed:'Gagal'};
export function StatusBadge({status}: {status:JobStatus}){
 return <span className={'gp-status gp-status--'+status.toLowerCase()} title={stateLabel[status]}><span aria-hidden="true" className="gp-status-dot"/>{status}</span>;
}
export function TableFrame({label,children}: {label:string;children:ReactNode}){
 return <div className="gp-table-frame"><div className="gp-table-scroll" role="region" aria-label={label} tabIndex={0}>{children}</div><p className="gp-table-hint">Geser tabel untuk melihat seluruh kolom pada layar kecil.</p></div>;
}
export function Pagination({from,to,total,previous,next,canPrevious,canNext}: {from:number;to:number;total:number;previous:()=>void;next:()=>void;canPrevious:boolean;canNext:boolean}){
 return <nav className="gp-pagination" aria-label="Halaman hasil"><p>Menampilkan {from}-{to} dari {total} record setelah filter.</p><div className="gp-actions"><Button variant="secondary" type="button" disabled={!canPrevious} onClick={previous}>Sebelumnya</Button><Button variant="secondary" type="button" disabled={!canNext} onClick={next}>Selanjutnya</Button></div></nav>;
}
export function FormField({label,htmlFor,hint,error,children}: {label:string;htmlFor:string;hint?:string;error?:string;children:ReactNode}){
 return <div className="gp-field"><label htmlFor={htmlFor}>{label}</label>{children}{hint&&<p id={htmlFor+'-help'} className="gp-field-hint">{hint}</p>}{error&&<p id={htmlFor+'-error'} role="alert" className="gp-field-error">{error}</p>}</div>;
}
