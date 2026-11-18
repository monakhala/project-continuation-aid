import type {ReactNode} from 'react';
import {Link} from '@tanstack/react-router';
import {useInventra} from '@/components/inventra/provider';
import {useT} from '@/lib/inventra/i18n';
import type {Section} from '@/lib/inventra/types';

/** Small consistent tag for anything built on simulated data. */
export function SampleTag(){
  const {t}=useT();
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-warning"/>{t('sample')}</span>;
}

/** Opens each screen: the one question it answers, then the answer. */
export function ScreenIntro({q,a,children}:{q:string;a:ReactNode;children?:ReactNode}){
  const {demo}=useInventra();
  return <section className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
    <div className="min-w-0">
      <div className="flex items-center gap-3"><p className="text-xs font-medium text-muted-foreground">{q}</p>{demo&&<SampleTag/>}</div>
      <p className="font-display mt-2 text-3xl leading-tight">{a}</p>
    </div>
    {children}
  </section>;
}

export type Tone='ok'|'low'|'crit'|'idle';
const dot:Record<Tone,string>={ok:'bg-success',low:'bg-warning',crit:'bg-destructive',idle:'bg-muted-foreground'};
export function Status({tone,children}:{tone:Tone;children:ReactNode}){
  return <span className="inline-flex items-center gap-2 whitespace-nowrap"><span className={`h-2 w-2 shrink-0 rounded-full ${dot[tone]}`}/>{children}</span>;
}

export function Empty({line,action,to,onClick}:{line:string;action:string;to?:Section;onClick?:(()=>void)|undefined}){
  const cls='mt-4 inline-flex rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground';
  return <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
    <p className="text-sm text-muted-foreground">{line}</p>
    {to?<Link to="/app" search={{s:to}} className={cls}>{action}</Link>:<button type="button" onClick={onClick} className={cls}>{action}</button>}
  </div>;
}

export const th='px-3 py-2 text-start text-xs font-medium text-muted-foreground border-b border-border';
export const td='px-3 py-2.5 tnum';
export const tr='border-b border-border last:border-b-0 hover:bg-muted/40';
