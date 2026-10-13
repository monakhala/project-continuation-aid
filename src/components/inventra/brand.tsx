import {Layers3} from 'lucide-react';
import {Link} from '@tanstack/react-router';
export function Brand({compact=false}:{compact?:boolean}){return <Link to="/" className="brand-link"><span className="brand-mark"><Layers3 size={23}/></span>{!compact&&<span>inventra<span className="brand-dot">.</span></span>}</Link>;}