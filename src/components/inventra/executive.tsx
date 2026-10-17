import {useMemo,useState} from 'react';
import {Link} from '@tanstack/react-router';
import {ArrowDownRight,ArrowUpRight,Minus,Info} from 'lucide-react';
import {useInventra} from '@/components/inventra/provider';
import {useT} from '@/lib/inventra/i18n';
import {money} from '@/lib/inventra/data';
import {analytics,priceRow,weekly,type Insight} from '@/lib/inventra/pricing';

const panel='border border-border bg-card';
const th='px-3 py-2 text-start text-[11px] font-semibold uppercase tracking-wider text-muted-foreground';
const td='px-3 py-2.5 tnum';
const pct=(n:number,dp=1)=>`${(n*100).toFixed(dp)}%`;

function Delta({v,unit='%',good=1}:{v:number|null;unit?:string;good?:1|-1}){
  if(v===null||!isFinite(v))return <span className="text-xs text-muted-foreground">—</span>;
  const flat=Math.abs(v)<0.05,up=v>0,ok=flat?null:(up?good===1:good===-1);
  const I=flat?Minus:up?ArrowUpRight:ArrowDownRight;
  return <span className={`inline-flex items-center gap-0.5 text-xs font-semibold tnum ${ok===null?'text-muted-foreground':ok?'text-success':'text-destructive'}`} dir="ltr"><I size={13}/>{up?'+':''}{v.toFixed(1)}{unit}</span>;
}

function Kpi({label,value,delta,note}:{label:string;value:string;delta:React.ReactNode;note:string}){
  return <div className="px-5 py-4"><p className="text-xs font-medium text-muted-foreground">{label}</p>
    <p className="mt-2 kpi-num">{value}</p>
    <div className="mt-1 flex items-center gap-2">{delta}<span className="text-xs text-muted-foreground">{note}</span></div></div>;
}

export function ExecutiveDashboard(){
  const {t}=useT(),{data:d}=useInventra();const a=useMemo(()=>analytics(d),[d]);
  const below=d.P.filter(p=>p.stock<=p.min).length,out=d.P.filter(p=>p.stock===0).length;
  const health=d.P.length?Math.round(100*(d.P.length-below)/d.P.length):0;
  const valD=a.valPrev>0?((a.val-a.valPrev)/a.valPrev)*100:null;
  const gmD=a.gm!==null&&a.gmPrev!==null?(a.gm-a.gmPrev)*100:null;
  const label:Record<Insight['kind'],string>={erosion:t('insErosion'),adjust:t('insAdjust'),dead:t('insDead'),stockout:t('insStockout')};
  const target:Record<Insight['kind'],'pricing'|'restock'|'inventory'>={erosion:'pricing',adjust:'pricing',dead:'inventory',stockout:'restock'};
  const sev=(s:number)=>s===3?[t('sevHigh'),'bg-destructive']:s===2?[t('sevMed'),'bg-warning']:[t('sevLow'),'bg-muted-foreground'];
  return <div className="space-y-5">
    <section className="flex flex-wrap items-stretch overflow-hidden rounded-lg border border-border bg-sidebar text-sidebar-foreground">
      <div className="min-w-[200px] flex-1 border-e border-sidebar-border px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">{t('summary')}</p>
        <p className="mt-1 text-sm text-sidebar-accent-foreground">{t('health')}: <b className="text-lg tnum">{health}/100</b></p>
        <div className="mt-2 h-1.5 w-full max-w-[220px] rounded-full bg-sidebar-accent"><div className="h-full rounded-full bg-sidebar-primary" style={{width:`${health}%`}}/></div>
      </div>
      {[[t('activeSkus'),d.P.length],[t('coverage'),below],[t('exposure'),out],[t('openOrders'),d.R.filter(r=>!['Received','Cancelled'].includes(r.status)).length]].map(([k,v])=>
        <div key={k as string} className="border-e border-sidebar-border px-5 py-4 last:border-e-0"><p className="text-[11px] uppercase tracking-wider opacity-70">{k}</p><p className="mt-1 text-xl font-semibold text-sidebar-accent-foreground tnum">{v}</p></div>)}
    </section>

    <section className={`${panel} grid divide-y divide-border rounded-md sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x rtl:lg:divide-x-reverse`}>
      <Kpi label={t('kValuation')} value={money(d,a.val)} delta={<Delta v={valD}/>} note={t('vs30')}/>
      <Kpi label={t('kMargin')} value={a.gm===null?'—':pct(a.gm)} delta={<Delta v={gmD} unit="pp"/>} note={t('vs30')}/>
      <Kpi label={t('kLift')} value={`${money(d,a.lift)}`} delta={<Delta v={a.weeklyGP>0?(a.lift/a.weeklyGP)*100:null}/>} note={`${t('ofGP')} · ${t('perWeek')}`}/>
      <Kpi label={t('kUrgent')} value={String(a.recs.length)} delta={<span className="text-xs font-semibold tnum">{money(d,a.capital)}</span>} note={t('capitalNeeded')}/>
    </section>

    <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
      <section className={`${panel} rounded-md`}>
        <header className="flex items-center justify-between border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">{t('insights')}</h2><span className="text-xs text-muted-foreground tnum">{a.insights.length}</span></header>
        {a.insights.length?<div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/60"><tr><th className={th}>{t('priority')}</th><th className={th}>{t('signal')}</th><th className={th}>{t('item')}</th><th className={`${th} text-end`}>{t('metric')}</th><th className={th}/></tr></thead>
          <tbody>{a.insights.map((x,i)=>{const [s,c]=sev(x.sev);return <tr key={i} className="border-t border-border hover:bg-muted/40">
            <td className={td}><span className="inline-flex items-center gap-2 text-xs font-medium"><span className={`h-2 w-2 rounded-full ${c}`}/>{s}</span></td>
            <td className={td}>{label[x.kind]}</td><td className={`${td} font-medium`}>{x.name}</td><td className={`${td} text-end font-semibold`} dir="ltr">{x.metric}</td>
            <td className={`${td} text-end`}><Link to="/app" search={{s:target[x.kind]}} className="text-xs font-medium text-primary hover:underline">{t('viewAll')} →</Link></td></tr>;})}</tbody></table></div>
          :<p className="px-4 py-6 text-sm text-muted-foreground">{t('noInsights')}</p>}
      </section>
      <section className={`${panel} rounded-md`}>
        <header className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">{t('recommended')}</h2></header>
        {a.recs.length?<table className="w-full text-sm"><thead className="bg-muted/60"><tr><th className={th}>{t('item')}</th><th className={`${th} text-end`}>{t('qty')}</th><th className={`${th} text-end`}>{t('cost')}</th></tr></thead>
          <tbody>{a.recs.map(({p,r})=><tr key={p.id} className="border-t border-border"><td className={td}>{p.name}</td><td className={`${td} text-end font-semibold`}>{r.qty}</td><td className={`${td} text-end`}>{money(d,r.qty*p.cost)}</td></tr>)}</tbody></table>
          :<p className="px-4 py-6 text-sm text-muted-foreground">{t('noAction')}</p>}
      </section>
    </div>
  </div>;
}

