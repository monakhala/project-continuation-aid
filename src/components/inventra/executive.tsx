import {useMemo,useState} from 'react';
import {toast} from 'sonner';
import {Link} from '@tanstack/react-router';
import {ArrowDownRight,ArrowUpRight,Minus,Info,AlertTriangle,ShieldAlert,Clock} from 'lucide-react';
import {useInventra} from '@/components/inventra/provider';
import {useT,fmt} from '@/lib/inventra/i18n';
import {Empty,ScreenIntro,Status} from '@/components/inventra/ui';
import {money,getExpiryInfo,SUPPORTED_CURRENCIES} from '@/lib/inventra/data';
import {analytics,priceRow,weekly,type Insight} from '@/lib/inventra/pricing';
import {liquidationRows,applyClearance,clearanceApplied} from '@/lib/inventra/liquidation';
import type {Currency} from '@/lib/inventra/types';

const panel='overflow-hidden rounded-xl border border-border bg-card';
const th='px-4 py-3 text-start text-xs font-medium text-muted-foreground';
const td='border-t border-border px-4 py-3 tnum';
const pct=(n:number,dp=1)=>`${(n*100).toFixed(dp)}%`;

function Delta({v,unit='%',good=1}:{v:number|null;unit?:string;good?:1|-1}){
  const {t}=useT();
  if(v===null||!isFinite(v))return <span className="text-xs text-muted-foreground">{t('na')}</span>;
  const flat=Math.abs(v)<0.05,up=v>0,ok=flat?null:(up?good===1:good===-1);
  const I=flat?Minus:up?ArrowUpRight:ArrowDownRight;
  return <span className={`inline-flex items-center gap-0.5 text-xs font-semibold tnum ${ok===null?'text-muted-foreground':ok?'text-success':'text-destructive'}`} dir="ltr"><I size={13}/>{up?'+':''}{v.toFixed(1)}{unit}</span>;
}

function Kpi({label,value,delta,note,secondary}:{label:string;value:string;delta:React.ReactNode;note:string;secondary?:React.ReactNode}){
  return <div className="kpi-card min-w-0 rounded-xl border p-6">
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    <p className="mt-3 break-words kpi-num">{value}</p>
    <div className="mt-2 flex flex-wrap items-center gap-2">{delta}<span className="text-xs text-muted-foreground">{note}</span></div>
    {secondary&&<div className="mt-3 border-t border-border/70 pt-2 text-xs text-muted-foreground">{secondary}</div>}
  </div>;
}

