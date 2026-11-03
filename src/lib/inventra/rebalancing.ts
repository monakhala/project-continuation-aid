import type { WorkspaceData, Transfer } from './types';

export interface RebalanceOpportunity { pid:number; fromWh:string; toWh:string; transferQty:number; capitalSaved:number; }

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
