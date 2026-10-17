import {createFileRoute,Link,useNavigate} from '@tanstack/react-router';
import {useState,useMemo,useRef} from 'react';
import {toast} from 'sonner';
import {useServerFn} from '@tanstack/react-start';
import {SampleTag,ScreenIntro,Status,Empty,th,td,tr,type Tone} from '@/components/inventra/ui';
import {Brand} from '@/components/inventra/brand';
import {useInventra} from '@/components/inventra/provider';
import {ExecutiveDashboard,PriceIntelligence} from '@/components/inventra/executive';
import {useT,LangToggle,fmt} from '@/lib/inventra/i18n';
import {sections,type Section,type WorkspaceData,type Role,type Product} from '@/lib/inventra/types';
import {forecastFor,series,recommendation,status,money,download} from '@/lib/inventra/data';
import {askCopilot} from '@/lib/inventra/copilot.functions';
import {inviteMember} from '@/lib/inventra/workspace.functions';
import {supabase} from '@/integrations/supabase/client';
import C from '@/lib/inventra/core';

type Search={s?:Section|'copilot'|undefined};
export const Route=createFileRoute('/app')({
  validateSearch:(s:Record<string,unknown>):Search=>({s:[...sections,'copilot'].includes(s['s'] as string)?s['s'] as Search['s']:undefined}),
  head:()=>({meta:[{title:'Workspace | Inventra'},{name:'description',content:'Your Inventra inventory workspace: stock, forecasts, restocking and purchase orders.'},{property:'og:title',content:'Workspace | Inventra'},{property:'og:description',content:'Stock, forecasts, restocking and purchase orders.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
  component:AppPage,
});
const card='rounded-lg border border-border bg-card p-6';
const btn='rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50';
const btn2='rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50';
const inp='rounded-md border border-input bg-background px-3 py-2 text-sm';

function AppPage(){
  const {s='dashboard'}=Route.useSearch();const nav=useNavigate();
  const {t}=useT();const ctx=useInventra();const [open,setOpen]=useState(false);
  const items=[...sections.filter(x=>x!=='team'||(!ctx.demo&&ctx.role==='head')),'copilot'] as const;
  const Body={dashboard:ExecutiveDashboard,inventory:Inventory,restock:Restock,orders:Orders,forecast:Forecast,pricing:PriceIntelligence,notifications:Notifications,data:Backup,team:Team,copilot:Copilot}[s];
  return <div className="flex min-h-screen bg-background text-foreground">
    <aside className={`${open?'flex':'hidden'} fixed inset-y-0 start-0 z-30 w-60 flex-col border-e border-sidebar-border bg-sidebar p-4 text-sidebar-foreground md:sticky md:top-0 md:flex md:h-screen`}>
      <div className="mb-6 border-b border-sidebar-border pb-4 [&_.brand-link]:text-sidebar-accent-foreground"><Brand/></div>
      <nav className="flex-1 space-y-0.5">{items.map(k=><Link key={k} to="/app" search={{s:k}} onClick={()=>setOpen(false)} aria-current={s===k?'page':undefined} className={`block rounded-md border-s-2 px-3 py-2 text-sm ${s===k?'border-sidebar-primary bg-sidebar-accent font-semibold text-sidebar-primary':'border-transparent text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'}`}>{t(k as 'dashboard')}</Link>)}</nav>
      {ctx.session&&<button onClick={async()=>{await supabase.auth.signOut();void nav({to:'/'});}} className="px-3 py-2 text-start text-sm text-muted-foreground hover:text-sidebar-foreground">{t('signOut')}</button>}
    </aside>
    <main className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border bg-card px-6 py-3">
        <button className="text-sm md:hidden" onClick={()=>setOpen(!open)} aria-label="Menu">{t('menu')}</button>
        <h1 className="text-2xl">{t(s as 'dashboard')}</h1>
        <span className="text-sm text-muted-foreground">{ctx.demo?t('workspaceDemo'):ctx.name} · {t(ctx.role==='supplier'?'supplierRole':ctx.role)}</span>
        {ctx.demo&&<SampleTag/>}
        <div className="ms-auto flex items-center gap-2">
          {ctx.session?<button className={btn2} onClick={()=>ctx.setDemo(!ctx.demo)}>{ctx.demo?t('useReal'):t('useDemo')}</button>:<Link to="/auth" className={btn}>{t('signIn')}</Link>}
          <LangToggle/>
        </div>
      </header>
      <div className="mx-auto max-w-[1400px] p-6 md:p-8">
        {!ctx.demo&&ctx.loading?<p className="text-muted-foreground">…</p>:!ctx.demo&&ctx.workspaces.length===0?<Empty line={t('noWs')} action={t('createWs')} onClick={()=>void ctx.initialize()}/>:<Body/>}
      </div>
    </main>
  </div>;
}

const canEdit=(r:Role)=>r!=='supplier';
const stockTone=(p:Product):Tone=>p.stock===0?'crit':p.stock<=p.min?'low':'ok';

function Inventory(){
  const {t}=useT(),{data:d,commit,role,busy}=useInventra();const [adding,setAdding]=useState(false);const [sale,setSale]=useState<number|null>(null);
  const label=(p:Product)=>({'Out of stock':t('outStock'),'Low stock':t('lowStock'),'In stock':t('inStock')}[status(p)]);
  const low=d.P.filter(p=>p.stock>0&&p.stock<=p.min).length,out=d.P.filter(p=>p.stock===0).length;
  function add(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const n=(k:string)=>Number(f.get(k))||0;
    void commit(x=>{const id=Math.max(0,...x.P.map(p=>p.id),...x.archived.map(p=>p.id))+1;x.P.push({id,name:String(f.get('name')),sku:String(f.get('sku')),cat:String(f.get('cat')||'General'),wh:'Main Warehouse',stock:n('stock'),min:n('min'),max:0,cost:n('cost'),price:n('price'),exp:999,lead:n('lead')||3,src:'manual'});}).then(ok=>ok&&setAdding(false));}
  function recSale(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const q=Number(new FormData(e.currentTarget).get('qty'));const pid=sale!;
    void commit(x=>{const r=C.recordSale(x,{pid,date:C.todayISO(),qty:q,who:'app'});if(r&&r.ok===false)throw new Error(r.error||'Invalid sale');}).then(ok=>ok&&setSale(null));}
  return <div className="space-y-8">
    <ScreenIntro q={t('qInv')} a={fmt(t('aInv'),{n:d.P.length,l:low,o:out})}>
      {canEdit(role)?<button className={btn} onClick={()=>setAdding(!adding)}>{t('addProduct')}</button>:<p className="text-sm text-muted-foreground">{t('readOnly')}</p>}
    </ScreenIntro>
    {adding&&<form onSubmit={add} className={`${card} grid gap-2 sm:grid-cols-4`}>
      <input required name="name" placeholder={t('name')} className={inp}/><input required name="sku" placeholder={t('sku')} className={inp}/><input name="cat" placeholder={t('category')} className={inp}/>
      <input required name="stock" type="number" min={0} placeholder={t('stock')} className={inp}/><input name="min" type="number" min={0} placeholder={t('min')} className={inp}/>
      <input name="cost" type="number" step="0.01" min={0} placeholder={t('cost')} className={inp}/><input name="price" type="number" step="0.01" min={0} placeholder={t('price')} className={inp}/>
      <div className="flex gap-2"><button disabled={busy} className={btn}>{t('save')}</button><button type="button" className={btn2} onClick={()=>setAdding(false)}>{t('cancel')}</button></div>
    </form>}
    {!d.P.length?<Empty line={t('emptyInv')} action={t('addProduct')} onClick={canEdit(role)?()=>setAdding(true):undefined}/>:
    <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full text-sm"><thead><tr>{['name','sku','category','stock','min','price','status','actions'].map((k,i)=><th key={k} className={`${th} ${i>=3&&i<=5?'text-end':''}`}>{t(k as 'name')}</th>)}</tr></thead>
      <tbody>{d.P.map(p=><tr key={p.id} className={tr}><td className={`${td} font-medium`}>{p.name}</td><td className={`${td} text-muted-foreground`}>{p.sku}</td><td className={td}>{p.cat}</td><td className={`${td} text-end font-semibold`}>{p.stock}</td><td className={`${td} text-end`}>{p.min}</td><td className={`${td} text-end`}>{money(d,p.price)}</td><td className={td}><Status tone={stockTone(p)}>{label(p)}</Status></td>
        <td className={td}>{canEdit(role)&&(sale===p.id?<form onSubmit={recSale} className="flex gap-1"><input name="qty" type="number" min={1} max={p.stock} required className={`${inp} w-20 py-1`}/><button disabled={busy} className={btn}>{t('save')}</button></form>:<button className={btn2} disabled={p.stock===0} onClick={()=>setSale(p.id)}>{t('recordSale')}</button>)}</td></tr>)}</tbody></table></div>}
  </div>;
}

function Restock(){
  const {t}=useT(),{data:d,commit,role,busy}=useInventra();
  const rows=d.P.map(p=>({p,r:recommendation(d,p)}));const due=rows.filter(x=>x.r.action==='order');const cost=due.reduce((a,x)=>a+x.r.qty*x.p.cost,0);
  return <div className="space-y-8">
    <ScreenIntro q={t('qRestock')} a={due.length?fmt(t('aRestock'),{n:due.length,c:money(d,cost)}):t('aRestockNone')}/>
    {!d.P.length?<Empty line={t('emptyRestock')} action={t('goInventory')} to="inventory"/>:
    <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full text-sm"><thead><tr><th className={th}>{t('item')}</th><th className={th}>{t('status')}</th><th className={`${th} text-end`}>{t('stock')}</th><th className={`${th} text-end`}>{t('qty')}</th><th className={th}>{t('signal')}</th><th className={th}/></tr></thead>
      <tbody>{[...due,...rows.filter(x=>x.r.action!=='order')].map(({p,r})=>{const head={order:t('recommended'),none:t('noAction'),review:t('review'),no_forecast:t('noForecast')}[r.action as string]??r.action;
        return <tr key={p.id} className={`${tr} align-top`}><td className={`${td} font-medium`}>{p.name}</td><td className={td}><Status tone={r.action==='order'?stockTone(p)==='crit'?'crit':'low':r.action==='none'?'ok':'idle'}>{head}</Status></td>
          <td className={`${td} text-end`}>{p.stock}</td><td className={`${td} text-end font-semibold`}>{r.action==='order'?r.qty:''}</td>
          <td className={`${td} max-w-md text-xs text-muted-foreground`} dir="ltr">{[...(r.reasons??[]),...(r.warnings??[])].map((x:string,i:number)=><p key={i}>{x}</p>)}</td>
          <td className={`${td} text-end`}>{r.action==='order'&&canEdit(role)&&<button className={btn} disabled={busy} onClick={()=>void commit(x=>{x.R.push({id:x.rid++,pid:p.id,qty:r.qty,got:0,status:'Pending Approval',t:C.todayISO()});x.N.unshift({id:x.nid++,text:`${p.name}: purchase request for ${r.qty} awaiting approval.`,read:false});}).then(ok=>ok&&toast.success('✓'))}>{t('createPO')}</button>}</td></tr>;})}</tbody></table></div>}
  </div>;
}

function Orders(){
  const {t}=useT(),{data:d,commit,role,busy}=useInventra();const name=(id:number)=>d.P.find(p=>p.id===id)?.name??t('na');
  const step=(id:number,to:string)=>void commit(x=>{const o=x.R.find(r=>r.id===id)!;o.status=to;if(to==='Received'){const p=x.P.find(p=>p.id===o.pid);if(p){p.stock+=o.qty-o.got;x.mv.push({pid:p.id,t:C.todayISO(),type:'receive',q:o.qty-o.got,who:'app'});}o.got=o.qty;}});
  const st:Record<string,[string,Tone]>={'Pending Approval':[t('stPending'),'low'],Confirmed:[t('stConfirmed'),'idle'],Received:[t('stReceived'),'ok'],Cancelled:[t('stCancelled'),'idle']};
  const pend=d.R.filter(o=>o.status==='Pending Approval').length,conf=d.R.filter(o=>o.status==='Confirmed').length;
  return <div className="space-y-8">
    <ScreenIntro q={t('qOrders')} a={fmt(t('aOrders'),{p:pend,c:conf})}/>
    {!d.R.length?<Empty line={t('emptyOrders')} action={t('goRestock')} to="restock"/>:
    <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full text-sm"><thead><tr>{['name','qty','supplier','date','status','actions'].map(k=><th key={k} className={`${th} ${k==='qty'?'text-end':''}`}>{t(k as 'name')}</th>)}</tr></thead>
    <tbody>{d.R.map(o=>{const [l,tone]=st[o.status]??[o.status,'idle' as Tone];return <tr key={o.id} className={tr}><td className={`${td} font-medium`}>{name(o.pid)}</td><td className={`${td} text-end`}>{o.qty}</td><td className={td}>{o.supplier??t('na')}</td><td className={`${td} text-muted-foreground`}>{o.t}</td><td className={td}><Status tone={tone}>{l}</Status></td>
      <td className={td}>{o.status==='Pending Approval'&&(role==='head'||role==='manager')&&<button disabled={busy} className={btn} onClick={()=>step(o.id,'Confirmed')}>{t('approve')}</button>}{o.status==='Confirmed'&&canEdit(role)&&<button disabled={busy} className={btn2} onClick={()=>step(o.id,'Received')}>{t('receive')}</button>}</td></tr>;})}</tbody></table></div>}
  </div>;
}

function ForecastChart({actual,fc,wape}:{actual:number[];fc:number[];wape:number|null}){
  const {t}=useT();const W=560,H=160,pl=28,pr=64,pt=10,pb=18,iw=W-pl-pr,ih=H-pt-pb;
  const lo=fc.map(v=>wape===null?v:Math.max(0,v*(1-wape))),hi=fc.map(v=>wape===null?v:v*(1+wape));
  const n=actual.length+fc.length,max=Math.max(1,...actual,...hi);const x=(i:number)=>pl+(i/(Math.max(1,n-1)))*iw,y=(v:number)=>pt+ih-(v/max)*ih;
  const path=(vs:number[],o:number)=>vs.map((v,i)=>`${i?'L':'M'}${x(i+o)},${y(v)}`).join(' ');
  const o=actual.length-1,fcl=[actual[actual.length-1]??fc[0]??0,...fc];
  const band=wape===null?'':`M${x(o)},${y(fcl[0]!)} `+hi.map((v,i)=>`L${x(i+o+1)},${y(v)}`).join(' ')+' '+[...lo].reverse().map((v,i)=>`L${x(o+fc.length-i)},${y(v)}`).join(' ')+' Z';
  return <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" direction="ltr" role="img" aria-label={t('forecast')}>
    {[0,.5,1].map(f=><g key={f}><line x1={pl} x2={W-pr} y1={pt+ih*(1-f)} y2={pt+ih*(1-f)} className="stroke-border" strokeWidth={0.5}/><text x={pl-4} y={pt+ih*(1-f)+3} textAnchor="end" className="fill-muted-foreground text-[9px] tnum">{Math.round(max*f)}</text></g>)}
    <line x1={x(o)} x2={x(o)} y1={pt} y2={pt+ih} className="stroke-border" strokeDasharray="2 3"/>
    {band&&<path d={band} className="fill-primary/10"/>}
    <path d={path(actual,0)} fill="none" className="stroke-foreground" strokeWidth={1.5}/>
    <path d={path(fcl,o)} fill="none" className="stroke-primary" strokeWidth={1.5} strokeDasharray="5 4"/>
    <text x={x(o)-4} y={y(actual[o]??0)-6} textAnchor="end" className="fill-foreground text-[10px]">{t('actual')}</text>
    <text x={x(n-1)+4} y={y(fc[fc.length-1]??0)+3} className="fill-primary text-[10px]">{t('fcLabel')}</text>
    {band&&<text x={x(n-1)+4} y={y(hi[hi.length-1]??0)-4} className="fill-muted-foreground text-[9px]">{t('band')}</text>}
  </svg>;
}

function Forecast(){
  const {t}=useT(),{data:d}=useInventra();
  const all=d.P.map(p=>({p,f:forecastFor(d,p)}));const ok=all.filter(x=>x.f.ok);const tot=Math.round(ok.reduce((a,x)=>a+x.f.daily.slice(0,14).reduce((s:number,v:number)=>s+v,0),0));
  return <div className="space-y-8">
    <ScreenIntro q={t('qForecast')} a={ok.length?fmt(t('aForecast'),{n:tot,k:ok.length}):t('aForecastNone')}/>
    {!d.P.length?<Empty line={t('emptyForecast')} action={t('goInventory')} to="inventory"/>:
    <div className="grid gap-6 lg:grid-cols-2">{all.map(({p,f})=>{const next=f.ok?f.daily.slice(0,14):[];const act=series(d,p).slice(-28);
      return <div key={p.id} className={card}><div className="flex items-baseline justify-between gap-3"><h3 className="font-semibold">{p.name}</h3>{f.ok&&<p className="text-sm tnum">{t('next14')}: <b>{Math.round(next.reduce((a:number,b:number)=>a+b,0))}</b></p>}</div>
        {!f.ok?<p className="mt-2 text-sm text-muted-foreground" dir="ltr">{f.reason}</p>:<>
        <p className="mt-1 text-xs text-muted-foreground">{t('method')}: <span dir="ltr">{f.method}</span> · {f.accuracy?`${t('accuracy')}: ${Math.round(f.accuracy.wapeDaily*100)}%`:t('notMeasured')}</p>
        <ForecastChart actual={act} fc={next} wape={f.accuracy?f.accuracy.wapeDaily:null}/>
        {f.warnings.map((w:string,i:number)=><p key={i} className="mt-2 text-xs text-muted-foreground" dir="ltr">{w}</p>)}</>}</div>;})}</div>}
  </div>;
}

function Notifications(){
  const {t}=useT(),{data:d,commit,busy}=useInventra();const unread=d.N.filter(n=>!n.read).length;
  return <div className="space-y-8">
    <ScreenIntro q={t('qNotif')} a={unread?fmt(t('aNotif'),{n:unread}):t('aNotifNone')}>{d.N.length>0&&<button className={btn2} disabled={busy} onClick={()=>void commit(x=>x.N.forEach(n=>{n.read=true;}))}>{t('markRead')}</button>}</ScreenIntro>
    {!d.N.length?<Empty line={t('noNotifications')} action={t('goDashboard')} to="dashboard"/>:
    <ul className="rounded-lg border border-border bg-card">{d.N.map(n=><li key={n.id} className={`${tr} px-4 py-3 text-sm ${n.read?'text-muted-foreground':''}`}><Status tone={n.read?'idle':/out of stock/i.test(n.text)?'crit':'low'}>{n.text}</Status></li>)}</ul>}
  </div>;
}

function Backup(){
  const {t}=useT(),{data:d,commit,role}=useInventra();const ref=useRef<HTMLInputElement>(null);
  async function restore(file:File){try{const obj=JSON.parse(await file.text());const v=C.validateBackup(obj);if(v&&v.ok===false)throw new Error(v.error||v.errors?.join(' ')||'Invalid backup');if(!confirm(t('restoreConfirm')))return;const clean=C.restoreData(obj.data??obj) as WorkspaceData;await commit(x=>{Object.assign(x,clean);},true);}catch(e){toast.error(e instanceof Error?e.message:'Invalid backup');}}
  return <div className={`${card} flex flex-wrap gap-3`}>
    <button className={btn} onClick={()=>download(`inventra-backup-${C.todayISO()}.json`,JSON.stringify(C.buildBackup(d),null,2))}>{t('exportBackup')}</button>
    {role==='head'&&<><button className={btn2} onClick={()=>ref.current?.click()}>{t('restoreBackup')}</button><input ref={ref} type="file" accept="application/json" hidden onChange={e=>{const f=e.target.files?.[0];if(f)void restore(f);e.target.value='';}}/></>}
  </div>;
}

function Team(){
  const {t}=useT(),{workspaceId}=useInventra();const invite=useServerFn(inviteMember);const [link,setLink]=useState('');
  async function go(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);try{const token=await invite({data:{id:workspaceId!,email:String(f.get('email')),role:f.get('role') as Role}});setLink(`${window.location.origin}/invite/${token}`);}catch(err){toast.error(err instanceof Error?err.message:'Error');}}
  return <div className={card}><form onSubmit={go} className="flex flex-wrap gap-2"><input name="email" type="email" required placeholder={t('email')} className={inp}/>
    <select name="role" className={inp}>{(['manager','warehouse','supplier'] as const).map(r=><option key={r} value={r}>{t(r==='supplier'?'supplierRole':r)}</option>)}</select><button className={btn}>{t('invite')}</button></form>
    {link&&<div className="mt-4 text-sm"><p>{t('inviteLink')}</p><code className="mt-1 block break-all rounded bg-muted p-2" dir="ltr">{link}</code></div>}</div>;
}

function Copilot(){
  const {t,lang}=useT(),{data:d}=useInventra();const ask=useServerFn(askCopilot);
  const [msgs,setMsgs]=useState<{q:string;a:string}[]>([]),[q,setQ]=useState(''),[busy,setBusy]=useState(false);
  const summary=useMemo(()=>JSON.stringify({currency:d.settings.currency,products:d.P.map(p=>{const f=forecastFor(d,p);const r=recommendation(d,p);
    return {name:p.name,sku:p.sku,stock:p.stock,min:p.min,cost:p.cost,price:p.price,lead:p.lead,forecast14:f.ok?Math.round(f.daily.slice(0,14).reduce((a:number,b:number)=>a+b,0)):null,forecastNote:f.ok?null:f.reason,dailyWape:f.ok&&f.accuracy?f.accuracy.wapeDaily:null,recommendation:r.action,orderQty:r.qty};}),
    openOrders:d.R.filter(r=>!['Received','Cancelled'].includes(r.status)).map(r=>({pid:r.pid,qty:r.qty,status:r.status}))}),[d]);
  async function send(text:string){if(!text.trim()||busy)return;setBusy(true);setQ('');try{const a=await ask({data:{question:text,lang,summary}});setMsgs(m=>[...m,{q:text,a}]);}catch(e){toast.error(e instanceof Error?e.message:'Error');}finally{setBusy(false);}}
  return <div className="mx-auto max-w-3xl space-y-4">
    <div className="flex flex-wrap gap-2">{(['q1','q2','q3'] as const).map(k=><button key={k} className={btn2} disabled={busy} onClick={()=>void send(t(k))}>{t(k)}</button>)}</div>
    {msgs.map((m,i)=><div key={i} className="space-y-2"><p className="ms-auto w-fit max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">{m.q}</p><div className={`${card} whitespace-pre-wrap text-sm`}>{m.a}</div></div>)}
    {busy&&<p className="text-sm text-muted-foreground">{t('thinking')}</p>}
    <form onSubmit={e=>{e.preventDefault();void send(q);}} className="flex gap-2"><input value={q} onChange={e=>setQ(e.target.value)} placeholder={t('askPlaceholder')} className={`${inp} flex-1`} maxLength={1000}/><button disabled={busy} className={btn}>{t('ask')}</button></form>
  </div>;
}