function TrendChart({pid}:{pid:number}){
  const {t}=useT(),{data:d}=useInventra();const p=d.P.find(x=>x.id===pid);
  const w=useMemo(()=>p?weekly(d,p):[],[d,p]);
  if(!p||!w.length)return <p className="px-4 py-8 text-sm text-muted-foreground">{t('noForecast')}</p>;
  const W=720,H=220,pad={l:44,r:52,t:14,b:28},iw=W-pad.l-pad.r,ih=H-pad.t-pad.b;
  const qMax=Math.max(1,...w.map(x=>x.qty)),ps=w.map(x=>x.price),pMin=Math.min(...ps)*0.95,pMax=Math.max(...ps)*1.05||1;
  const bw=iw/w.length,x=(i:number)=>pad.l+i*bw+bw/2,yP=(v:number)=>pad.t+ih-((v-pMin)/(pMax-pMin||1))*ih;
  const line=w.map((v,i)=>`${i?'L':'M'}${x(i)},${yP(v.price)}`).join(' ');
  return <div className="px-4 pb-4" dir="ltr">
    <div className="mb-2 flex gap-4 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-primary/25"/>{t('volume')}</span><span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-sidebar"/>{t('price')}</span></div>
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t('trendTitle')}>
      {[0,.5,1].map(f=><g key={f}><line x1={pad.l} x2={W-pad.r} y1={pad.t+ih*(1-f)} y2={pad.t+ih*(1-f)} className="stroke-border"/>
        <text x={pad.l-6} y={pad.t+ih*(1-f)+4} textAnchor="end" className="fill-muted-foreground text-[10px]">{Math.round(qMax*f)}</text>
        <text x={W-pad.r+6} y={pad.t+ih*(1-f)+4} className="fill-muted-foreground text-[10px]">{(pMin+(pMax-pMin)*f).toFixed(2)}</text></g>)}
      {w.map((v,i)=><rect key={i} x={pad.l+i*bw+bw*0.18} width={bw*0.64} y={pad.t+ih-(v.qty/qMax)*ih} height={(v.qty/qMax)*ih} className="fill-primary/25"/>)}
      <path d={line} fill="none" strokeWidth={2} className="stroke-sidebar"/>
      {w.map((v,i)=><circle key={i} cx={x(i)} cy={yP(v.price)} r={3} className="fill-card stroke-sidebar" strokeWidth={2}/>)}
      {w.map((v,i)=>i%2===0&&<text key={i} x={x(i)} y={H-8} textAnchor="middle" className="fill-muted-foreground text-[10px]">{v.start.slice(5)}</text>)}
    </svg></div>;
}

