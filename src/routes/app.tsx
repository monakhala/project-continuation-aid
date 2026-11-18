import {createFileRoute,Link,useNavigate} from '@tanstack/react-router';
import {useState,useMemo,useRef} from 'react';
import {toast} from 'sonner';
import {useServerFn} from '@tanstack/react-start';
import {ArrowRightLeft,Clock,Layers,CheckCircle2,AlertCircle} from 'lucide-react';
import {SampleTag,ScreenIntro,Status,Empty,th,td,tr,type Tone} from '@/components/inventra/ui';
import {useInventra} from '@/components/inventra/provider';
import {ExecutiveDashboard,PriceIntelligence} from '@/components/inventra/executive';
import {useT,LangToggle,fmt} from '@/lib/inventra/i18n';
import {sections,type Section,type WorkspaceData,type Role,type Product,type Currency} from '@/lib/inventra/types';
import {forecastFor,series,recommendation,status,money,download,getExpiryInfo,SUPPORTED_CURRENCIES,DEFAULT_WAREHOUSES} from '@/lib/inventra/data';
import {weekly} from '@/lib/inventra/pricing';
import {askCopilot} from '@/lib/inventra/copilot.functions';
import {inviteMember} from '@/lib/inventra/workspace.functions';
import {supabase} from '@/integrations/supabase/client';
import C from '@/lib/inventra/core';
import {payableRows,runway,supplierCreditRows,creditCheck,orderTotal,findPaymentReminders,generateSupplierMessage} from '@/lib/inventra/credit';
import {findRebalanceOpportunities,findTransferTriggers,batchCreateTransfers,totalCapitalSaved,dispatchTransfer,receiveTransfer} from '@/lib/inventra/transfers';
import {courierSummary,shipmentsByCourier,parseCourierCsv,applyCourierStatement,generateSampleCourierCsv,type StatementResult} from '@/lib/inventra/courier';
import {initScanSession,recordScan,type ScanVerificationItem} from '@/lib/inventra/scanner';

