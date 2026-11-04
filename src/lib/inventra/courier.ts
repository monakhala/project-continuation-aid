import C from './core';
import type { WorkspaceData } from './types';

export function courierSummary(d:WorkspaceData){const s=d.shipments,inTransit=s.filter(x=>x.status==='in_transit'),rto=s.filter(x=>x.status==='rto'),remitted=s.filter(x=>x.status==='remitted');return{inTransitCount:inTransit.length,inTransitGhostStockValue:inTransit.reduce((a,x)=>a+x.items.reduce((b,i)=>{const p=d.P.find(v=>v.id===i.pid);return b+i.qty*(p?.repCost??p?.cost??0);},0),0),deliveredPendingCash:s.filter(x=>x.status==='delivered').reduce((a,x)=>a+x.codAmount,0),remittedCash:remitted.reduce((a,x)=>a+(x.remittedAmount??0),0),rtoCount:rto.length,rtoRate:s.length?rto.length/s.length:0,discrepancy:remitted.reduce((a,x)=>a+x.codAmount-(x.remittedAmount??x.codAmount),0)};}
export function shipmentsByCourier(d:WorkspaceData){return [...new Set(d.shipments.map(x=>x.courier))].map(c=>{const s=d.shipments.filter(x=>x.courier===c),r=s.filter(x=>x.status==='rto').length;return{courier:c,shipmentsCount:s.length,pendingCash:s.filter(x=>x.status==='delivered').reduce((a,x)=>a+x.codAmount,0),deliveredCount:s.filter(x=>['delivered','remitted'].includes(x.status)).length,rtoRate:s.length?r/s.length:0,averageFee:s.reduce((a,x)=>a+x.fee,0)/(s.length||1)};});}

/* ============ Multi-courier CSV statement import ============
   Parses the statement a courier (Bosta, Mylerz, Aramex…) exports and
   reconciles recorded shipments by tracking number. Pure parsing + state
   transitions; never invents data that is not in the statement. */

export type StatementStatus='in_transit'|'delivered'|'rto'|'remitted';
export interface StatementRow{tracking:string;courier:string;status:StatementStatus;cod:number|null;fee:number|null;date:string|null;}
export interface ParsedStatement{rows:StatementRow[];errors:string[];}
export interface StatementResult{updated:number;skipped:number;matched:number;unmatched:string[];}

// Column aliases cover the common export headers of Egyptian/regional couriers.
const COLS:{
  tracking:string[];courier:string[];status:string[];cod:string[];fee:string[];date:string[];
}={
  tracking:['tracking','trackingno','awb','waybill','airwaybill','shipmentid','ordernumber','order'],
  courier:['courier','carrier','company','provider'],
  status:['status','state','shipmentstatus'],
  cod:['cod','codamount','codcollected','collected','cashcollected','amount','totalcod'],
  fee:['fee','deliveryfee','shippingfee','courierfee','servicefee'],
  date:['date','statementdate','delivereddate','remitteddate','updatedat'],
};

const STATUS_MAP:(v:string)=>StatementStatus|null=v=>{
  const s=v.toLowerCase();
  if(/rto|return|refus/.test(s))return 'rto';
  if(/remit|paid|settle|transfer|payout/.test(s))return 'remitted';
  if(/deliver/.test(s))return 'delivered';
  if(/transit|ship|dispatch|pickup/.test(s))return 'in_transit';
  return null;
};

const stripNum=(v:string)=>v.replace(/[^0-9.\-]/g,'');

function num(v:string):number|null{
  if(!v.trim())return null;
  const n=Number(stripNum(v));
  return Number.isFinite(n)?n:null;
}

function normDate(v:string):string|null{
  const s=v.trim();if(!s)return null;
  const iso=s.match(/^(\d{4}-\d{2}-\d{2})/);
  if(iso)return iso[1]!;
  const dmy=s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if(dmy)return `${dmy[3]}-${dmy[2]!.padStart(2,'0')}-${dmy[1]!.padStart(2,'0')}`;
  return null;
}

