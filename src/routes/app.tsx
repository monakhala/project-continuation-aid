import {createFileRoute,Link,useNavigate} from '@tanstack/react-router';
import {useState,useMemo,useRef} from 'react';
import {toast} from 'sonner';
import {useServerFn} from '@tanstack/react-start';
import {LayoutDashboard,Boxes,PackagePlus,ClipboardList,LineChart,Bell,Database,Users,Sparkles,LogOut,Menu,Tags} from 'lucide-react';
import {Brand} from '@/components/inventra/brand';
import {useInventra} from '@/components/inventra/provider';
import {ExecutiveDashboard,PriceIntelligence} from '@/components/inventra/executive';
import {useT,LangToggle} from '@/lib/inventra/i18n';
import {sections,type Section,type WorkspaceData,type Role} from '@/lib/inventra/types';
import {forecastFor,recommendation,status,money,download} from '@/lib/inventra/data';
import {askCopilot} from '@/lib/inventra/copilot.functions';
import {inviteMember} from '@/lib/inventra/workspace.functions';
import {supabase} from '@/integrations/supabase/client';
import C from '@/lib/inventra/core';

type Search={s?:Section|'copilot'|undefined};
export const Route=createFileRoute('/app')({
  validateSearch:(s:Record<string,unknown>):Search=>({s:[...sections,'copilot'].includes(s['s'] as string)?s['s'] as Search['s']:undefined}),
  head:()=>({meta:[{title:'Workspace — Inventra'},{name:'description',content:'Your Inventra inventory workspace: stock, forecasts, restocking and purchase orders.'},{property:'og:title',content:'Workspace — Inventra'},{property:'og:description',content:'Stock, forecasts, restocking and purchase orders.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
  component:AppPage,
});
const icons={dashboard:LayoutDashboard,inventory:Boxes,restock:PackagePlus,orders:ClipboardList,forecast:LineChart,pricing:Tags,notifications:Bell,data:Database,team:Users,copilot:Sparkles};
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
      <nav className="flex-1 space-y-1">{items.map(k=>{const I=icons[k as keyof typeof icons];return <Link key={k} to="/app" search={{s:k}} onClick={()=>setOpen(false)} className={`flex items-center gap-3 rounded-md border-s-2 px-3 py-2 text-sm ${s===k?'border-sidebar-primary bg-sidebar-accent text-sidebar-accent-foreground':'border-transparent hover:bg-sidebar-accent/60'}`}><I size={17}/>{t(k as 'dashboard')}</Link>;})}</nav>
      {ctx.session&&<button onClick={async()=>{await supabase.auth.signOut();void nav({to:'/'});}} className="flex items-center gap-2 px-3 py-2 text-sm opacity-80 hover:opacity-100"><LogOut size={16}/>{t('signOut')}</button>}
    </aside>
    <main className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border bg-card px-5 py-3">
        <button className="md:hidden" onClick={()=>setOpen(!open)} aria-label="Menu"><Menu/></button>
        <h1 className="text-lg font-semibold">{t(s as 'dashboard')}</h1>
        <span className="text-sm text-muted-foreground">· {ctx.demo?t('workspaceDemo'):ctx.name} · {t(ctx.role==='supplier'?'supplierRole':ctx.role)}</span>
        <div className="ms-auto flex items-center gap-2">
          {ctx.session?<button className={btn2} onClick={()=>ctx.setDemo(!ctx.demo)}>{ctx.demo?t('useReal'):t('useDemo')}</button>:<Link to="/auth" className={btn}>{t('signIn')}</Link>}
          <LangToggle/>
        </div>
      </header>
      {ctx.demo&&<div className="border-b border-warning/40 bg-warning/10 px-5 py-1.5 text-xs font-medium text-foreground">{t('demoBadge')}</div>}
      <div className="p-5">
        {!ctx.demo&&ctx.loading?<p className="text-muted-foreground">…</p>:!ctx.demo&&ctx.workspaces.length===0?<div className={card}><p>{t('noWs')}</p><button className={`${btn} mt-3`} disabled={ctx.busy} onClick={()=>void ctx.initialize()}>{t('createWs')}</button></div>:<Body/>}
      </div>
    </main>
  </div>;
}

const canEdit=(r:Role)=>r!=='supplier';
function Stat({label,value,tone=''}:{label:string;value:string|number;tone?:string}){return <div className={card}><p className="text-sm text-muted-foreground">{label}</p><p className={`mt-2 kpi-num ${tone}`}>{value}</p></div>;}


function Inventory(){
  const {t}=useT(),{data:d,commit,role,busy}=useInventra();const [adding,setAdding]=useState(false);const [sale,setSale]=useState<number|null>(null);
  const tone=(p:typeof d.P[number])=>p.stock===0?'text-destructive':p.stock<=p.min?'text-warning':'text-success';
  const label=(p:typeof d.P[number])=>({'Out of stock':t('outStock'),'Low stock':t('lowStock'),'In stock':t('inStock')}[status(p)]);
  function add(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const n=(k:string)=>Number(f.get(k))||0;
    void commit(x=>{const id=Math.max(0,...x.P.map(p=>p.id),...x.archived.map(p=>p.id))+1;x.P.push({id,name:String(f.get('name')),sku:String(f.get('sku')),cat:String(f.get('cat')||'General'),wh:'Main Warehouse',stock:n('stock'),min:n('min'),max:0,cost:n('cost'),price:n('price'),exp:999,lead:n('lead')||3,src:'manual'});}).then(ok=>ok&&setAdding(false));}
  function recSale(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const q=Number(new FormData(e.currentTarget).get('qty'));const pid=sale!;
    void commit(x=>{const r=C.recordSale(x,{pid,date:C.todayISO(),qty:q,who:'app'});if(r&&r.ok===false)throw new Error(r.error||'Invalid sale');}).then(ok=>ok&&setSale(null));}
  return <div className="space-y-4">
    {canEdit(role)?<button className={btn} onClick={()=>setAdding(!adding)}>{t('addProduct')}</button>:<p className="text-sm text-muted-foreground">{t('readOnly')}</p>}
    {adding&&<form onSubmit={add} className={`${card} grid gap-2 sm:grid-cols-4`}>
      <input required name="name" placeholder={t('name')} className={inp}/><input required name="sku" placeholder={t('sku')} className={inp}/><input name="cat" placeholder={t('category')} className={inp}/>
      <input required name="stock" type="number" min={0} placeholder={t('stock')} className={inp}/><input name="min" type="number" min={0} placeholder={t('min')} className={inp}/>
      <input name="cost" type="number" step="0.01" min={0} placeholder={t('cost')} className={inp}/><input name="price" type="number" step="0.01" min={0} placeholder={t('price')} className={inp}/>
      <div className="flex gap-2"><button disabled={busy} className={btn}>{t('save')}</button><button type="button" className={btn2} onClick={()=>setAdding(false)}>{t('cancel')}</button></div>
    </form>}
    <div className={`${card} overflow-x-auto p-0`}><table className="w-full text-sm"><thead className="bg-muted text-start"><tr>{['name','sku','category','stock','min','price','status','actions'].map(k=><th key={k} className="px-4 py-2 text-start font-medium">{t(k as 'name')}</th>)}</tr></thead>
      <tbody>{d.P.map(p=><tr key={p.id} className="border-t border-border"><td className="px-4 py-2">{p.name}</td><td className="px-4 py-2 text-muted-foreground">{p.sku}</td><td className="px-4 py-2">{p.cat}</td><td className="px-4 py-2 font-semibold">{p.stock}</td><td className="px-4 py-2">{p.min}</td><td className="px-4 py-2">{money(d,p.price)}</td><td className={`px-4 py-2 font-medium ${tone(p)}`}>{label(p)}</td>
        <td className="px-4 py-2">{canEdit(role)&&(sale===p.id?<form onSubmit={recSale} className="flex gap-1"><input name="qty" type="number" min={1} max={p.stock} required className={`${inp} w-20 py-1`}/><button disabled={busy} className={btn}>{t('save')}</button></form>:<button className={btn2} disabled={p.stock===0} onClick={()=>setSale(p.id)}>{t('recordSale')}</button>)}</td></tr>)}</tbody></table></div>
  </div>;
}

function Restock(){
  const {t}=useT(),{data:d,commit,role,busy}=useInventra();
  return <div className="grid gap-4 lg:grid-cols-2">{d.P.map(p=>{const r=recommendation(d,p);const head={order:t('recommended'),none:t('noAction'),review:t('review'),no_forecast:t('noForecast')}[r.action as string]??r.action;
    return <div key={p.id} className={card}><div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold">{p.name}</h3><p className="text-sm text-muted-foreground">{head}{r.action==='order'&&<> · <b className="text-foreground">{r.qty}</b></>}</p></div>
      {r.action==='order'&&canEdit(role)&&<button className={btn} disabled={busy} onClick={()=>void commit(x=>{x.R.push({id:x.rid++,pid:p.id,qty:r.qty,got:0,status:'Pending Approval',t:C.todayISO()});x.N.unshift({id:x.nid++,text:`${p.name}: purchase request for ${r.qty} awaiting approval.`,read:false});}).then(ok=>ok&&toast.success('✓'))}>{t('createPO')}</button>}</div>
      <ul className="mt-3 list-disc space-y-1 ps-5 text-sm" dir="ltr">{[...(r.reasons??[]),...(r.warnings??[])].map((x:string,i:number)=><li key={i}>{x}</li>)}</ul></div>;})}</div>;
}

function Orders(){
  const {t}=useT(),{data:d,commit,role,busy}=useInventra();const name=(id:number)=>d.P.find(p=>p.id===id)?.name??'—';
  const step=(id:number,to:string)=>void commit(x=>{const o=x.R.find(r=>r.id===id)!;o.status=to;if(to==='Received'){const p=x.P.find(p=>p.id===o.pid);if(p){p.stock+=o.qty-o.got;x.mv.push({pid:p.id,t:C.todayISO(),type:'receive',q:o.qty-o.got,who:'app'});}o.got=o.qty;}});
  return <div className={`${card} overflow-x-auto p-0`}><table className="w-full text-sm"><thead className="bg-muted"><tr>{['name','qty','supplier','date','status','actions'].map(k=><th key={k} className="px-4 py-2 text-start font-medium">{t(k as 'name')}</th>)}</tr></thead>
    <tbody>{d.R.map(o=><tr key={o.id} className="border-t border-border"><td className="px-4 py-2">{name(o.pid)}</td><td className="px-4 py-2">{o.qty}</td><td className="px-4 py-2">{o.supplier??'—'}</td><td className="px-4 py-2">{o.t}</td><td className="px-4 py-2" dir="ltr">{o.status}</td>
      <td className="px-4 py-2">{o.status==='Pending Approval'&&(role==='head'||role==='manager')&&<button disabled={busy} className={btn} onClick={()=>step(o.id,'Confirmed')}>{t('approve')}</button>}{o.status==='Confirmed'&&canEdit(role)&&<button disabled={busy} className={btn2} onClick={()=>step(o.id,'Received')}>{t('receive')}</button>}</td></tr>)}</tbody></table></div>;
}

function Forecast(){
  const {t}=useT(),{data:d}=useInventra();
  return <div className="grid gap-4 lg:grid-cols-2">{d.P.map(p=>{const f=forecastFor(d,p);const next=f.ok?f.daily.slice(0,14):[];const max=Math.max(1,...next);
    return <div key={p.id} className={card}><h3 className="font-semibold">{p.name}</h3>{!f.ok?<p className="mt-2 text-sm text-muted-foreground" dir="ltr">{f.reason}</p>:<>
      <p className="mt-1 text-sm text-muted-foreground">{t('method')}: <span dir="ltr">{f.method}</span> · {f.accuracy?`${t('accuracy')}: ${Math.round(f.accuracy.wapeDaily*100)}%`:t('notMeasured')}</p>
      <p className="mt-1 text-sm">{t('next14')}: <b>{Math.round(next.reduce((a:number,b:number)=>a+b,0))}</b></p>
      <div className="mt-3 flex h-16 items-end gap-1" dir="ltr">{next.map((v:number,i:number)=><div key={i} className="flex-1 rounded-sm bg-primary/70" style={{height:`${(v/max)*100}%`}}/>)}</div>
      {f.warnings.map((w:string,i:number)=><p key={i} className="mt-2 text-xs text-muted-foreground" dir="ltr">{w}</p>)}</>}</div>;})}</div>;
}

function Notifications(){
  const {t}=useT(),{data:d,commit,busy}=useInventra();
  return <div className={card}>{d.N.length?<><ul className="divide-y divide-border">{d.N.map(n=><li key={n.id} className={`py-2 text-sm ${n.read?'text-muted-foreground':'font-medium'}`}>{n.text}</li>)}</ul><button className={`${btn2} mt-3`} disabled={busy} onClick={()=>void commit(x=>x.N.forEach(n=>{n.read=true;}))}>{t('markRead')}</button></>:<p className="text-sm text-muted-foreground">{t('noNotifications')}</p>}</div>;
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