type Search={s?:Section|'copilot'|undefined};
export const Route=createFileRoute('/app')({
  validateSearch:(s:Record<string,unknown>):Search=>({s:[...sections,'copilot'].includes(s['s'] as string)?s['s'] as Search['s']:undefined}),
  head:()=>({meta:[{title:'Workspace | Inventra'},{name:'description',content:'Your Inventra inventory workspace: stock, forecasts, restocking and purchase orders.'},{property:'og:title',content:'Workspace | Inventra'},{property:'og:description',content:'Stock, forecasts, restocking and purchase orders.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
  component:AppPage,
});
const card='rounded-xl border border-border bg-card p-6';
const btn='rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const btn2='rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const inp='rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

function AppPage(){
  const {s='dashboard'}=Route.useSearch();const nav=useNavigate();
  const {t}=useT();const ctx=useInventra();const [open,setOpen]=useState(false);
  const items=[...sections.filter(x=>x!=='team'||(!ctx.demo&&ctx.role==='head')),'copilot'] as const;
  const Body={dashboard:ExecutiveDashboard,inventory:Inventory,restock:Restock,orders:Orders,credit:SupplierCredit,transfers:TransfersScreen,courier:CourierReconciliationScreen,forecast:Forecast,pricing:PriceIntelligence,notifications:Notifications,data:Backup,team:Team,copilot:Copilot}[s];

  const setCurrency=(curr:Currency)=>{
    void ctx.commit(x=>{
      x.settings.currency=curr;
    });
  };

  return <div className="flex min-h-screen bg-background text-foreground">
    <aside className={`${open?'flex':'hidden'} fixed inset-y-0 start-0 z-30 w-60 flex-col border-e border-sidebar-border glass-ink p-4 text-sidebar-foreground md:sticky md:top-0 md:flex md:h-screen`}>
      <div className="mb-6 border-b border-sidebar-border pb-5"><Link to="/" aria-label="Inventra"><img src="/logo.png" alt="Inventra" width={536} height={482} className="mx-auto block h-24 w-auto rounded-xl"/></Link></div>
      <nav className="flex-1 space-y-0.5">{items.map(k=><Link key={k} to="/app" search={{s:k}} onClick={()=>setOpen(false)} aria-current={s===k?'page':undefined} className={`block rounded-md px-3 py-2 text-sm transition-colors ${s===k?'bg-sidebar-accent font-semibold text-sidebar-accent-foreground':'text-ink-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}`}>{t(k as 'dashboard')}</Link>)}</nav>
      {ctx.session&&<button onClick={async()=>{await supabase.auth.signOut();void nav({to:'/'});}} className="px-3 py-2 text-start text-sm text-ink-muted transition-colors hover:text-sidebar-foreground">{t('signOut')}</button>}
    </aside>
    <main className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border glass px-6 py-3">
        <button className="text-sm md:hidden" onClick={()=>setOpen(!open)} aria-label="Menu">{t('menu')}</button>
        <h1 className="text-3xl">{t(s as 'dashboard')}</h1>
        <span className="text-sm text-muted-foreground">{ctx.demo?t('workspaceDemo'):ctx.name} · {t(ctx.role==='supplier'?'supplierRole':ctx.role)}</span>
        {ctx.demo&&<SampleTag/>}
        <div className="ms-auto flex items-center gap-2">
          {/* Workspace currency switcher */}
          <select
            value={ctx.data.settings?.currency||'EGP'}
            disabled={ctx.busy||(!ctx.demo&&ctx.role==='supplier')}
            onChange={e=>setCurrency(e.target.value as Currency)}
            className="rounded-md border border-input bg-background px-2.5 py-1 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label={t('currencySelect')}
          >
            {SUPPORTED_CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
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
  const {t,lang}=useT(),{data:d,commit,role,busy}=useInventra();
  const [adding,setAdding]=useState(false);
  const [sale,setSale]=useState<number|null>(null);
  const [whFilter,setWhFilter]=useState<string>('all');
  const [transfer,setTransfer]=useState<{pid:number;fromWh:string;toWh:string;qty:number}|null>(null);

  const label=(p:Product)=>({'Out of stock':t('outStock'),'Low stock':t('lowStock'),'In stock':t('inStock')}[status(p)]);
  const low=d.P.filter(p=>p.stock>0&&p.stock<=p.min).length,out=d.P.filter(p=>p.stock===0).length;

  const hubs=useMemo(()=>{
    const set=new Set<string>([...DEFAULT_WAREHOUSES]);
    d.P.forEach(p=>{
      if(p.wh)set.add(p.wh);
      if(p.locations)Object.keys(p.locations).forEach(k=>set.add(k));
    });
    return Array.from(set);
  },[d.P]);

  const filteredP=useMemo(()=>{
    if(whFilter==='all')return d.P;
    return d.P.filter(p=>p.wh===whFilter||(p.locations&&((p.locations[whFilter]??0)>0)));
  },[d.P,whFilter]);

  function add(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    const n=(k:string)=>Number(f.get(k))||0;
    const stockVal=n('stock');
    const whVal=String(f.get('wh')||'Main Warehouse - 10th of Ramadan');
    const batchVal=String(f.get('batch_number')||'').trim();
    const expVal=String(f.get('expiry_date')||'').trim();
    const repVal=n('repCost')||n('cost');

    void commit(x=>{
      const id=Math.max(0,...x.P.map(p=>p.id),...x.archived.map(p=>p.id))+1;
      x.P.push({
        id,
        name:String(f.get('name')),
        sku:String(f.get('sku')),
        cat:String(f.get('cat')||'General'),
        wh:whVal,
        stock:stockVal,
        min:n('min'),
        max:0,
        cost:n('cost'),
        repCost:repVal,
        price:n('price'),
        batch_number:batchVal||undefined,
        expiry_date:expVal||undefined,
        locations:{[whVal]:stockVal},
        exp:999,
        lead:n('lead')||3,
        src:'manual'
      });
    }).then(ok=>ok&&setAdding(false));
  }

  function recSale(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    const q=Number(new FormData(e.currentTarget).get('qty'));
    const pid=sale!;
    void commit(x=>{
      const r=C.recordSale(x,{pid,date:C.todayISO(),qty:q,who:'app'});
      if(r&&r.ok===false)throw new Error(r.error||'Invalid sale');
      // Sync locations if present
      const p=x.P.find(item=>item.id===pid);
      if(p&&p.locations&&p.locations[p.wh]!=null){
        p.locations[p.wh]=Math.max(0,(p.locations[p.wh]??0)-q);
      }
    }).then(ok=>ok&&setSale(null));
  }

  function executeTransfer(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!transfer||transfer.qty<=0)return;
    const {pid,fromWh,toWh,qty}=transfer;
    if(fromWh===toWh){
      toast.error(t('transferError'));
      return;
    }
    void commit(x=>{
      const p=x.P.find(item=>item.id===pid);
      if(!p)throw new Error('Product not found');
      p.locations=p.locations||{[p.wh]:p.stock};
      const sourceQty=p.locations[fromWh]??(p.wh===fromWh?p.stock:0);
      if(sourceQty<qty){
        throw new Error(t('transferError'));
      }
      p.locations[fromWh]=sourceQty-qty;
      p.locations[toWh]=(p.locations[toWh]??0)+qty;
      // Record internal movement
      x.mv.unshift({
        pid:p.id,
        t:C.todayISO(),
        type:'Transfer',
        q:qty,
        who:'app',
        fromWh,
        toWh,
        note:`Transfer from ${fromWh} to ${toWh}`
      });
      x.N.unshift({
        id:x.nid++,
        text:`${p.name}: Inter-warehouse transfer of ${qty} units from ${fromWh} to ${toWh}.`,
        read:false
      });
    }).then(ok=>{
      if(ok){
        toast.success(t('transferSuccess'));
        setTransfer(null);
      }
    });
  }

  return <div className="space-y-8">
    <ScreenIntro q={t('qInv')} a={fmt(t('aInv'),{n:d.P.length,l:low,o:out})}>
      <div className="flex flex-wrap items-center gap-2">
        {canEdit(role)?<button className={btn} onClick={()=>setAdding(!adding)}>{t('addProduct')}</button>:<p className="text-sm text-muted-foreground">{t('readOnly')}</p>}
      </div>
    </ScreenIntro>

    {/* Task D: Multi-location Warehouse Hub Selector */}
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">{t('hub')}:</span>
        <button
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${whFilter==='all'?'bg-primary text-primary-foreground':'border border-border hover:bg-accent'}`}
          onClick={()=>setWhFilter('all')}
        >
          {t('allHubs')} ({d.P.length})
        </button>
        {hubs.map(h=>(
          <button
            key={h}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${whFilter===h?'bg-primary text-primary-foreground':'border border-border hover:bg-accent'}`}
            onClick={()=>setWhFilter(h)}
          >
            {h}
          </button>
        ))}
      </div>
    </div>

    {/* Inter-warehouse Transfer Modal */}
    {transfer&&(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/25 p-4 backdrop-blur-sm">
        <div className="glass-strong float w-full max-w-md rounded-2xl border border-border p-6">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="font-semibold">{t('transferTitle')}</h3>
            <button className="text-muted-foreground hover:text-foreground" onClick={()=>setTransfer(null)}>✕</button>
          </div>
          {(()=>{
            const p=d.P.find(item=>item.id===transfer.pid);
            if(!p)return null;
            const sourceQty=p.locations?.[transfer.fromWh]??(p.wh===transfer.fromWh?p.stock:0);
            return <form onSubmit={executeTransfer} className="mt-4 space-y-4">
              <div>
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{p.sku}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t('fromWarehouse')}</label>
                <select
                  value={transfer.fromWh}
                  onChange={e=>setTransfer({...transfer,fromWh:e.target.value})}
                  className={`${inp} w-full`}
                >
                  {hubs.map(h=>{
                    const q=p.locations?.[h]??(p.wh===h?p.stock:0);
                    return <option key={h} value={h}>{h} ({q} {t('inStock')})</option>;
                  })}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t('toWarehouse')}</label>
                <select
                  value={transfer.toWh}
                  onChange={e=>setTransfer({...transfer,toWh:e.target.value})}
                  className={`${inp} w-full`}
                >
                  {hubs.filter(h=>h!==transfer.fromWh).map(h=><option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t('transferQty')} (Max {sourceQty})</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={sourceQty}
                  value={transfer.qty||''}
                  onChange={e=>setTransfer({...transfer,qty:Number(e.target.value)})}
                  className={`${inp} w-full`}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className={btn2} onClick={()=>setTransfer(null)}>{t('cancel')}</button>
                <button type="submit" disabled={busy||sourceQty<=0} className={btn}>{t('confirmTransfer')}</button>
              </div>
            </form>;
          })()}
        </div>
      </div>
    )}

    {adding&&<form onSubmit={add} className={`${card} grid gap-3 sm:grid-cols-4`}>
      <input required name="name" placeholder={t('name')} className={inp}/>
      <input required name="sku" placeholder={t('sku')} className={inp}/>
      <input name="cat" placeholder={t('category')} className={inp}/>
      <select name="wh" className={inp}>{hubs.map(h=><option key={h} value={h}>{h}</option>)}</select>
      <input required name="stock" type="number" min={0} placeholder={t('stock')} className={inp}/>
      <input name="min" type="number" min={0} placeholder={t('min')} className={inp}/>
      <input name="cost" type="number" step="0.01" min={0} placeholder={t('histCost')} className={inp}/>
      <input name="repCost" type="number" step="0.01" min={0} placeholder={t('repCost')} className={inp}/>
      <input name="price" type="number" step="0.01" min={0} placeholder={t('price')} className={inp}/>
      <input name="batch_number" placeholder={t('batchNumber')} className={inp}/>
      <input name="expiry_date" type="date" placeholder={t('expiryDate')} className={inp}/>
      <div className="flex gap-2 sm:col-span-4 justify-end">
        <button disabled={busy} className={btn}>{t('save')}</button>
        <button type="button" className={btn2} onClick={()=>setAdding(false)}>{t('cancel')}</button>
      </div>
    </form>}

    {!filteredP.length?<Empty line={t('emptyInv')} action={t('addProduct')} onClick={canEdit(role)?()=>setAdding(true):undefined}/>:
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className={th}>{t('name')}</th>
            <th className={th}>{t('sku')}</th>
            <th className={th}>{t('warehouse')}</th>
            <th className={`${th} text-end`}>{t('histCost')}</th>
            <th className={`${th} text-end`}>{t('repCost')}</th>
            <th className={`${th} text-end`}>{t('price')}</th>
            <th className={`${th} text-end`}>{t('stock')}</th>
            <th className={th}>{t('fefoStatus')}</th>
            <th className={th}>{t('status')}</th>
            <th className={th}>{t('actions')}</th>
          </tr>
        </thead>
        <tbody>
          {filteredP.map(p=>{
            const exp=getExpiryInfo(p.expiry_date);
            const isEroded=p.repCost!=null&&p.price>0&&p.price<p.repCost;
            return <tr key={p.id} className={tr}>
              <td className={`${td} font-medium`}>
                <div>{p.name}</div>
                {p.cat&&<div className="text-xs text-muted-foreground">{p.cat}</div>}
              </td>
              <td className={`${td} text-muted-foreground font-mono text-xs`}>{p.sku}</td>
              <td className={`${td} text-xs`}>
                <div>{p.wh}</div>
                {p.locations&&Object.keys(p.locations).length>1&&(
                  <div className="text-xs text-muted-foreground">
                    {Object.entries(p.locations).map(([h,q])=>`${h.split(' - ')[0]}: ${q}`).join(' · ')}
                  </div>
                )}
              </td>
              <td className={`${td} text-end text-muted-foreground`}>{money(d,p.cost,lang)}</td>
              <td className={`${td} text-end font-medium`}>
                <span className={isEroded?'font-semibold text-destructive':''}>{money(d,p.repCost??p.cost,lang)}</span>
              </td>
              <td className={`${td} text-end font-semibold`}>{money(d,p.price,lang)}</td>
              <td className={`${td} text-end font-semibold`}>{p.stock}</td>
              {/* Batch & FEFO Expiry Status */}
              <td className={td}>
                {p.expiry_date?(
                  <div className="space-y-0.5">
                    <Status tone={exp.tone}>
                      <span className="text-xs">{t(exp.labelKey)} {exp.daysLeft!==null&&exp.daysLeft>0?`(${exp.daysLeft}d)`:''}</span>
                    </Status>
                    {p.batch_number&&<div className="font-mono text-xs text-muted-foreground">{p.batch_number}</div>}
                    {exp.markdownActionKey!=='mdNone'&&(
                      <span className="inline-block rounded bg-accent px-1.5 py-0.5 text-2xs font-medium text-accent-foreground">
                        {t(exp.markdownActionKey)}
                      </span>
                    )}
                  </div>
                ):<span className="text-xs text-muted-foreground">{t('na')}</span>}
              </td>
              <td className={td}><Status tone={stockTone(p)}>{label(p)}</Status></td>
              <td className={td}>
                <div className="flex items-center gap-1.5">
                  {canEdit(role)&&(sale===p.id?(
                    <form onSubmit={recSale} className="flex gap-1">
                      <input name="qty" type="number" min={1} max={p.stock} required className={`${inp} w-20 py-1`}/>
                      <button disabled={busy} className={btn}>{t('save')}</button>
                    </form>
                  ):(
                    <button className={btn2} disabled={p.stock===0} onClick={()=>setSale(p.id)}>{t('recordSale')}</button>
                  ))}
                  {/* Task D: Inter-warehouse transfer action button */}
                  {canEdit(role)&&p.stock>0&&(
                    <button
                      className={btn2}
                      title={t('transferAction')}
                      onClick={()=>{
                        const dest=hubs.find(h=>h!==p.wh)??hubs[0]??p.wh;
                        setTransfer({pid:p.id,fromWh:p.wh,toWh:dest,qty:Math.min(p.stock,10)});
                      }}
                    >
                      <ArrowRightLeft size={13}/>
                    </button>
                  )}
                </div>
              </td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>}
  </div>;
}

function Restock(){
  const {t,lang}=useT(),{data:d,commit,role,busy}=useInventra();
  const ask=useServerFn(askCopilot);
  const [budgetCapInput,setBudgetCapInput]=useState<string>('');
  const [transferItem,setTransferItem]=useState<{p:Product;sourceHub:string;qty:number}|null>(null);
  const [adjustNotes,setAdjustNotes]=useState('');
  const [proposedPlan,setProposedPlan]=useState<{qty:Record<number,number>;rationale:Record<number,string>}|null>(null);
  const [appliedPlan,setAppliedPlan]=useState<{qty:Record<number,number>;rationale:Record<number,string>}|null>(null);
  const [adjusting,setAdjusting]=useState(false);

  const budgetCap=useMemo(()=>{
    const val=parseFloat(budgetCapInput);
    return isFinite(val)&&val>0?val:null;
  },[budgetCapInput]);

  // Compute recommendation rows
  const allRows=useMemo(()=>d.P.map(p=>({p,r:recommendation(d,p)})),[d]);
  const due=useMemo(()=>allRows.filter(x=>x.r.action==='order'),[allRows]);

  // Priority and cash allocation algorithm
  const {allocatedRows,totalAllocated,totalExpectedGP,allocatedCount,deferredCount}=useMemo(()=>{
    // Calculate velocity and profit impact per item
    const scored=due.map(({p,r})=>{
      const costPerUnit=p.repCost??p.cost;
      const lineCost=r.qty*costPerUnit;
      const unitGP=Math.max(0,p.price-costPerUnit);
      const w=weekly(d,p,4);
      const velocity=w.length?w.reduce((s,x)=>s+x.qty,0)/w.length:1;
      // Efficiency score: Gross Profit Impact per currency unit spent, scaled by turnover velocity
      const score=((p.price-costPerUnit)/Math.max(1,costPerUnit))*Math.max(0.1,velocity);
      return {p,r,costPerUnit,lineCost,unitGP,velocity,score};
    });

    // Sort by profit impact & velocity score descending
    scored.sort((a,b)=>b.score-a.score);

    let spent=0;
    let expGP=0;
    let allocCnt=0;
    let defCnt=0;

    const allocated=scored.map((item,rank)=>{
      const requestedQty=appliedPlan?.qty[item.p.id]??item.r.qty;
      const requestedCost=requestedQty*item.costPerUnit;
      if(budgetCap===null){
        spent+=requestedCost;
        expGP+=requestedQty*item.unitGP;
        allocCnt++;
        return {...item,rank:rank+1,allocQty:requestedQty,allocStatus:'allocated' as const};
      }
      const rem=budgetCap-spent;
      if(spent+requestedCost<=budgetCap){
        spent+=requestedCost;
        expGP+=requestedQty*item.unitGP;
        allocCnt++;
        return {...item,rank:rank+1,allocQty:requestedQty,allocStatus:'allocated' as const};
      } else if(rem>0){
        const pack=item.p.pack??1;
        const packCost=pack*item.costPerUnit;
        const possiblePacks=Math.floor(rem/packCost);
        const partialQty=possiblePacks*pack;
        if(partialQty>0){
          spent+=partialQty*item.costPerUnit;
          expGP+=partialQty*item.unitGP;
          allocCnt++;
          return {...item,rank:rank+1,allocQty:partialQty,allocStatus:'partial' as const};
        }
      }
      defCnt++;
      return {...item,rank:rank+1,allocQty:0,allocStatus:'deferred' as const};
    });

    return {
      allocatedRows:allocated,
      totalAllocated:spent,
      totalExpectedGP:expGP,
      allocatedCount:allocCnt,
      deferredCount:defCnt
    };
  },[due,budgetCap,d,appliedPlan]);

  const defaultCost=due.reduce((a,x)=>a+x.r.qty*(x.p.repCost??x.p.cost),0);

  function createAllAllocatedPOs(){
    const toOrder=allocatedRows.filter(x=>x.allocQty>0);
    if(!toOrder.length)return;
    void commit(x=>{
      toOrder.forEach(item=>{
        x.R.push({id:x.rid++,pid:item.p.id,qty:item.allocQty,got:0,status:'Pending Approval',t:C.todayISO(),unitCost:item.costPerUnit});
        x.N.unshift({id:x.nid++,text:`${item.p.name}: purchase request for ${item.allocQty} awaiting approval.`,read:false});
      });
    }).then(ok=>ok&&toast.success(t('allAllocatedCreated')));
  }

  async function proposeRestockPlan(){
    if(!adjustNotes.trim())return;
    setAdjusting(true);
    try{
      const candidates=allocatedRows.map(({p,r,allocQty})=>({pid:p.id,name:p.name,sku:p.sku,stock:p.stock,reorderPoint:p.min,unitCost:p.repCost??p.cost,pack:p.pack??1,qty:allocQty,recommendation:r.qty}));
      const question=`Return only a JSON array with objects {pid, suggestedQty, rationale}. Use only listed pid values; quantities must be nonnegative integers and pack multiples. Keep total cost within the budget cap ${budgetCap??'none'}. Unmentioned products keep their current qty. Manager notes: ${adjustNotes}`;
      const answer=await ask({data:{question,lang,summary:JSON.stringify({currency:d.settings.currency,budgetCap,items:candidates})}});
      const suggestions=JSON.parse(answer.match(/\[[\s\S]*\]/)?.[0]??'[]') as Array<{pid:number|string;suggestedQty:number;rationale:string}>;
      const qty:Record<number,number>=Object.fromEntries(allocatedRows.map(x=>[x.p.id,x.allocQty])),rationale:Record<number,string>={};
      let remaining=budgetCap===null?Infinity:Math.max(0,budgetCap-allocatedRows.reduce((s,x)=>s+x.allocQty*(x.p.repCost??x.p.cost),0));
      for(const suggestion of suggestions){
        const row=allocatedRows.find(x=>String(x.p.id)===String(suggestion.pid));
        if(!row||!Number.isFinite(suggestion.suggestedQty))continue;
        const pack=row.p.pack??1,cost=row.p.repCost??row.p.cost;
        const desired=Math.max(0,Math.floor(suggestion.suggestedQty/pack)*pack);
        const extra=Math.max(0,desired-row.allocQty),reduction=Math.max(0,row.allocQty-desired);
        remaining+=reduction*cost;
        const accepted=budgetCap===null?desired:row.allocQty+Math.min(extra,Math.floor(remaining/(cost*pack))*pack);
        remaining-=Math.max(0,accepted-row.allocQty)*cost;
        qty[row.p.id]=accepted;rationale[row.p.id]=String(suggestion.rationale??'');
      }
      setProposedPlan({qty,rationale});
    }catch{toast.error(lang==='ar'?'تعذّر إنشاء اقتراح التعديل.':'Could not create an adjustment proposal.');}
    finally{setAdjusting(false);}
  }

  function exportPdf(){
    const win=window.open('','_blank');if(!win)return;
    const doc=win.document;doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${t('pdfReportTitle')}</title><style>body{font:14px Arial,sans-serif;padding:32px;color:#172033}h1{margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{border:1px solid #ccd2dc;padding:8px;text-align:start}th{background:#f1f4f8}.summary{line-height:1.5}@media print{body{padding:0}}</style></head><body></body></html>`);doc.close();
    const add=(tag:string,text:string,parent:HTMLElement=doc.body)=>{const el=doc.createElement(tag);el.textContent=text;parent.append(el);return el;};
    add('h1',t('pdfReportTitle'));
    add('p',`${new Date().toISOString().slice(0,10)} · ${d.settings.currency||'EGP'}`);
    const summary=add('div','');summary.className='summary';
    [`${t('budgetCap')}: ${budgetCap===null?'—':money(d,budgetCap,lang)}`,`${t('allocatedSpend')}: ${money(d,totalAllocated,lang)}`,`${t('expectedGP')}: ${money(d,totalExpectedGP,lang)}`,`${t('fundedItems')}: ${allocatedCount}`,`${t('deferredItems')}: ${deferredCount}`].forEach(x=>add('p',x,summary));
    const table=add('table',''),head=doc.createElement('thead'),body=doc.createElement('tbody');table.append(head,body);
    const hr=doc.createElement('tr');[t('sku'),t('recommended'),t('qty'),t('cost'),t('totalSpend'),t('status')].forEach(x=>add('th',x,hr));head.append(hr);
    allocatedRows.forEach(x=>{const row=doc.createElement('tr');[`${x.p.sku} · ${x.p.name}`,String(x.r.qty),String(x.allocQty),money(d,x.costPerUnit,lang),money(d,x.allocQty*x.costPerUnit,lang),x.allocQty===0?'Deferred':x.allocQty<x.r.qty?'Partial':'Allocated'].forEach(v=>add('td',v,row));body.append(row);});
    win.focus();win.print();win.close();
  }

  function executeTransferOrder(p:Product,sourceHub:string,qty:number){
    void commit(x=>{
      const item=x.P.find(it=>it.id===p.id);
      if(!item)return;
      item.locations=item.locations||{[item.wh]:item.stock};
      const curSource=item.locations[sourceHub]??0;
      if(curSource<qty)throw new Error(t('transferError'));
      item.locations[sourceHub]=curSource-qty;
      item.locations[item.wh]=(item.locations[item.wh]??0)+qty;
      x.mv.unshift({pid:item.id,t:C.todayISO(),type:'Transfer',q:qty,who:'app',fromWh:sourceHub,toWh:item.wh,note:`Restock transfer from ${sourceHub}`});
      x.N.unshift({id:x.nid++,text:`${item.name}: Transferred ${qty} units from ${sourceHub} to ${item.wh}.`,read:false});
    }).then(ok=>{
      if(ok){
        toast.success(t('transferSuccess'));
        setTransferItem(null);
      }
    });
  }

  return <div className="space-y-8">
    <ScreenIntro
      q={t('qRestock')}
      a={due.length?fmt(t('aRestock'),{n:due.length,c:money(d,defaultCost,lang)}):t('aRestockNone')}
    />

    {/* Task B: Cash-Constrained Restock Allocator controls */}
    {due.length>0&&(
      <div className={`${card} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Layers size={14} className="text-primary"/>
              {t('budgetCap')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={500}
                placeholder={t('budgetCapPlaceholder')}
                value={budgetCapInput}
                onChange={e=>setBudgetCapInput(e.target.value)}
                className={`${inp} w-44 font-semibold tnum`}
              />
              <span className="text-xs text-muted-foreground font-semibold">{d.settings.currency||'EGP'}</span>
              {budgetCap!==null&&(
                <button type="button" onClick={()=>setBudgetCapInput('')} className={btn2}>
                  {t('clearBudget')}
                </button>
              )}
            </div>
          </div>
          {/* Quick presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{t('summary')}:</span>
            {[25000,50000,100000].map(v=>(
              <button
                key={v}
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-medium border border-border ${budgetCap===v?'bg-primary text-primary-foreground':'hover:bg-accent'}`}
                onClick={()=>setBudgetCapInput(String(v))}
              >
                {money(d,v,lang)}
              </button>
            ))}
          </div>
        </div>

        {budgetCap!==null&&(
          <div className="grid gap-3 rounded-lg border border-border bg-accent/30 p-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">{t('allocatedSpend')}</p>
              <p className="text-lg font-semibold tnum">{money(d,totalAllocated,lang)}</p>
              <p className="text-xs text-muted-foreground">{t('budgetCap')}: {money(d,budgetCap,lang)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('budgetUtilization')}</p>
              <p className="text-lg font-semibold tnum">{Math.round((totalAllocated/budgetCap)*100)}%</p>
              <div className="mt-1 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-chart-3" style={{width:`${Math.min(100,(totalAllocated/budgetCap)*100)}%`}}/>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('expectedGP')}</p>
              <p className="text-lg font-semibold text-success tnum">+{money(d,totalExpectedGP,lang)}</p>
              <p className="text-xs text-muted-foreground">{t('budgetNote')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {canEdit(role)&&(
                <>
                  <button disabled={busy||allocatedCount===0} onClick={createAllAllocatedPOs} className={btn}>{t('createAllAllocated')} ({allocatedCount})</button>
                  <button type="button" onClick={exportPdf} className={btn2}>{t('exportPdf')}</button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    )}
    {due.length>0&&<section className={`${card} space-y-3`}>
      <h2 className="font-semibold">{t('aiAdjustTitle')}</h2>
      <textarea value={adjustNotes} onChange={e=>setAdjustNotes(e.target.value)} placeholder={t('aiAdjustPromptPlaceholder')} className={`${inp} min-h-24 w-full`}/>
      <button type="button" disabled={adjusting||!adjustNotes.trim()} onClick={()=>void proposeRestockPlan()} className={btn}>{adjusting?t('thinking'):t('generateAdjustments')}</button>
      {proposedPlan&&<div className="rounded border border-primary/30 bg-accent/30 p-3"><p className="font-semibold">{t('proposedPlan')}</p>
        {Object.entries(proposedPlan.qty).map(([id,q])=><p key={id} className="text-sm">{allocatedRows.find(x=>String(x.p.id)===id)?.p.name}: {q} <span title={proposedPlan.rationale[Number(id)]}>{proposedPlan.rationale[Number(id)]}</span></p>)}
        <div className="mt-2 flex gap-2"><button type="button" onClick={()=>{setAppliedPlan(proposedPlan);setProposedPlan(null);}} className={btn}>{t('applyAdjustments')}</button><button type="button" onClick={()=>setProposedPlan(null)} className={btn2}>{t('discardAdjustments')}</button></div>
      </div>}
    </section>}

    {!d.P.length?<Empty line={t('emptyRestock')} action={t('goInventory')} to="inventory"/>:
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {budgetCap!==null&&<th className={th}>{t('priorityRank')}</th>}
            <th className={th}>{t('item')}</th>
            <th className={th}>{t('status')}</th>
            <th className={`${th} text-end`}>{t('stock')}</th>
            <th className={`${th} text-end`}>{t('qty')}</th>
            <th className={`${th} text-end`}>{t('cost')}</th>
            <th className={th}>{t('signal')}</th>
            <th className={th}>{t('actions')}</th>
          </tr>
        </thead>
        <tbody>
          {allocatedRows.map(({p,r,rank,allocQty,allocStatus,costPerUnit})=>{
            const head={order:t('recommended'),none:t('noAction'),review:t('review'),no_forecast:t('noForecast')}[r.action as string]??r.action;
            const itemTotalCost=r.qty*costPerUnit;

            // Check if another warehouse has stock available to transfer instead of ordering
            const otherHubStock=Object.entries(p.locations??{}).find(([h,q])=>h!==p.wh&&q>0);

            return <tr key={p.id} className={`${tr} align-top`}>
              {budgetCap!==null&&(
                <td className={`${td} font-bold text-xs text-muted-foreground`}>
                  #{rank}
                </td>
              )}
              <td className={`${td} font-medium`}>
                <div>{p.name}</div>
                <div className="font-mono text-xs text-muted-foreground">{p.sku} · {p.wh}</div>
              </td>
              <td className={td}>
                <div className="space-y-1">
                  <Status tone={r.action==='order'?stockTone(p)==='crit'?'crit':'low':r.action==='none'?'ok':'idle'}>
                    {head}
                  </Status>
                  {budgetCap!==null&&(
                    <div>
                      {allocStatus==='allocated'?(
                        <span className="inline-flex items-center gap-1 rounded bg-success/10 px-1.5 py-0.5 text-2xs font-semibold text-success">
                          <CheckCircle2 size={11}/>{t('allocated')}
                        </span>
                      ):allocStatus==='partial'?(
                        <span className="inline-flex items-center gap-1 rounded bg-warning/10 px-1.5 py-0.5 text-2xs font-semibold text-warning">
                          <AlertCircle size={11}/>{t('partial')}
                        </span>
                      ):(
                        <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-2xs font-medium text-muted-foreground">
                          {t('deferred')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </td>
              <td className={`${td} text-end`}>{p.stock}</td>
              <td className={`${td} text-end font-semibold`}>
                {budgetCap!==null?(
                  <div>
                    <span>{allocQty}</span>
                    {allocQty<r.qty&&<span className="block text-xs text-muted-foreground">/ {r.qty}</span>}
                  </div>
                ):r.action==='order'?r.qty:''}
              </td>
              <td className={`${td} text-end font-semibold`}>
                {r.action==='order'?money(d,budgetCap!==null?allocQty*costPerUnit:itemTotalCost,lang):''}
              </td>
              <td className={`${td} max-w-md text-xs text-muted-foreground`} dir="ltr">
                {[...(r.reasons??[]),...(r.warnings??[])].map((x:string,i:number)=><p key={i}>{x}</p>)}
                {/* Task D: Inter-warehouse alternative pill */}
                {otherHubStock&&(
                  <div className="mt-1.5 rounded border border-accent bg-accent/40 p-1.5 text-foreground flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">
                      {fmt(t('stockAvailableOtherHub'),{q:otherHubStock[1],h:otherHubStock[0]})}
                    </span>
                    {canEdit(role)&&(
                      <button
                        type="button"
                        onClick={()=>executeTransferOrder(p,otherHubStock[0],Math.min(otherHubStock[1],r.qty))}
                        className="rounded bg-card px-2 py-0.5 text-xs font-semibold text-primary hover:bg-card/80 border border-border"
                      >
                        {t('transferInstead')}
                      </button>
                    )}
                  </div>
                )}
              </td>
              <td className={`${td} text-end`}>
                {r.action==='order'&&canEdit(role)&&(
                  <button
                    className={btn}
                    disabled={busy||(budgetCap!==null&&allocQty===0)}
                    onClick={()=>void commit(x=>{
                      const q=budgetCap!==null?allocQty:r.qty;
                      x.R.push({id:x.rid++,pid:p.id,qty:q,got:0,status:'Pending Approval',t:C.todayISO(),unitCost:p.repCost??p.cost});
                      x.N.unshift({id:x.nid++,text:`${p.name}: purchase request for ${q} awaiting approval.`,read:false});
                    }).then(ok=>ok&&toast.success('✓'))}
                  >
                    {t('createPO')}
                  </button>
                )}
              </td>
            </tr>;
          })}
          {allRows.filter(x=>x.r.action!=='order').map(({p,r})=>{
            const head={none:t('noAction'),review:t('review'),no_forecast:t('noForecast')}[r.action as string]??r.action;
            return <tr key={p.id} className={`${tr} align-top opacity-70`}>
              {budgetCap!==null&&<td className={`${td} text-xs text-muted-foreground`}>—</td>}
              <td className={`${td} font-medium`}>{p.name}</td>
              <td className={td}><Status tone={r.action==='none'?'ok':'idle'}>{head}</Status></td>
              <td className={`${td} text-end`}>{p.stock}</td>
              <td className={`${td} text-end`}></td>
              <td className={`${td} text-end`}></td>
              <td className={`${td} max-w-md text-xs text-muted-foreground`} dir="ltr">
                {[...(r.reasons??[]),...(r.warnings??[])].map((x:string,i:number)=><p key={i}>{x}</p>)}
              </td>
              <td className={td}/>
            </tr>;
          })}
        </tbody>
      </table>
    </div>}
  </div>;
}

function SupplierCredit(){
  const {t,lang}=useT(),{data:d,commit,role,busy}=useInventra();
  const r=runway(d),rows=payableRows(d),suppliers=supplierCreditRows(d),reminders=findPaymentReminders(d);
  async function copyNotice(rem:(typeof reminders)[number]){try{if(!navigator.clipboard)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(generateSupplierMessage(rem,lang,d.settings.currency));toast.success(t('noticeCopied'));}catch{toast.error(t('clipboardUnavailable'));}}
  function logReminderAlerts(){void commit(x=>{for(const rem of reminders){const text=generateSupplierMessage(rem,lang,x.settings.currency);if(!x.N.some(n=>!n.read&&n.text===text))x.N.unshift({id:x.nid++,text,read:false});}}).then(ok=>ok&&toast.success(t('alertsLogged')));}
  function addSupplier(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget),name=String(f.get('name')||'').trim(),terms=Math.max(0,Number(f.get('terms'))||0),creditLimit=Math.max(0,Number(f.get('limit'))||0);if(!name)return;if(d.sup.some(s=>s.name.toLocaleLowerCase()===name.toLocaleLowerCase())){toast.error(t('duplicateSupplier'));return;}void commit(x=>x.sup.push({id:Math.max(0,...x.sup.map(s=>s.id))+1,name,terms,creditLimit})).then(ok=>ok&&toast.success(t('supplierSaved')));e.currentTarget.reset();}
  function saveSupplier(e:React.FormEvent<HTMLFormElement>,id:number){e.preventDefault();const f=new FormData(e.currentTarget),name=String(f.get('name')||'').trim(),terms=Math.max(0,Number(f.get('terms'))||0),creditLimit=Math.max(0,Number(f.get('limit'))||0);if(!name)return;void commit(x=>{const s=x.sup.find(y=>y.id===id);if(s){const old=s.name;s.name=name;s.terms=terms;s.creditLimit=creditLimit;x.R.forEach(o=>{if(o.supplier===old)o.supplier=name;});}}).then(ok=>ok&&toast.success(t('supplierSaved')));}
  function applyPayment(e:React.FormEvent<HTMLFormElement>,id:number){e.preventDefault();const form=e.currentTarget,amount=Number(new FormData(form).get('amount'));const row=rows.find(x=>x.o.id===id);if(!row||!Number.isFinite(amount)||amount<=0||amount>row.remaining){toast.error(t('invalidPayment'));return;}void commit(x=>{const o=x.R.find(y=>y.id===id);if(o)o.paid=(o.paid??0)+amount;}).then(ok=>{if(ok){toast.success(t('paymentSaved'));form.reset();}});}
  const summary=[['overdue',r.overdue],['dueWeek',r.week],['dueMonth',r.month],['dueLater',r.later]] as const;
  return <div className="space-y-8"><ScreenIntro q={t('payablesRunway')} a={`${t('outstanding')}: ${money(d,r.total,lang)} · ${t('overdue')}: ${money(d,r.overdue,lang)}`}/>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{summary.map(([key,value])=><div className={card} key={key}><p className="text-sm text-muted-foreground">{t(key)}</p><p className="mt-2 text-2xl tabular-nums">{money(d,value,lang)}</p></div>)}</div>
    <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl">{t('paymentReminders')}</h2>{reminders.length>0&&canEdit(role)&&<button className={btn2} disabled={busy} onClick={logReminderAlerts}>{t('logPaymentAlerts')}</button>}</div>{!reminders.length?<p className="text-sm text-muted-foreground">{t('noPaymentReminders')}</p>:<div className="grid gap-3 lg:grid-cols-2">{reminders.map(rem=>{const dueLabel=rem.status==='overdue'?t('overdue'):rem.status==='due_today'?t('dueToday'):fmt(t('dueInDays'),{d:rem.daysRemaining});return <article className={`${card} flex flex-wrap items-center justify-between gap-3`} key={rem.orderId}><div className="space-y-1"><div className="flex flex-wrap items-center gap-2"><strong>{rem.supplierName||t('na')}</strong><Status tone={rem.status==='overdue'?'crit':rem.status==='due_today'?'low':'idle'}>{dueLabel}</Status></div><p className="text-sm text-muted-foreground">PO #{rem.orderId} · <span dir="ltr">{rem.dueDate}</span></p><p className="text-sm tabular-nums">{money(d,rem.amountDue,lang)}</p></div><button className={btn2} disabled={!canEdit(role)} onClick={()=>copyNotice(rem)}>{t('copyNotice')}</button></article>;})}</div>}</section>
    <section className="space-y-3"><h2 className="text-xl">{t('payablesRunway')}</h2>{!rows.length?<p className="text-sm text-muted-foreground">{t('noPayables')}</p>:<div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full text-sm"><thead><tr>{['name','supplier','date','nextDue','outstanding','payment'].map(k=><th key={k} className={th}>{t(k as 'name')}</th>)}</tr></thead><tbody>{rows.map(({o,due,remaining,supplier})=><tr key={o.id} className={tr}><td className={td}>{d.P.find(p=>p.id===o.pid)?.name??t('na')}</td><td className={td}>{supplier?.name??t('na')}</td><td className={td}><span dir="ltr">{o.t}</span></td><td className={td}><span dir="ltr">{due}</span></td><td className={`${td} tabular-nums`}>{money(d,remaining,lang)}</td><td className={td}><form className="flex min-w-48 gap-2" onSubmit={e=>applyPayment(e,o.id)}><input name="amount" type="number" min="0.01" max={remaining} step="0.01" required aria-label={t('paymentAmount')} placeholder={t('paymentAmount')} className={`${inp} w-32`} disabled={!canEdit(role)||busy}/><button className={btn2} disabled={!canEdit(role)||busy}>{t('applyPayment')}</button></form></td></tr>)}</tbody></table></div>}</section>
    <section className="space-y-3"><div><h2 className="text-xl">{t('supplierCredit')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('noSuppliers')}</p></div>{canEdit(role)&&<form onSubmit={addSupplier} className="flex flex-wrap gap-2"><input name="name" required placeholder={t('supplierName')} className={inp}/><input name="terms" type="number" min="0" step="1" defaultValue="0" aria-label={t('creditTerms')} className={`${inp} w-32`}/><input name="limit" type="number" min="0" step="0.01" defaultValue="0" aria-label={t('creditLimit')} className={`${inp} w-40`}/><button className={btn} disabled={busy}>{t('addSupplier')}</button></form>}
    <div className="space-y-3">{suppliers.map(({s,outstanding,pending,utilization,available,overLimit,nextDue})=><form key={s.id} onSubmit={e=>saveSupplier(e,s.id)} className={`${card} flex flex-wrap items-end gap-3`}><label className="grid gap-1 text-xs text-muted-foreground">{t('supplierName')}<input name="name" defaultValue={s.name} required disabled={!canEdit(role)} className={inp}/></label><label className="grid gap-1 text-xs text-muted-foreground">{t('creditTerms')}<input name="terms" type="number" min="0" step="1" defaultValue={s.terms} disabled={!canEdit(role)} className={`${inp} w-28`}/></label><label className="grid gap-1 text-xs text-muted-foreground">{t('creditLimit')}<input name="limit" type="number" min="0" step="0.01" defaultValue={s.creditLimit} disabled={!canEdit(role)} className={`${inp} w-36`}/></label><span className="text-sm">{t('outstanding')}: <b className="tabular-nums">{money(d,outstanding,lang)}</b></span><span className="text-sm">{t('pendingApprovals')}: <b className="tabular-nums">{money(d,pending,lang)}</b></span><span className="text-sm">{t('availableCredit')}: <b className="tabular-nums">{available===null?t('cashTerms'):money(d,available,lang)}</b></span><span className={`text-sm tabular-nums ${overLimit?'text-destructive':'text-muted-foreground'}`}>{t('utilization')}: {utilization===null?'—':`${Math.round(utilization*100)}%`}</span><span className="text-sm text-muted-foreground">{t('nextDue')}: <span dir="ltr">{nextDue??'—'}</span></span>{canEdit(role)&&<button className={btn2} disabled={busy}>{t('saveTerms')}</button>}</form>)}</div></section>
  </div>;
}

function TransfersScreen(){
 const {t,lang}=useT(),{data:d,commit,busy,role}=useInventra();
 const [scanTransferId,setScanTransferId]=useState<number|null>(null),[scanSession,setScanSession]=useState<ScanVerificationItem[]>([]),[scanCode,setScanCode]=useState('');
 const ops=findRebalanceOpportunities(d),triggers=findTransferTriggers(d),critical=triggers.filter(x=>x.urgency==='critical'),saved=totalCapitalSaved(ops),criticalSaved=critical.reduce((sum,x)=>sum+x.capitalSaved,0),active=d.transfers.filter(x=>x.status==='in_transit').length,done=d.transfers.filter(x=>x.status==='completed').length;
 const create=(o:typeof ops[number])=>void commit(x=>{x.transfers.push({id:Math.max(0,...x.transfers.map(v=>v.id))+1,fromWh:o.fromWh,toWh:o.toWh,items:[{pid:o.pid,qty:o.transferQty}],status:'draft',t:C.todayISO()});});
 const triggerFor=(o:typeof ops[number])=>triggers.find(x=>x.pid===o.pid&&x.fromWh===o.fromWh&&x.toWh===o.toWh);
 function openScanner(id:number){const transfer=d.transfers.find(x=>x.id===id);if(!transfer)return;setScanTransferId(id);setScanSession(initScanSession(transfer.items,d.P));setScanCode('');}
 function submitScan(e:React.FormEvent<HTMLFormElement>){e.preventDefault();if(!scanCode.trim())return;const result=recordScan(scanSession,scanCode);if(!result.matched)toast.error(t('scanMismatch'));setScanSession(result.session);setScanCode('');}
 async function confirmScannedTransfer(id:number){const transfer=d.transfers.find(x=>x.id===id);if(!transfer||!scanSession.length||!scanSession.every(i=>i.scannedQty>=i.expectedQty))return;const ok=await commit(x=>transfer.status==='draft'?dispatchTransfer(x,id):receiveTransfer(x,id,C.todayISO()));if(ok){setScanTransferId(null);setScanSession([]);toast.success(t('scanComplete'));}}
 return <div className="space-y-8"><ScreenIntro q={t('rebalanceIntroQ')} a={t('rebalanceIntroA')}/><div className="grid gap-4 sm:grid-cols-3">{[[t('capitalSaved'),money(d,saved,lang)],[t('activeTransfers'),active],[t('completedTransfers'),done]].map(([k,v])=><div className={card} key={k}><p className="text-sm text-muted-foreground">{k}</p><p className="mt-2 text-2xl tabular-nums">{v}</p></div>)}</div>{critical.length>0&&<aside className={`${card} border-warning/40 bg-warning/10`}><h2 className="font-semibold">{t('triggersAlertTitle')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('triggersAlertDesc')}</p><p className="mt-2 text-sm font-medium">{fmt(t('criticalTriggerSummary'),{count:critical.length,amount:money(d,criticalSaved,lang)})}</p></aside>}{triggers.length>0&&<button className={btn} disabled={!canEdit(role)||busy} onClick={()=>void commit(x=>batchCreateTransfers(x,triggers))}>{t('batchCreateTransfers')}</button>}<section className="space-y-3"><h2 className="text-xl">{t('recommendations')}</h2><div className="overflow-auto rounded-lg border border-border"><table className="w-full text-sm"><thead><tr>{['sku','transferFrom','transferTo','qty','urgency','capitalSaved','actions'].map(x=><th className={th} key={x}>{t(x as 'name')}</th>)}</tr></thead><tbody>{ops.map((o,i)=>{const urgency=triggerFor(o)?.urgency??((d.P.find(p=>p.id===o.pid)?.locations?.[o.toWh]??0)<=Math.floor((d.P.find(p=>p.id===o.pid)?.min??0)/2)?'critical':'moderate');return <tr className={tr} key={`${o.pid}-${i}`}><td className={td}>{d.P.find(p=>p.id===o.pid)?.sku}</td><td className={td}>{o.fromWh}</td><td className={td}>{o.toWh}</td><td className={td}>{o.transferQty}</td><td className={td}><Status tone={urgency==='critical'?'crit':'low'}>{t(urgency==='critical'?'urgencyCritical':'urgencyModerate')}</Status></td><td className={td}>{money(d,o.capitalSaved,lang)}</td><td className={td}><button className={btn} disabled={!canEdit(role)||busy} onClick={()=>create(o)}>{t('createTransfer')}</button></td></tr>;})}</tbody></table></div></section><section className="space-y-3"><h2 className="text-xl">{t('transferOrders')}</h2>{d.transfers.map(x=>{const open=scanTransferId===x.id,complete=open&&scanSession.length>0&&scanSession.every(i=>i.scannedQty>=i.expectedQty);return <article className={`${card} space-y-3`} key={x.id}><div className="flex flex-wrap items-center justify-between gap-3"><span>#{x.id} · {x.fromWh} → {x.toWh}</span><Status tone={x.status==='completed'?'ok':x.status==='in_transit'?'low':'idle'}>{t(x.status==='in_transit'?'inTransit':x.status==='completed'?'completed':x.status==='cancelled'?'cancelled':'draft')}</Status><span>{x.items.map(i=>`${d.P.find(p=>p.id===i.pid)?.sku} × ${i.qty}`).join(', ')}</span>{canEdit(role)&&['draft','in_transit'].includes(x.status)&&<button className={btn2} disabled={busy} onClick={()=>open?setScanTransferId(null):openScanner(x.id)}>{t('scanToVerify')}</button>}</div>{open&&<div className="rounded-md border border-border bg-muted/20 p-4"><form className="flex flex-wrap gap-2" onSubmit={submitScan}><input autoFocus value={scanCode} onChange={e=>setScanCode(e.target.value)} placeholder={t('scanInputPlaceholder')} className={`${inp} min-w-64 flex-1`} aria-label={t('scanInputPlaceholder')} /><button type="submit" className={btn2} disabled={busy||!scanCode.trim()}>{t('scanToVerify')}</button></form><ul className="mt-4 space-y-2">{scanSession.map(item=>{const verified=item.scannedQty>=item.expectedQty;const percent=item.expectedQty?Math.min(100,item.scannedQty/item.expectedQty*100):100;return <li key={item.pid} className={`rounded-md border p-3 ${verified?'border-emerald-500/40 bg-emerald-500/10':'border-border'}`}><div className="flex flex-wrap items-center justify-between gap-2"><span><b dir="ltr">{item.sku}</b> · {item.name}</span><span className="tabular-nums" dir="ltr">{fmt(t('scanProgress'),{sku:item.sku,scanned:item.scannedQty,expected:item.expectedQty})}</span>{verified&&<Status tone="ok">{t('itemVerified')}</Status>}</div><progress className="mt-2 h-2 w-full accent-primary" max={100} value={percent}/></li>;})}</ul>{complete&&<div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-medium text-emerald-700">{t('scanComplete')}</p><button className={btn} disabled={busy} onClick={()=>void confirmScannedTransfer(x.id)}>{t(x.status==='draft'?'confirmDispatch':'confirmReceive')}</button></div>}</div>}</article>;})}</section></div>;
}

function CourierReconciliationScreen(){
 const {t,lang}=useT(),{data:d,commit,busy,role}=useInventra(),s=courierSummary(d),by=shipmentsByCourier(d);
 const fileRef=useRef<HTMLInputElement>(null);
 const action=(id:number,status:'delivered'|'rto'|'remitted',amount?:number)=>void commit(x=>{const sh=x.shipments.find(v=>v.id===id);if(!sh)return;sh.status=status;if(status==='delivered')sh.deliveredAt=C.todayISO();if(status==='remitted'){sh.remittedAmount=amount??sh.codAmount;sh.remittedAt=C.todayISO();}});
 async function onStatement(f:File){
   const parsed=parseCourierCsv(await f.text());
   if(parsed.errors.length){toast.error(parsed.errors.join(' '));return;}
   if(!parsed.rows.length){toast.error(t('statementEmpty'));return;}
   let res:StatementResult|undefined;
   const ok=await commit(x=>{res=applyCourierStatement(x,parsed.rows,f.name);});
   if(ok&&res){
     const summary=fmt(t('statementImported'),{m:res.updated,u:res.unmatched.length});
     if(res.unmatched.length)toast.warning(`${summary} ${t('unmatched')}: ${res.unmatched.join(', ')}`);
     else toast.success(summary);
   }
 }
 const downloadSample=()=>{const blob=new Blob([generateSampleCourierCsv(d)],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='courier_statement_sample.csv';document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),0);};
 return <div className="space-y-8"><div className="flex flex-wrap items-center justify-between gap-4"><ScreenIntro q={t('courierIntroQ')} a={t('courierIntroA')}/>{canEdit(role)&&<div className="flex flex-wrap gap-2"><button className={btn2} onClick={downloadSample}>{t('downloadSampleCsv')}</button><button className={btn} disabled={busy} onClick={()=>fileRef.current?.click()}>{t('importStatement')}</button></div>}<input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f){void onStatement(f);e.target.value='';}}}/></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[[t('pendingCashRemittance'),money(d,s.deliveredPendingCash,lang)],[t('ghostStockInTransit'),money(d,s.inTransitGhostStockValue,lang)],[t('rtoRateLabel'),`${(s.rtoRate*100).toFixed(1)}%`],[t('remittedCash'),money(d,s.remittedCash,lang)]].map(([k,v])=><div className={card} key={k}><p className="text-sm text-muted-foreground">{k}</p><p className="mt-2 text-2xl tabular-nums">{v}</p></div>)}</div><section className="space-y-3"><h2 className="text-xl">{t('courierExposure')}</h2>{by.map(c=><div className={`${card} flex flex-wrap justify-between gap-3`} key={c.courier}><b>{c.courier}</b><span>{t('shipmentsCount')}: {c.shipmentsCount}</span><span>{t('pendingCashRemittance')}: {money(d,c.pendingCash,lang)}</span><span>{t('rtoRateLabel')}: {(c.rtoRate*100).toFixed(1)}%</span></div>)}</section><section className="space-y-3"><h2 className="text-xl">{t('shipments')}</h2>{d.shipments.map(x=><div className={`${card} flex flex-wrap items-center justify-between gap-3`} key={x.id}><span>{x.tracking}</span><span>{x.courier} · {x.customer}</span><span>{money(d,x.codAmount,lang)}</span><Status tone={x.status==='remitted'?'ok':x.status==='rto'?'crit':'low'}>{t(x.status==='in_transit'?'inTransit':x.status==='delivered'?'delivered':x.status==='rto'?'rto':'remitted')}</Status>{canEdit(role)&&<div className="flex gap-2">{x.status==='in_transit'&&<button className={btn2} disabled={busy} onClick={()=>action(x.id,'delivered')}>{t('markDelivered')}</button>}{x.status==='delivered'&&<button className={btn} disabled={busy} onClick={()=>action(x.id,'remitted')}>{t('reconcilePayout')}</button>}{x.status!=='rto'&&x.status!=='remitted'&&<button className={btn2} disabled={busy} onClick={()=>action(x.id,'rto')}>{t('markRTO')}</button>}</div>}</div>)}</section></div>;
}

function Orders(){
  const {t,lang}=useT(),{data:d,commit,role,busy}=useInventra();const name=(id:number)=>d.P.find(p=>p.id===id)?.name??t('na');
  const step=(id:number,to:string)=>{
    const order=d.R.find(r=>r.id===id);
    if(to==='Confirmed'&&order){const check=creditCheck(d,order.supplier,orderTotal(d,order));if(check?.exceeds){toast.error(fmt(t('creditLimitWarning'),{limit:money(d,check.limit,lang)}));return;}}
    void commit(x=>{
    const o=x.R.find(r=>r.id===id)!;
    o.status=to;
    if(to==='Received'){
      const p=x.P.find(p=>p.id===o.pid);
      if(p){
        p.stock+=o.qty-o.got;
        p.locations=p.locations||{[p.wh]:p.stock};
        p.locations[p.wh]=(p.locations[p.wh]??0)+(o.qty-o.got);
        x.mv.push({pid:p.id,t:C.todayISO(),type:'receive',q:o.qty-o.got,who:'app'});
      }
      o.got=o.qty;
    }
    });
  };
  const st:Record<string,[string,Tone]>={'Pending Approval':[t('stPending'),'low'],Confirmed:[t('stConfirmed'),'idle'],Received:[t('stReceived'),'ok'],Cancelled:[t('stCancelled'),'idle']};
  const pend=d.R.filter(o=>o.status==='Pending Approval').length,conf=d.R.filter(o=>o.status==='Confirmed').length;
  return <div className="space-y-8">
    <ScreenIntro q={t('qOrders')} a={fmt(t('aOrders'),{p:pend,c:conf})}/>
    {!d.R.length?<Empty line={t('emptyOrders')} action={t('goRestock')} to="restock"/>:
    <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full text-sm"><thead><tr>{['name','qty','supplier','date','status','actions'].map(k=><th key={k} className={`${th} ${k==='qty'?'text-end':''}`}>{t(k as 'name')}</th>)}</tr></thead>
    <tbody>{d.R.map(o=>{const [l,tone]=st[o.status]??[o.status,'idle' as Tone];return <tr key={o.id} className={tr}><td className={`${td} font-medium`}>{name(o.pid)}</td><td className={`${td} text-end font-semibold`}>{o.qty}</td><td className={td}>{o.status==='Pending Approval'&&canEdit(role)&&d.sup.length?<select aria-label={t('supplier')} value={o.supplier??''} disabled={busy} className={inp} onChange={e=>void commit(x=>{const target=x.R.find(y=>y.id===o.id);if(target){target.supplier=e.target.value||undefined;const p=x.P.find(y=>y.id===target.pid);target.unitCost=p?.repCost??p?.cost??0;}})}><option value="">{t('supplier')}</option>{d.sup.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}</select>:o.supplier??t('na')}</td><td className={`${td} text-muted-foreground`}>{o.t}</td><td className={td}><Status tone={tone}>{l}</Status></td>
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
    {[0,.5,1].map(f=><g key={f}><line x1={pl} x2={W-pr} y1={pt+ih*(1-f)} y2={pt+ih*(1-f)} className="stroke-border" strokeWidth={0.5}/><text x={pl-4} y={pt+ih*(1-f)+3} textAnchor="end" className="fill-muted-foreground text-2xs tnum">{Math.round(max*f)}</text></g>)}
    <line x1={x(o)} x2={x(o)} y1={pt} y2={pt+ih} className="stroke-border" strokeDasharray="2 3"/>
    {band&&<path d={band} className="fill-primary/10"/>}
    <path d={path(actual,0)} fill="none" className="stroke-foreground" strokeWidth={1.5}/>
    <path d={path(fcl,o)} fill="none" className="stroke-primary" strokeWidth={1.5} strokeDasharray="5 4"/>
    <text x={x(o)-4} y={y(actual[o]??0)-6} textAnchor="end" className="fill-foreground text-2xs">{t('actual')}</text>
    <text x={x(n-1)+4} y={y(fc[fc.length-1]??0)+3} className="fill-primary text-2xs">{t('fcLabel')}</text>
    {band&&<text x={x(n-1)+4} y={y(hi[hi.length-1]??0)-4} className="fill-muted-foreground text-2xs">{t('band')}</text>}
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
    return {name:p.name,sku:p.sku,stock:p.stock,min:p.min,cost:p.cost,repCost:p.repCost,price:p.price,wh:p.wh,locations:p.locations,batch:p.batch_number,expiry:p.expiry_date,lead:p.lead,forecast14:f.ok?Math.round(f.daily.slice(0,14).reduce((a:number,b:number)=>a+b,0)):null,forecastNote:f.ok?null:f.reason,dailyWape:f.ok&&f.accuracy?f.accuracy.wapeDaily:null,recommendation:r.action,orderQty:r.qty};}),
    openOrders:d.R.filter(r=>!['Received','Cancelled'].includes(r.status)).map(r=>({pid:r.pid,qty:r.qty,status:r.status}))}),[d]);
  async function send(text:string){if(!text.trim()||busy)return;setBusy(true);setQ('');try{const a=await ask({data:{question:text,lang,summary}});setMsgs(m=>[...m,{q:text,a}]);}catch(e){toast.error(e instanceof Error?e.message:'Error');}finally{setBusy(false);}}
  return <div className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-ink-border bg-ink p-6 text-ink-foreground">
    <div className="flex flex-wrap gap-2">{(['q1','q2','q3'] as const).map(k=><button key={k} className="rounded-full border border-ink-border bg-white/5 px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-white/10 disabled:opacity-50" disabled={busy} onClick={()=>void send(t(k))}>{t(k)}</button>)}</div>
    {msgs.map((m,i)=><div key={i} className="space-y-2"><p className="ms-auto w-fit max-w-[85%] rounded-2xl bg-azure-deep px-3 py-2 text-sm text-white">{m.q}</p><div className="whitespace-pre-wrap rounded-2xl border border-ink-border bg-white/5 p-4 text-sm">{m.a}</div></div>)}
    {busy&&<p className="text-sm text-ink-muted">{t('thinking')}</p>}
    <form onSubmit={e=>{e.preventDefault();void send(q);}} className="flex gap-2"><input value={q} onChange={e=>setQ(e.target.value)} placeholder={t('askPlaceholder')} className="flex-1 rounded-md border border-ink-border bg-white/5 px-3 py-2 text-sm text-ink-foreground transition-colors placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" maxLength={1000}/><button disabled={busy} className="rounded-md bg-azure-deep px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-azure-deep/90 disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t('ask')}</button></form>
  </div>;
}