// Handles simple quoted CSV fields ("1,250.50").
function splitLine(line:string,delim:string):string[]{
  const out:string[]=[];let cur='',q=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i]!;
    if(ch==='"'){if(q&&line[i+1]==='"'){cur+='"';i++;}else q=!q;}
    else if(ch===delim&&!q){out.push(cur);cur='';}
    else cur+=ch;
  }
  out.push(cur);
  return out.map(x=>x.trim());
}

const normKey=(k:string)=>k.toLowerCase().replace(/[^a-z]/g,'');

export function parseCourierCsv(text:string):ParsedStatement{
  const lines=text.split(/\r?\n/).filter(l=>l.trim());
  if(lines.length<2)return{rows:[],errors:['statement-too-short']};
  const head=lines[0]!;
  const delim=[',',';','\t'].reduce((a,b)=>(head.split(b).length>head.split(a).length?b:a),',');
  const header=splitLine(head,delim).map(normKey);
  const idx:{[k in keyof typeof COLS]:number}={tracking:-1,courier:-1,status:-1,cod:-1,fee:-1,date:-1};
  (Object.keys(COLS) as Array<keyof typeof COLS>).forEach(k=>{
    idx[k]=header.findIndex(h=>COLS[k].includes(h));
  });
  if(idx.tracking<0||idx.status<0)return{rows:[],errors:['missing-tracking-or-status-column']};
  const rows:StatementRow[]=[];const errors:string[]=[];
  lines.slice(1).forEach((line,i)=>{
    const c=splitLine(line,delim);
    const tracking=(c[idx.tracking]??'').trim();
    const status=STATUS_MAP(c[idx.status]??'');
    if(!tracking||!status){errors.push(`row-${i+2}`);return;}
    rows.push({
      tracking,
      courier:(idx.courier>=0?c[idx.courier]:'')||'',
      status,
      cod:idx.cod>=0?num(c[idx.cod]??''):null,
      fee:idx.fee>=0?num(c[idx.fee]??''):null,
      date:idx.date>=0?normDate(c[idx.date]??''):null,
    });
  });
  return{rows,errors};
}

// Status rank prevents a later statement from rolling a shipment backwards
// (e.g. marking a remitted shipment as merely delivered).
const RANK:Record<StatementStatus,number>={in_transit:0,delivered:1,rto:1,remitted:2};

export function applyCourierStatement(d:WorkspaceData,rows:StatementRow[],file='courier-statement.csv'):StatementResult{
  const res:StatementResult={updated:0,skipped:0,matched:0,unmatched:[]};
  rows.forEach(r=>{
    const sh=d.shipments.find(x=>x.tracking.trim().toLowerCase()===r.tracking.trim().toLowerCase());
    if(!sh){res.unmatched.push(r.tracking);return;}
    res.matched++;
    if(r.courier)sh.courier=r.courier;
    if(r.fee!==null)sh.fee=r.fee;
    let changed=false;
    if(r.status!==sh.status&&RANK[r.status]>=RANK[sh.status]){sh.status=r.status;changed=true;}
    if(r.status==='delivered'&&!sh.deliveredAt)sh.deliveredAt=r.date??C.todayISO();
    if(r.status==='rto')sh.deliveredAt=sh.deliveredAt??(r.date??undefined);
    if(r.status==='remitted'){
      const amount=r.cod??sh.codAmount;
      if(sh.remittedAmount!==amount){sh.remittedAmount=amount;changed=true;}
      sh.remittedAt=sh.remittedAt??(r.date??C.todayISO());
      if(!sh.deliveredAt)sh.deliveredAt=r.date??C.todayISO();
    }
    if(changed)res.updated++;else res.skipped++;
  });
  d.imports.push({
    id:Math.max(0,...d.imports.map(i=>i.id))+1,
    t:C.todayISO(),
    kind:'courier-statement',
    file,
    outcome:`${res.updated} updated, ${res.skipped} unchanged, ${res.unmatched.length} not found`,
    summary:`Matched ${res.matched} of ${rows.length} statement rows to recorded shipments.`,
  });
  if(res.unmatched.length)d.N.unshift({id:d.nid++,text:`Courier statement: ${res.unmatched.length} tracking number(s) not found in recorded shipments.`,read:false});
  return res;
}
