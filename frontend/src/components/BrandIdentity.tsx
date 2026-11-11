import { Link } from 'react-router-dom';

/** Proposed identity: Azril sketch + AI prototype, pending team approval. */
export function BrandIdentity({ surface = false }: { surface?: boolean }) {
  return <Link to="/" className={'gp-brand' + (surface ? ' gp-brand--surface' : '')} aria-label="GenoPath, Beranda">
    <img className="gp-brand-prototype" src="/brand/genopath-prototype-v2.png" alt="" aria-hidden="true" width="50" height="44" />
    <span className="gp-brand-type"><span className="gp-wordmark">Geno<span>Path</span></span><span className="gp-brand-species"><i>Allium sativum</i></span></span>
  </Link>;
}
