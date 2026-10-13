import C from './core';
import type { WorkspaceData, Product } from './types';
export const emptyData = ():WorkspaceData => ({P:[],archived:[],SR:[],mv:[],R:[],N:[],imports:[],settings:{currency:'USD'},snooze:{},watch:[],alerts:[],px:{},nid:1,rid:1});
export function demoData():WorkspaceData {
  const rows:[string,string,string,number,number,number,number,number,number][]=[['Organic Oat Milk 1L','DR-101','Beverages',98,40,400,2.1,3.6,13],['Almond Butter 340g','PA-204','Pantry',210,60,400,3.4,6.2,6],['Greek Yogurt 500g','DA-310','Dairy',320,40,200,1.2,2.4,8],['Basmati Rice 5kg','PA-118','Pantry',0,30,300,7.5,11.9,5],['Cold Brew Coffee 330ml','DR-155','Beverages',35,40,300,1.1,2.5,9],['Extra Virgin Olive Oil 1L','PA-230','Pantry',140,50,300,6.9,11.5,4],['Protein Bar Box (12)','SN-402','Snacks',180,50,350,9,16.9,5],['Sparkling Water 24pk','DR-170','Beverages',390,60,300,5.5,9.9,5],['Matcha Powder 100g','PA-290','Pantry',25,10,80,8,15,0]];
  const d=emptyData();
  rows.forEach(([name,sku,cat,stock,min,max,cost,price,base],i)=>{
    const p:Product={id:i+1,name,sku,cat,stock,min,max,cost,price,wh:i%3===2?'North Branch':'Main Warehouse',exp:999,lead:3,src:'demo'};
    d.P.push(p);
    for(let k=0;k<(i===8?6:60);k++) d.SR.push({pid:p.id,date:C.addDays(C.todayISO(),k-(i===8?6:60)),qty:Math.round(base*([.9,.9,1,1,1.1,1.6,1.8][k%7]??1))});
  });
  d.R=[{id:1,pid:1,qty:120,got:0,status:'Pending Approval',t:C.todayISO(),supplier:'FreshLine Foods'},{id:2,pid:5,qty:80,got:0,status:'Confirmed',t:C.todayISO(),supplier:'SwiftDist'}];d.rid=3;
  d.N=[{id:1,text:'Basmati Rice 5kg is out of stock.',read:false},{id:2,text:'Organic Oat Milk: purchase request awaiting approval.',read:false}];d.nid=3;
  return d;
}
export function series(d:WorkspaceData,p:Product):number[]{const dates=d.SR.filter(r=>r.pid===p.id).map(r=>r.date).sort();const first=dates[0];return first?C.dailySeries(d.SR,p.id,first,C.addDays(C.todayISO(),-1)):[];}
export const forecastFor=(d:WorkspaceData,p:Product)=>C.chooseForecast(series(d,p),90);
export const recommendation=(d:WorkspaceData,p:Product)=>C.recommend({onHand:p.stock,openPO:C.openPOQty(d.R,p.id),pendingQty:d.R.filter(r=>r.pid===p.id&&r.status==='Pending Approval').reduce((s,r)=>s+r.qty,0),leadDays:p.lead,forecast:forecastFor(d,p),moq:p.moq??0,packSize:p.pack??1,maxLevel:p.max||null,shelfLifeDays:p.shelf??null});
export const status=(p:Product)=>p.stock===0?'Out of stock':p.stock<=p.min?'Low stock':'In stock';
export const money=(d:WorkspaceData,n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:d.settings.currency}).format(n);
export const dataHash=(d:WorkspaceData)=>C.hashData({P:d.P,archived:d.archived,SR:d.SR,mv:d.mv,R:d.R});
export function download(name:string,text:string,type='application/json'){const u=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}