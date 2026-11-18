import {Link} from '@tanstack/react-router';

/** Brand lockup built from the supplied Inventra logo assets.
 *  compact: emblem mark + wordmark text (tight chrome like the landing header)
 *  default: the full supplied lockup image (sidebar, auth) */
export function Brand({compact=false}:{compact?:boolean}){
  return <Link to="/" className="brand-link" aria-label="Inventra">
    {compact
      ? <><img src="/logo-mark.png" alt="" width={301} height={199} className="brand-mark"/><span className="brand-name">inventra</span><span className="brand-dot">.</span></>
      : <img src="/logo.png" alt="Inventra" width={536} height={482} className="brand-logo"/>}
  </Link>;
}
