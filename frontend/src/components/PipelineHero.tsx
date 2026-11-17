import { useEffect, useRef, useState, useId, type CSSProperties } from 'react';
import { FileUp, SlidersHorizontal, Workflow, FileCheck2, Pause, Play } from 'lucide-react';
import './PipelineHero.css';

const stages = [
  { title: 'FASTQ', detail: 'Single-end', icon: FileUp },
  { title: 'Konfigurasi', detail: 'Reference, QUAL/DP', icon: SlidersHorizontal },
  { title: 'Pipeline', detail: 'Nextflow', icon: Workflow },
  { title: 'Hasil varian', detail: 'VCF / CSV', icon: FileCheck2 },
];
const centers = [56, 196, 336, 476];

/** Conceptual product diagram. Never reads, creates or simulates a real Job. */
export function PipelineHero() {
  const ref = useRef<HTMLElement>(null);
  const sampleRef = useRef<SVGGElement>(null);
  const caption = useId();
  const [idle, setIdle] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  const [reduced, setReduced] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const visibility = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver !== 'function') return;
    const observer = new IntersectionObserver(entries => setInView(entries[0]?.isIntersecting ?? false), { threshold: 0.15 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const sample = sampleRef.current;
    if (!sample) return;
    const finish = (event: AnimationEvent) => {
      if (event.target === sample && event.animationName === 'gp-sample-first') setIdle(true);
    };
    sample.addEventListener('animationend', finish);
    return () => sample.removeEventListener('animationend', finish);
  }, []);
  const paused = userPaused || !inView || !pageVisible;
  return <figure ref={ref} aria-label="Dari FASTQ ke hasil varian" aria-describedby={caption}
    className={'gp-pipeline-hook' + (idle ? ' is-idle' : '') + (paused ? ' is-paused' : '') + (reduced ? ' is-reduced' : '')}
    data-motion={reduced ? 'static' : paused ? 'paused' : idle ? 'idle' : 'entrance'}>
    <svg className="gp-pipeline-diagram" viewBox="0 0 532 116" aria-hidden="true" focusable="false">
      <path className="gp-hook-track" d="M56 84H476" />
      <path className="gp-hook-draw" d="M56 84H476" pathLength="1" />
      {stages.map(({ title, icon: Icon }, index) => <g key={title} className={'gp-hook-node gp-hook-node-' + index} style={{ '--gp-node-delay': index * 90 + 'ms' } as CSSProperties}>
        <path className="gp-hook-stem" d={'M' + centers[index] + ' 68V84'} />
        <rect x={centers[index] - 25} y="16" width="50" height="52" rx="12" />
        <Icon x={centers[index] - 12} y="29" width="24" height="24" strokeWidth="1.7" />
      </g>)}
      <g ref={sampleRef} className="gp-flow-sample">
        <rect x="-9" y="-12" width="18" height="24" rx="4" />
        <path d="M-4 -5H4M-4 0H4M-4 5H1" />
      </g>
      <g className="gp-hook-result-mark"><circle cx="504" cy="22" r="12" /><path d="M498 22L502 26L510 17" pathLength="1" /></g>
    </svg>
    <ol className="gp-hook-stages" aria-label="Tahap pipeline GenoPath">{stages.map(stage => <li key={stage.title}><strong>{stage.title}</strong><span>{stage.detail}</span></li>)}</ol>
    <div className="gp-hook-controls"><figcaption id={caption}>Ilustrasi alur analisis</figcaption>
      <button type="button" className="gp-hook-toggle" disabled={reduced} aria-pressed={userPaused}
        aria-label={reduced ? 'Animasi alur nonaktif sesuai preferensi perangkat' : userPaused ? 'Putar animasi alur' : 'Jeda animasi alur'} onClick={() => setUserPaused(value => !value)}>
        {userPaused || reduced ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}{reduced ? 'Gerak dikurangi' : userPaused ? 'Putar' : 'Jeda'}
      </button>
    </div>
  </figure>;
}