export function PriceIntelligence(){
  const {t}=useT(),{data:d,commit,role,busy}=useInventra();
  const rows=useMemo(()=>d.P.map(p=>priceRow(d,p)),[d]);const [sel,setSel]=useState<number>(rows.find(r=>r.el)?.p.id??rows[0]?.p.id??0);
  const edit=role!=='supplier';
  const setComp=(pid:number,v:string)=>{const n=v===''?null:Number(v);if(n!==null&&(!isFinite(n)||n<0))return;
    void commit(x=>{const px=(x.px??={}) as {comp?:Record<string,number>};px.comp={...(px.comp??{})};if(n===null)delete px.comp[pid];else px.comp[pid]=n;});};
  return <div className="space-y-5">
    <section className={`${panel} rounded-md`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">{t('pricing')}</h2>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Info size={13}/>{t('compHelp')}</p></header>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead className="bg-muted/60"><tr>{[t('sku'),t('name'),t('cost'),t('curPrice'),t('compPrice'),t('gm'),t('elast'),t('optPrice'),t('lift')].map((h,i)=><th key={h} className={`${th} ${i>=2?'text-end':''}`}>{h}</th>)}</tr></thead>
        <tbody>{rows.map(r=>{const gap=r.comp?((r.p.price-r.comp)/r.comp)*100:null;return <tr key={r.p.id} onClick={()=>setSel(r.p.id)} className={`cursor-pointer border-t border-border ${sel===r.p.id?'bg-accent/50':'hover:bg-muted/40'}`}>
          <td className={`${td} font-mono text-xs text-muted-foreground`}>{r.p.sku}</td><td className={`${td} font-medium`}>{r.p.name}</td>
          <td className={`${td} text-end text-muted-foreground`}>{money(d,r.p.cost)}</td><td className={`${td} text-end font-semibold`}>{money(d,r.p.price)}</td>
          <td className={`${td} text-end`} onClick={e=>e.stopPropagation()}>{edit?<input key={`${r.p.id}-${r.comp}`} type="number" step="0.01" min={0} disabled={busy} defaultValue={r.comp??''} placeholder={t('notSet')} onBlur={e=>{if(e.target.value!==String(r.comp??''))setComp(r.p.id,e.target.value);}} className="w-24 rounded border border-input bg-background px-2 py-1 text-end text-sm tnum"/>:r.comp!==null?money(d,r.comp):<span className="text-muted-foreground">{t('notSet')}</span>}
            {gap!==null&&<div className={`text-[11px] tnum ${gap>5?'text-warning':gap<-5?'text-primary':'text-muted-foreground'}`} dir="ltr">{gap>0?'+':''}{gap.toFixed(1)}%</div>}</td>
          <td className={`${td} text-end`}><span className={r.gm<0.2?'font-semibold text-destructive':r.gm<0.3?'font-semibold text-warning':''}>{pct(r.gm)}</span></td>
          <td className={`${td} text-end`}>{r.el?<span title={`${t('fit')} R² ${r.el.r2.toFixed(2)} · ${r.el.n} ${t('weeks')}`} dir="ltr">{r.el.e.toFixed(2)}<span className="ms-1 text-[11px] text-muted-foreground">R² {r.el.r2.toFixed(2)}</span></span>:<span className="text-xs text-muted-foreground">{t('notMeasurable')}</span>}</td>
          <td className={`${td} text-end font-semibold`}>{r.opt===null?<span className="text-xs font-normal text-muted-foreground">—</span>:r.opt===r.p.price?<span className="text-xs font-normal text-muted-foreground">{t('hold')}</span>:<span className="text-primary">{money(d,r.opt)}</span>}</td>
          <td className={`${td} text-end`}>{r.liftWeekly>0?<span className="font-semibold text-success" dir="ltr">+{money(d,r.liftWeekly)}</span>:<span className="text-muted-foreground">—</span>}</td></tr>;})}</tbody></table></div>
      <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">{t('elastHelp')}</p>
    </section>
    <section className={`${panel} rounded-md`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">{t('trendTitle')}</h2>
        <select value={sel} onChange={e=>setSel(Number(e.target.value))} className="rounded border border-input bg-background px-2 py-1 text-sm">{d.P.map(p=><option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}</select></header>
      <div className="pt-3"><TrendChart pid={sel}/></div>
    </section>
  </div>;
}