function LiquidationPanel(){
  const {t,lang}=useT();
  const {data:d,commit,role}=useInventra();
  const rows=useMemo(()=>liquidationRows(d),[d]);
  const sum=(k:'trapped'|'cashRecovered'|'holdingCost')=>rows.reduce((s,x)=>s+x.r[k],0);
  return <section className={panel}>
    <header className="px-6 py-5 border-b border-border">
      <h2 className="font-semibold">{t('liqTitle')}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{t('liqNote')}</p>
    </header>
    {rows.length?<>
      <div className="grid gap-px bg-border sm:grid-cols-3">
        {([['liqTrapped','trapped'],['liqRecover','cashRecovered'],['liqHold','holdingCost']] as const).map(([l,k])=>
          <div key={k} className="bg-card px-6 py-4"><p className="text-xs text-muted-foreground">{t(l)}</p><p className="mt-1 text-xl font-semibold tnum">{money(d,sum(k),lang)}</p></div>)}
      </div>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr><th className={th}>{t('item')}</th><th className={th}>{t('liqReason')}</th><th className={`${th} text-end`}>{t('stock')}</th><th className={`${th} text-end`}>{t('liqCover')}</th><th className={`${th} text-end`}>{t('liqAtRisk')}</th><th className={`${th} text-end`}>{t('liqTrapped')}</th><th className={`${th} text-end`}>{t('price')}</th><th className={`${th} text-end`}>{t('liqFloor')}</th><th className={`${th} text-end`}>{t('liqPrice')}</th><th className={`${th} text-end`}>{t('actions')}</th></tr></thead>
        <tbody>{rows.map(({p,r})=><tr key={p.id} className="hover:bg-muted/40">
          <td className={`${td} font-medium`}>{p.name} <span className="ms-1 font-mono text-xs text-muted-foreground">{p.sku}</span></td>
          <td className={td}><Status tone={r.reason==='expiry'?'crit':'low'}>{t(r.reason==='expiry'?'liqExpiry':'liqSlow')}</Status></td>
          <td className={`${td} text-end`}>{p.stock}</td>
          <td className={`${td} text-end`}>{r.daysCover===null?'∞':Math.round(r.daysCover)}</td>
          <td className={`${td} text-end`}>{r.atRiskUnits}</td>
          <td className={`${td} text-end`}>{money(d,r.trapped,lang)}</td>
          <td className={`${td} text-end text-muted-foreground`}>{money(d,p.price,lang)}</td>
          <td className={`${td} text-end text-muted-foreground`}>{money(d,r.floorPrice,lang)}</td>
          <td className={`${td} text-end font-semibold`}>{money(d,r.clearancePrice,lang)} <span className="text-xs text-muted-foreground">−{Math.round((1-r.clearancePrice/p.price)*100)}%</span></td>
          <td className={`${td} text-end`}>{clearanceApplied(d,p.id)?<Status tone="ok">{t('clearanceApplied')}</Status>:<button className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50 cursor-pointer" disabled={role==='supplier'} onClick={async()=>{const ok=await commit(x=>applyClearance(x,p.id));if(ok)toast.success(t('clearanceSaved'));}}>{t('clearanceApply')}</button>}</td>
        </tr>)}</tbody>
      </table></div>
    </>:<p className="px-6 py-5 text-sm text-muted-foreground">{t('liqNone')}</p>}
  </section>;
}

export function ExecutiveDashboard(){
  const {t,lang}=useT(),{data:d}=useInventra();
  const a=useMemo(()=>analytics(d),[d]);
  const below=d.P.filter(p=>p.stock<=p.min).length,out=d.P.filter(p=>p.stock===0).length;
  const health=d.P.length?Math.round(100*(d.P.length-below)/d.P.length):0;
  const valD=a.valPrev>0?((a.val-a.valPrev)/a.valPrev)*100:null;
  const gmD=a.gm!==null&&a.gmPrev!==null?(a.gm-a.gmPrev)*100:null;

  const label:Record<Insight['kind'],string>={
    erosion:t('insErosion'),
    adjust:t('insAdjust'),
    dead:t('insDead'),
    stockout:t('insStockout'),
    expiry:t('insExpiry')
  };
  const target:Record<Insight['kind'],'pricing'|'restock'|'inventory'>={
    erosion:'pricing',
    adjust:'pricing',
    dead:'inventory',
    stockout:'restock',
    expiry:'inventory'
  };
  const sev=(s:number)=>s===3?[t('sevHigh'),'bg-destructive']:s===2?[t('sevMed'),'bg-warning']:[t('sevLow'),'bg-muted-foreground'];

  // Expiring batches for FEFO shield
  const expiringBatches=useMemo(()=>{
    return d.P
      .filter(p=>Boolean(p.expiry_date)&&p.stock>0)
      .map(p=>({p,exp:getExpiryInfo(p.expiry_date)}))
      .filter(x=>x.exp.tier!=='none'&&x.exp.tier!=='healthy')
      .sort((a,b)=>(a.exp.daysLeft??999)-(b.exp.daysLeft??999));
  },[d.P]);

  return <div className="space-y-8">
    <ScreenIntro q={t('qDash')} a={fmt(t('aDash'),{h:d.P.length-below,n:d.P.length,u:below})}/>
    {!d.P.length?<Empty line={t('emptyInv')} action={t('goInventory')} to="inventory"/>:<>
    <section className="grid gap-x-8 gap-y-5 border-y border-border py-6 sm:grid-cols-2 xl:grid-cols-5">
      <div className="min-w-0 xl:col-span-1">
        <p className="text-xs font-medium text-muted-foreground">{t('summary')}</p>
        <p className="mt-2 text-sm">{t('health')} <b className="ms-1 text-xl font-semibold tnum">{health}/100</b></p>
        <div className="mt-3 h-1 w-full max-w-[220px] bg-muted"><div className="h-full bg-chart-3" style={{width:`${health}%`}}/></div>
      </div>
      {[[t('activeSkus'),d.P.length],[t('coverage'),below],[t('exposure'),out],[t('openOrders'),d.R.filter(r=>!['Received','Cancelled'].includes(r.status)).length]].map(([k,v])=>
        <div key={k as string} className="border-s border-border ps-4"><p className="text-xs text-muted-foreground">{k}</p><p className="mt-2 text-2xl font-semibold tnum">{v}</p></div>)}
    </section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi
        label={t('kValuation')}
        value={money(d,a.val,lang)}
        delta={<Delta v={valD}/>}
        note={t('vs30')}
        secondary={<div className="flex justify-between items-center"><span>{t('kRepValuation')}:</span><span className="font-semibold text-foreground tnum">{money(d,a.repVal,lang)}</span></div>}
      />
      <Kpi
        label={t('kMargin')}
        value={a.gm===null?'—':pct(a.gm)}
        delta={<Delta v={gmD} unit="pp"/>}
        note={t('vs30')}
        secondary={<div className="flex justify-between items-center"><span>{t('kRepMargin')}:</span><span className={`font-semibold tnum ${a.repGm!==null&&a.repGm<0.2?'text-destructive':'text-foreground'}`}>{a.repGm===null?'—':pct(a.repGm)}</span></div>}
      />
      <Kpi label={t('kLift')} value={`${money(d,a.lift,lang)}`} delta={<Delta v={a.weeklyGP>0?(a.lift/a.weeklyGP)*100:null}/>} note={`${t('ofGP')} · ${t('perWeek')}`}/>
      <Kpi label={t('kUrgent')} value={String(a.recs.length)} delta={<span className="text-xs font-semibold tnum">{money(d,a.capital,lang)}</span>} note={t('capitalNeeded')}/>
    </section>

    {/* Task C: FEFO Batch Expiry & Markdown Shield on Dashboard */}
    <section className={panel}>
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-primary"/>
          <h2 className="font-semibold">{t('fefoShield')}</h2>
        </div>
        <span className="text-xs font-medium text-muted-foreground">{expiringBatches.length} {t('products')}</span>
      </header>
      {expiringBatches.length>0?(
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr><th className={th}>{t('item')}</th><th className={th}>{t('batchNumber')}</th><th className={th}>{t('warehouse')}</th><th className={`${th} text-end`}>{t('stock')}</th><th className={th}>{t('expiryDate')}</th><th className={th}>{t('fefoStatus')}</th><th className={th}>{t('actionMarkdown')}</th><th className={th}/></tr></thead>
          <tbody>{expiringBatches.map(({p,exp})=>{
            return <tr key={p.id} className="hover:bg-muted/40">
              <td className={`${td} font-medium`}>{p.name} <span className="ms-1 font-mono text-xs text-muted-foreground">{p.sku}</span></td>
              <td className={`${td} font-mono text-xs text-muted-foreground`}>{p.batch_number??t('na')}</td>
              <td className={`${td} text-xs`}>{p.wh}</td>
              <td className={`${td} text-end font-semibold`}>{p.stock}</td>
              <td className={`${td} text-xs text-muted-foreground`}>{p.expiry_date}</td>
              <td className={td}><Status tone={exp.tone}>{t(exp.labelKey)} {exp.daysLeft!==null&&exp.daysLeft>0?`(${exp.daysLeft}d)`:''}</Status></td>
              <td className={td}><span className="inline-block rounded bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">{t(exp.markdownActionKey)}</span></td>
              <td className={`${td} text-end`}><Link to="/app" search={{s:'inventory'}} className="text-xs font-medium text-primary hover:underline">{t('viewAll')} →</Link></td>
            </tr>;
          })}</tbody>
        </table></div>
      ):(
        <div className="flex items-center justify-between px-6 py-5 text-sm text-muted-foreground"><p>{t('noExpiring')}</p><Link to="/app" search={{s:'inventory'}} className="text-xs font-medium text-primary hover:underline">{t('goInventory')} →</Link></div>
      )}
    </section>

    <LiquidationPanel/>


    <div className="grid gap-8 xl:grid-cols-[1.6fr_1fr]">
      <section className={panel}>
        <header className="flex items-center justify-between gap-3 px-6 py-5"><h2 className="font-semibold">{t('insights')}</h2><span className="text-sm text-muted-foreground tnum">{a.insights.length}</span></header>
        {a.insights.length?<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className={th}>{t('priority')}</th><th className={th}>{t('signal')}</th><th className={th}>{t('item')}</th><th className={`${th} text-end`}>{t('metric')}</th><th className={th}/></tr></thead>
          <tbody>{a.insights.map((x,i)=>{const [s,c]=sev(x.sev);return <tr key={i} className="hover:bg-muted/40">
            <td className={td}><span className="inline-flex items-center gap-2 text-xs font-medium"><span className={`h-2 w-2 rounded-full ${c}`}/>{s}</span></td>
            <td className={td}>
              <div className="flex items-center gap-1.5">
                {x.kind==='erosion'&&<ShieldAlert size={14} className="text-destructive shrink-0"/>}
                <span>{label[x.kind]}</span>
              </div>
            </td>
            <td className={`${td} font-medium`}>{x.name}</td>
            <td className={`${td} text-end font-semibold`} dir="ltr">{x.metric}</td>
            <td className={`${td} text-end`}><Link to="/app" search={{s:target[x.kind]}} className="text-xs font-medium text-primary hover:underline">{t('viewAll')} →</Link></td></tr>;})}</tbody></table></div>
          :<div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-6"><p className="text-sm text-muted-foreground">{t('noInsights')}</p><Link to="/app" search={{s:'inventory'}} className="text-sm font-medium text-primary hover:underline">{t('goInventory')} →</Link></div>}
      </section>
      <section className={panel}>
        <header className="px-6 py-5"><h2 className="font-semibold">{t('recommended')}</h2></header>
        {a.recs.length?<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className={th}>{t('item')}</th><th className={`${th} text-end`}>{t('qty')}</th><th className={`${th} text-end`}>{t('cost')}</th></tr></thead>
          <tbody>{a.recs.map(({p,r})=><tr key={p.id} className="hover:bg-muted/40"><td className={td}>{p.name}</td><td className={`${td} text-end font-semibold`}>{r.qty}</td><td className={`${td} text-end`}>{money(d,r.qty*(p.repCost??p.cost),lang)}</td></tr>)}</tbody></table></div>
          :<div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-6"><p className="text-sm text-muted-foreground">{t('noAction')}</p><Link to="/app" search={{s:'inventory'}} className="text-sm font-medium text-primary hover:underline">{t('goInventory')} →</Link></div>}
      </section>
    </div>
    </>}
  </div>;
}

function TrendChart({pid}:{pid:number}){
  const {t}=useT(),{data:d}=useInventra();const p=d.P.find(x=>x.id===pid);
  const w=useMemo(()=>p?weekly(d,p):[],[d,p]);
  if(!p||!w.length)return <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-6"><p className="text-sm text-muted-foreground">{t('noForecast')}</p><Link to="/app" search={{s:'inventory'}} className="text-sm font-medium text-primary hover:underline">{t('goInventory')} →</Link></div>;
  const W=720,H=220,pad={l:44,r:52,t:14,b:28},iw=W-pad.l-pad.r,ih=H-pad.t-pad.b;
  const qMax=Math.max(1,...w.map(x=>x.qty)),ps=w.map(x=>x.price),pMin=Math.min(...ps)*0.95,pMax=Math.max(...ps)*1.05||1;
  const bw=iw/w.length,x=(i:number)=>pad.l+i*bw+bw/2,yP=(v:number)=>pad.t+ih-((v-pMin)/(pMax-pMin||1))*ih;
  const line=w.map((v,i)=>`${i?'L':'M'}${x(i)},${yP(v.price)}`).join(' ');
  return <div className="px-6 pb-6" dir="ltr">
    <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 bg-chart-3/50"/>{t('volume')}</span><span className="inline-flex items-center gap-2"><span className="h-0.5 w-4 bg-primary"/>{t('price')}</span></div>
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t('trendTitle')}>
      {[0,.5,1].map(f=><g key={f}><line x1={pad.l} x2={W-pad.r} y1={pad.t+ih*(1-f)} y2={pad.t+ih*(1-f)} className="stroke-border"/>
        <text x={pad.l-6} y={pad.t+ih*(1-f)+4} textAnchor="end" className="fill-muted-foreground text-2xs">{Math.round(qMax*f)}</text>
        <text x={W-pad.r+6} y={pad.t+ih*(1-f)+4} className="fill-muted-foreground text-2xs">{(pMin+(pMax-pMin)*f).toFixed(2)}</text></g>)}
      {w.map((v,i)=><rect key={i} x={pad.l+i*bw+bw*0.18} width={bw*0.64} y={pad.t+ih-(v.qty/qMax)*ih} height={(v.qty/qMax)*ih} className="fill-chart-3/50"/>)}
      <path d={line} fill="none" strokeWidth={2} className="stroke-primary"/>
      {w.map((v,i)=><circle key={i} cx={x(i)} cy={yP(v.price)} r={3} className="fill-card stroke-primary" strokeWidth={2}/>)}
      {w.map((v,i)=>i%2===0&&<text key={i} x={x(i)} y={H-8} textAnchor="middle" className="fill-muted-foreground text-2xs">{v.start.slice(5).replace('-', '/')}</text>)}
    </svg></div>;
}

export function PriceIntelligence(){
  const {t,lang}=useT(),{data:d,commit,role,busy}=useInventra();
  const rows=useMemo(()=>d.P.map(p=>priceRow(d,p)),[d]);
  const [sel,setSel]=useState<number>(rows.find(r=>r.el)?.p.id??rows[0]?.p.id??0);
  const edit=role!=='supplier';

  const setComp=(pid:number,v:string)=>{
    const n=v===''?null:Number(v);if(n!==null&&(!isFinite(n)||n<0))return;
    void commit(x=>{const px=(x.px??={}) as {comp?:Record<string,number>};px.comp={...(px.comp??{})};if(n===null)delete px.comp[pid];else px.comp[pid]=n;});
  };

  const setRepCost=(pid:number,v:string)=>{
    const n=v===''?null:Number(v);if(n!==null&&(!isFinite(n)||n<0))return;
    void commit(x=>{
      const p=x.P.find(item=>item.id===pid);
      if(p){
        p.repCost=n===null?undefined:n;
      }
    });
  };

  const setCurrency=(curr:Currency)=>{
    void commit(x=>{
      x.settings.currency=curr;
    });
  };

  const suggested=rows.filter(r=>r.opt!==null&&r.opt!==r.p.price).length;
  const erodedCount=rows.filter(r=>r.isEroded).length;

  return <div className="space-y-8">
    <ScreenIntro q={t('qPricing')} a={fmt(suggested?t('aPricing'):t('aPricingNone'),{n:suggested})}>
      {/* Workspace currency selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">{t('currencySelect')}:</span>
        <select
          value={d.settings.currency||'EGP'}
          disabled={busy||!edit}
          onChange={e=>setCurrency(e.target.value as Currency)}
          className="rounded-md border border-input bg-background px-2.5 py-1 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {SUPPORTED_CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </ScreenIntro>

    {erodedCount>0&&(
      <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <AlertTriangle size={18} className="mt-0.5 shrink-0"/>
        <div>
          <p className="font-semibold">{t('erosionAlert')}: {erodedCount} {t('products')}</p>
          <p className="mt-0.5 text-xs text-destructive/90">{t('erosionAlertHelp')}</p>
        </div>
      </div>
    )}

    {!d.P.length?<Empty line={t('emptyPricing')} action={t('goInventory')} to="inventory"/>:<>
    <section className={panel}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-6 py-5">
        <div>
          <h2 className="font-semibold">{t('pricing')}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t('inflationShield')}</p>
        </div>
        <p className="flex max-w-xl items-start gap-2 text-xs text-muted-foreground"><Info size={14} className="mt-0.5 shrink-0"/>{t('compHelp')}</p>
      </header>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead>
          <tr>
            {[
              t('sku'),
              t('name'),
              t('histCost'),
              t('repCost'),
              t('curPrice'),
              t('compPrice'),
              t('histMargin'),
              t('repMargin'),
              t('status'),
              t('elast'),
              t('optPrice'),
              t('lift')
            ].map((h,i)=><th key={h} className={`${th} border-y border-border ${i>=2&&i<=7||i>=10?'text-end':''}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody>{rows.map(r=>{
          const gap=r.comp?((r.p.price-r.comp)/r.comp)*100:null;
          return <tr key={r.p.id} onClick={()=>setSel(r.p.id)} className={`cursor-pointer transition-colors hover:bg-muted/40 ${sel===r.p.id?'bg-accent/40':''}`}>
            <td className={`${td} font-mono text-xs text-muted-foreground`}>{r.p.sku}</td>
            <td className={`${td} font-medium`}>{r.p.name}</td>
            <td className={`${td} text-end text-muted-foreground`}>{money(d,r.cost,lang)}</td>
            {/* Replacement Cost (editable) */}
            <td className={`${td} text-end`} onClick={e=>e.stopPropagation()}>
              {edit?(
                <input
                  key={`rep-${r.p.id}-${r.repCost}`}
                  type="number"
                  step="0.01"
                  min={0}
                  disabled={busy}
                  defaultValue={r.p.repCost??''}
                  placeholder={String(r.cost)}
                  onBlur={e=>{
                    if(e.target.value!==String(r.p.repCost??''))setRepCost(r.p.id,e.target.value);
                  }}
                  className="w-24 rounded border border-input bg-background px-2 py-1 text-end text-sm tnum font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              ):(
                <span className="font-medium text-foreground">{money(d,r.repCost,lang)}</span>
              )}
            </td>
            <td className={`${td} text-end font-semibold`}>{money(d,r.p.price,lang)}</td>
            <td className={`${td} text-end`} onClick={e=>e.stopPropagation()}>
              {edit?(
                <input
                  key={`comp-${r.p.id}-${r.comp}`}
                  type="number"
                  step="0.01"
                  min={0}
                  disabled={busy}
                  defaultValue={r.comp??''}
                  placeholder={t('notSet')}
                  onBlur={e=>{
                    if(e.target.value!==String(r.comp??''))setComp(r.p.id,e.target.value);
                  }}
                  className="w-24 rounded border border-input bg-background px-2 py-1 text-end text-sm tnum transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              ):r.comp!==null?money(d,r.comp,lang):<span className="text-muted-foreground">{t('notSet')}</span>}
              {gap!==null&&<div className={`text-xs tnum ${gap>5?'text-warning':gap<-5?'text-primary':'text-muted-foreground'}`} dir="ltr">{gap>0?'+':''}{gap.toFixed(1)}%</div>}
            </td>
            {/* Historical Margin */}
            <td className={`${td} text-end`}><span className={r.gm<0.2?'font-semibold text-destructive':r.gm<0.3?'font-semibold text-warning':''}>{pct(r.gm)}</span></td>
            {/* Replacement Margin */}
            <td className={`${td} text-end`}><span className={r.repGm<0?'font-semibold text-destructive':r.repGm<0.2?'font-semibold text-warning':''}>{pct(r.repGm)}</span></td>
            {/* Inflation Shield / Margin Erosion Status */}
            <td className={td}>
              {r.isEroded?(
                <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive" title={t('priceBelowCost')}>
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive"/>{t('erosionAlert')}
                </span>
              ):r.repGm<0.2?(
                <Status tone="low">{t('lowStock')}</Status>
              ):(
                <Status tone="ok">{t('inStock')}</Status>
              )}
            </td>
            <td className={`${td} text-end`}>{r.el?<span title={`${t('fit')} R² ${r.el.r2.toFixed(2)} · ${r.el.n} ${t('weeks')}`} dir="ltr">{r.el.e.toFixed(2)}<span className="ms-1 text-xs text-muted-foreground">R² {r.el.r2.toFixed(2)}</span></span>:<span className="text-xs text-muted-foreground">{t('notMeasurable')}</span>}</td>
            <td className={`${td} text-end font-semibold`}>{r.opt===null?<span className="text-xs font-normal text-muted-foreground">{t('na')}</span>:r.opt===r.p.price?<span className="text-xs font-normal text-muted-foreground">{t('hold')}</span>:<span className="text-primary">{money(d,r.opt,lang)}</span>}</td>
            <td className={`${td} text-end`}>{r.liftWeekly>0?<span className="font-semibold text-success" dir="ltr">+{money(d,r.liftWeekly,lang)}</span>:<span className="text-muted-foreground">{t('na')}</span>}</td>
          </tr>;
        })}</tbody></table></div>
      <p className="border-t border-border px-6 py-4 text-xs leading-relaxed text-muted-foreground">{t('elastHelp')}</p>
    </section>
    <section className={panel}>
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-5"><h2 className="font-semibold">{t('trendTitle')}</h2>
        <select aria-label={t('name')} value={sel} onChange={e=>setSel(Number(e.target.value))} className="min-w-0 max-w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">{d.P.map(p=><option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}</select></header>
      <TrendChart pid={sel}/>
    </section>
    </>}
  </div>;
}
