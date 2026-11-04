import C from './core';
import type { WorkspaceData, Transfer } from './types';

export interface RebalanceOpportunity { pid:number; fromWh:string; toWh:string; transferQty:number; capitalSaved:number; }
export interface TransferTrigger {
  pid:number;
  sku:string;
  fromWh:string;
  toWh:string;
  currentStockAtTarget:number;
  transferQty:number;
  urgency:'critical'|'moderate';
  capitalSaved:number;
}

export function findTransferTriggers(d:WorkspaceData):TransferTrigger[]{
  const triggers:TransferTrigger[]=[];
  for(const p of d.P){
    const locations=Object.entries(p.locations??{});
    if(locations.length<2)continue;
    const pack=Math.max(1,p.pack??1);
    const remainingSurplus=new Map(locations.filter(([,stock])=>stock>p.min).map(([hub,stock])=>[hub,stock-p.min]));
    const targets=locations.filter(([,stock])=>stock<p.min).sort(([,a],[,b])=>{
      const aCritical=a<=Math.floor(p.min/2),bCritical=b<=Math.floor(p.min/2);
      return Number(bCritical)-Number(aCritical)||(p.min-a)-(p.min-b);
    });
    for(const [toWh,targetStock] of targets){
      let remainingDeficit=p.min-targetStock;
      for(const [fromWh] of locations){
        const surplus=remainingSurplus.get(fromWh)??0;
        if(fromWh===toWh||surplus<=0||remainingDeficit<=0)continue;
        const transferQty=Math.floor(Math.min(surplus,remainingDeficit)/pack)*pack;
        if(transferQty<=0)continue;
        triggers.push({pid:p.id,sku:p.sku,fromWh,toWh,currentStockAtTarget:targetStock,transferQty,
          urgency:targetStock<=Math.floor(p.min/2)?'critical':'moderate',
          capitalSaved:transferQty*(p.repCost??p.cost)});
        remainingSurplus.set(fromWh,surplus-transferQty);
        remainingDeficit-=transferQty;
      }
    }
  }
  return triggers.sort((a,b)=>Number(b.urgency==='critical')-Number(a.urgency==='critical')||b.capitalSaved-a.capitalSaved);
}

export function batchCreateTransfers(d:WorkspaceData,triggers:TransferTrigger[]):WorkspaceData{
  const groups=new Map<string,Transfer>();
  let nextId=Math.max(0,...d.transfers.map(x=>x.id))+1;
  for(const trigger of triggers){
    const key=JSON.stringify([trigger.fromWh,trigger.toWh]);
    let transfer=groups.get(key);
    if(!transfer){
      transfer={id:nextId++,fromWh:trigger.fromWh,toWh:trigger.toWh,items:[],status:'draft',t:C.todayISO()};
      groups.set(key,transfer);
      d.transfers.push(transfer);
    }
    const existing=transfer.items.find(item=>item.pid===trigger.pid);
    if(existing)existing.qty+=trigger.transferQty;
    else transfer.items.push({pid:trigger.pid,qty:trigger.transferQty});
  }
  return d;
}

export function findRebalanceOpportunities(d:WorkspaceData):RebalanceOpportunity[]{
  const out:RebalanceOpportunity[]=[];
  for(const p of d.P){
    const locations=p.locations??{};
    const entries=Object.entries(locations);
    if(entries.length<2)continue;
    const deficits=entries.filter(([,q])=>q<p.min).map(([hub,q])=>({hub,qty:p.min-q}));
    const surpluses=entries.filter(([,q])=>q>p.max).map(([hub,q])=>({hub,qty:q-p.max}));
    for(const def of deficits)for(const sur of surpluses){
      if(sur.hub===def.hub||sur.qty<=0||def.qty<=0)continue;
      const pack=Math.max(1,p.pack??1),raw=Math.min(sur.qty,def.qty),qty=Math.floor(raw/pack)*pack;
      if(qty>0)out.push({pid:p.id,fromWh:sur.hub,toWh:def.hub,transferQty:qty,capitalSaved:qty*(p.repCost??p.cost)});
    }
  }
  return out;
}
export const activeTransfers=(d:WorkspaceData):Transfer[]=>d.transfers.filter(x=>x.status==='in_transit');
export const totalCapitalSaved=(rows:RebalanceOpportunity[])=>rows.reduce((a,x)=>a+x.capitalSaved,0);
export function dispatchTransfer(d:WorkspaceData,id:number):WorkspaceData{
 const x=d.transfers.find(t=>t.id===id);if(!x||x.status!=='draft')throw new Error('Transfer is not a draft.');
 for(const item of x.items){const p=d.P.find(v=>v.id===item.pid);if(!p||((p.locations?.[x.fromWh]??(p.wh===x.fromWh?p.stock:0))<item.qty))throw new Error('Insufficient stock at source hub.');}
 for(const item of x.items){const p=d.P.find(v=>v.id===item.pid)!;p.locations=p.locations??{[p.wh]:p.stock};p.locations[x.fromWh]=(p.locations[x.fromWh]??0)-item.qty;p.stock-=item.qty;}
 x.status='in_transit';d.mv.push(...x.items.map(i=>({pid:i.pid,t:x.t,type:'Transfer',q:i.qty,who:'app',fromWh:x.fromWh,toWh:x.toWh,note:`Dispatched transfer ${x.id}`})));return d;
}
export function receiveTransfer(d:WorkspaceData,id:number,receivedAt:string):WorkspaceData{
 const x=d.transfers.find(t=>t.id===id);if(!x||x.status!=='in_transit')throw new Error('Transfer is not in transit.');
 for(const i of x.items){const p=d.P.find(v=>v.id===i.pid);if(!p)throw new Error('Transfer product is missing.');p.locations=p.locations??{[p.wh]:p.stock};p.locations[x.toWh]=(p.locations[x.toWh]??0)+i.qty;p.stock+=i.qty;}
 x.status='completed';x.receivedAt=receivedAt;return d;
}
