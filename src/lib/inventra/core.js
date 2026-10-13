const Core = (() => {
'use strict';
const DAY=864e5,mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;

/* ---------- dates: calendar days as 'YYYY-MM-DD', computed in UTC so DST/timezones can't shift them ---------- */
function parseISO(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;const t=Date.UTC(+s.slice(0,4),+s.slice(5,7)-1,+s.slice(8,10));return new Date(t).toISOString().slice(0,10)===s?t:null}
const toISO=t=>new Date(t).toISOString().slice(0,10);
const addDays=(s,n)=>toISO(parseISO(s)+n*DAY);
const diffDays=(a,b)=>Math.round((parseISO(b)-parseISO(a))/DAY);
const todayISO=(d=new Date())=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');

/* ---------- time-indexed demand history ---------- */
/* records: [{pid,date,qty}] -> dense daily array from start..end inclusive, zero-filled. */
function dailySeries(records,pid,start,end){const n=diffDays(start,end)+1;if(!(n>0))return[];const a=Array(n).fill(0);for(const r of records){if(r.pid!==pid)continue;const i=diffDays(start,r.date);if(i>=0&&i<n)a[i]+=r.qty}return a}

/* ---------- forecast methods (all use ONLY the series passed in) ---------- */
const METHODS={
 naive:{min:1,fn:(s,h)=>Array(h).fill(s[s.length-1])},
 ma7:{min:7,fn:(s,h)=>Array(h).fill(mean(s.slice(-7)))},
 ma14:{min:14,fn:(s,h)=>Array(h).fill(mean(s.slice(-14)))},
 ma28:{min:28,fn:(s,h)=>Array(h).fill(mean(s.slice(-28)))},
 /* average of the same weekday over the last 4 weeks (series must end the day before the forecast starts) */
 seasonal4:{min:28,fn:(s,h)=>Array.from({length:h},(_,k)=>{const t=s.length,w0=Math.floor(k/7)+1;return mean([0,1,2,3].map(j=>s[t+k-7*(w0+j)]))})}
};
function forecast(s,h,method){const M=METHODS[method];if(!M||s.length<M.min)return null;return M.fn(s,h).map(v=>Math.max(0,v))}

/* Rolling-origin backtest: for each origin t, forecast s[t..t+h) from s[0..t) only. Same origins for every method. */
function backtest(s,{h=7,minTrain=28,methods=Object.keys(METHODS)}={}){const out={};
 for(const m of methods){let ae=0,act=0,aeT=0,actT=0,bias=0,n=0,se=0,c=0;
  for(let t=Math.max(minTrain,METHODS[m].min);t+h<=s.length;t++){const f=forecast(s.slice(0,t),h,m);let ft=0,at=0;
   for(let i=0;i<h;i++){const e=f[i]-s[t+i];ae+=Math.abs(e);act+=s[t+i];se+=e*e;c++;ft+=f[i];at+=s[t+i]}
   aeT+=Math.abs(ft-at);actT+=at;bias+=ft-at;n++}
  out[m]=n?{n,dailyWape:act?ae/act:null,wape:actT?aeT/actT:null,bias:bias/n,rmse:Math.sqrt(se/c)}:null}
 return out}

/* Weekly pattern: share of variance explained by weekday (eta^2) AND the seasonal method must beat the flat average in backtest. Thresholds are heuristics. */
function weeklyPattern(s,bt){if(s.length<28)return{detected:false,eta2:null,reason:'Needs at least 28 days.'};
 const g=Array.from({length:7},()=>[]);s.forEach((v,i)=>g[i%7].push(v));const m=mean(s),sst=s.reduce((a,v)=>a+(v-m)**2,0);
 const ssb=g.reduce((a,x)=>a+x.length*(mean(x)-m)**2,0),eta2=sst?ssb/sst:0,a=bt&&bt.seasonal4,b=bt&&bt.ma14;
 return{eta2,detected:eta2>=0.15&&!!a&&!!b&&a.dailyWape!=null&&b.dailyWape!=null&&a.dailyWape<b.dailyWape*0.95}}

/* Choose a method from this product's own backtest. Selected on DAILY error (lead times rarely span whole weeks). Default ma14 unless another method is >=5% better with >=8 backtest windows. */
function chooseForecast(s,h=30){
 if(s.length<14)return{ok:false,reason:'Needs at least 14 days of dated sales history ('+s.length+' available).'};
 const bt=backtest(s,{h:7}),ref=bt.ma14,enough=!!ref&&ref.n>=8,warnings=[];let method='ma14';
 if(enough){const best=Object.entries(bt).filter(([,v])=>v&&v.dailyWape!=null).sort((x,y)=>x[1].dailyWape-y[1].dailyWape)[0];
  if(best&&best[0]!==method&&ref.dailyWape!=null&&best[1].dailyWape<ref.dailyWape*0.95)method=best[0]}
 else warnings.push('History too short to measure forecast accuracy (fewer than 8 backtest windows); using the 14-day average.');
 const w=weeklyPattern(s,bt);
 const sigma=enough?bt[method].rmse:Math.sqrt(mean(s.slice(-14).map(v=>(v-mean(s.slice(-14)))**2)));
 if(!enough)warnings.push('Safety stock uses demand variability, not measured forecast error.');
 return{ok:true,method,daily:forecast(s,h,method),sigma,weekly:w,warnings,
  accuracy:enough?{wapeDaily:bt[method].dailyWape,wape7d:bt[method].wape,windows:bt[method].n,basis:"rolling-origin backtest on this product's own history; not a guarantee of future accuracy"}:null,backtest:bt}}

/* ---------- restocking ---------- */
const Z=[[.5,0],[.8,.8416],[.9,1.2816],[.95,1.6449],[.97,1.8808],[.98,2.0537],[.99,2.3263]];
function zForService(p){if(p<=.5)return 0;if(p>=.99)return 2.3263;for(let i=1;i<Z.length;i++)if(p<=Z[i][0]){const[a,b]=[Z[i-1],Z[i]];return a[1]+(b[1]-a[1])*(p-a[0])/(b[0]-a[0])}}
function recommend(i){
 const{onHand,openPO=0,pendingQty=0,leadDays,coverDays=14,serviceLevel=.95,forecast:F,moq=0,packSize=1,maxLevel=null,shelfLifeDays=null}=i,W=[],R=[];
 if(!F||!F.ok)return{action:'no_forecast',qty:0,reasons:[(F&&F.reason)||'No forecast available.'],warnings:[]};
 if(!(leadDays>=0))return{action:'no_forecast',qty:0,reasons:['Lead time is missing for this product/supplier.'],warnings:[]};
 const f=F.daily,at=k=>k<f.length?f[k]:f[f.length-1],sum=(a,b)=>{let t=0;for(let k=a;k<b;k++)t+=at(k);return t};
 const L=Math.ceil(leadDays),ss=zForService(serviceLevel)*F.sigma*Math.sqrt(Math.max(L,1)),dLead=sum(0,L),rop=dLead+ss,pos=onHand+openPO;
 let cum=0,cover=null;for(let k=0;k<f.length;k++){cum+=f[k];if(cum>=onHand){cover=f[k]>0?k+(onHand-(cum-f[k]))/f[k]:k;break}}
 const base={reorderPoint:Math.ceil(rop),safetyStock:Math.ceil(ss),position:pos,daysOfCover:cover,leadDays:L};
 if(pendingQty>0)W.push(pendingQty+' units are already requested and awaiting approval (not counted in stock position).');
 if(pos>rop)return{...base,action:'none',qty:0,reasons:['Stock position ('+pos+') is above the reorder point ('+Math.ceil(rop)+').'],warnings:W};
 const upTo=sum(0,L+coverDays)+ss;let need=upTo-pos;
 R.push('Order-up-to level '+Math.ceil(upTo)+' = forecast demand over lead time + '+coverDays+' days ('+Math.round(sum(0,L+coverDays))+') + safety stock ('+Math.ceil(ss)+'); position is '+pos+' (on hand '+onHand+' + open orders '+openPO+').');
 if(shelfLifeDays!=null){const sellable=sum(L,L+shelfLifeDays)-Math.max(0,pos-dLead);if(need>sellable){need=Math.max(0,sellable);W.push('Quantity limited so new stock can sell within its '+shelfLifeDays+'-day shelf life.')}}
 if(need<=0)return{...base,action:'review',qty:0,reasons:R,warnings:[...W,'Stock is at or below the reorder point but the shelf-life limit leaves no sellable room. Review manually.']};
 let q=Math.ceil(need);if(packSize>1)q=Math.ceil(q/packSize)*packSize;
 if(moq>q){W.push('Raised to the supplier minimum order ('+moq+'), '+(moq-q)+' more than the calculated need.');q=packSize>1?Math.ceil(moq/packSize)*packSize:moq}
 if(maxLevel!=null&&pos+q>maxLevel)W.push('Order would bring stock position to '+(pos+q)+', above the maximum level ('+maxLevel+').');
 return{...base,action:'order',qty:q,orderUpTo:Math.ceil(upTo),reasons:R,warnings:W,needsReview:W.length>0}}

/* ---------- ledger integrity ---------- */
const OPEN_PO=['Approved','Sent to Supplier','Confirmed','Partially Received'],PENDING='Pending Approval';
const openPOQty=(reqs,pid)=>reqs.filter(r=>r.pid===pid&&OPEN_PO.includes(r.status)).reduce((a,r)=>a+r.qty-(r.got||0),0);
/* state: {products:[{id,stock,archived}], sales:[{pid,date,qty}], movements:[], requests:[]} ; mutates only on success */
function recordSale(st,{pid,date,qty,who='',today=todayISO()}){
 const p=st.products.find(x=>x.id===pid);if(!p||p.archived)return{ok:false,error:'Unknown or archived product.'};
 if(parseISO(date)==null)return{ok:false,error:'Date must be a valid YYYY-MM-DD.'};if(date>today)return{ok:false,error:'Sale date cannot be in the future.'};
 if(!(typeof qty==='number'&&isFinite(qty)&&qty>0))return{ok:false,error:'Quantity must be a positive number.'};
 if(qty>p.stock)return{ok:false,error:'Only '+p.stock+' units in stock.'};
 p.stock-=qty;const r=st.sales.find(x=>x.pid===pid&&x.date===date);if(r)r.qty+=qty;else st.sales.push({pid,date,qty});
 st.movements.unshift({pid,date,type:'Sale',qty:-qty,who});return{ok:true}}
function canDeleteProduct(st,pid){const b=st.requests.filter(r=>r.pid===pid&&(OPEN_PO.includes(r.status)||r.status===PENDING)).map(r=>'Request #'+r.id+' is '+r.status);return{ok:b.length===0,blockers:b}}
function archiveProduct(st,pid,today=todayISO()){const c=canDeleteProduct(st,pid);if(!c.ok)return{ok:false,error:'Resolve open orders first: '+c.blockers.join('; ')};const p=st.products.find(x=>x.id===pid);if(!p)return{ok:false,error:'Unknown product.'};p.archived=true;p.archivedOn=today;return{ok:true}}

/* ---------- CSV import: mapping, row-level validation, strategies ---------- */
function detectDelimiter(text){const first=String(text).replace(/^\uFEFF/,'').split(/\r?\n/)[0]||'';const c=[',',';','\t'].map(d=>[d,first.split(d).length-1]).sort((x,y)=>y[1]-x[1])[0];return c[1]>0?c[0]:','}
function parseCSV(text,delim=','){text=String(text).replace(/^\uFEFF/,'');const rows=[];let row=[],f='',q=false;
 for(let i=0;i<text.length;i++){const c=text[i];
  if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++}else q=false}else f+=c}
  else if(c==='"')q=true;else if(c===delim){row.push(f);f=''}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(f);rows.push(row);row=[];f=''}else f+=c}
 if(q)throw new Error('A quoted value is never closed (missing closing quote).');if(f!==''||row.length){row.push(f);rows.push(row)}
 return rows.filter(r=>r.some(x=>x.trim()!==''))}
function checkCSVText(text){if(typeof text!=='string'||!text.trim())return{ok:false,error:'The file is empty.'};
 if(text.indexOf('\u0000')>=0||text.slice(0,2)==='PK'||text.slice(0,4)==='%PDF')return{ok:false,error:'This does not look like a text CSV file (it may be an Excel, PDF or other binary file). In Excel use Save As > CSV.'};return{ok:true}}
const FIELDS={
 products:[['sku','SKU',1],['name','Product name',1],['onhand','On-hand quantity',1],['category','Category',0],['cost','Unit cost',0],['price','Selling price',0],['min','Minimum level',0],['lead','Lead time (days)',0],['moq','Minimum order qty',0],['pack','Pack size',0],['max','Maximum level',0],['shelf','Shelf life (days)',0]],
 sales:[['sku','SKU',1],['date','Date (YYYY-MM-DD)',1],['qty','Quantity sold',1]]};
const ALIAS={sku:['sku','itemcode','productcode','productid','id'],name:['name','productname','product','description'],date:['date','day','saledate'],qty:['qty','quantity','units','unitssold','quantitysold'],onhand:['onhand','stock','quantityonhand','instock'],cost:['cost','unitcost'],price:['price','sellingprice'],min:['minlevel','min','minimum','reorderlevel'],lead:['leaddays','leadtime','leadtimedays'],moq:['moq','minorder','minimumorderquantity','minorderqty'],pack:['packsize','pack'],max:['maxlevel','max','maximum'],shelf:['shelflifedays','shelflife'],category:['category','cat']};
const normH=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
function detectMapping(header,kind){const mp={},used=new Set();for(const[k]of FIELDS[kind]){const i=header.findIndex((h,j)=>!used.has(j)&&ALIAS[k].includes(normH(h)));if(i>=0){mp[k]=i;used.add(i)}}return mp}
function readCSV(text){const c=checkCSVText(text);if(!c.ok)throw new Error(c.error);const delim=detectDelimiter(text),rows=parseCSV(text,delim);
 if(!rows.length)throw new Error('The file has no rows.');return{delim,header:rows[0].map(x=>x.trim()),rows:rows.slice(1)}}
/* Shared front half of both validators: read, map, check columns/row widths. */
function prep(text,kind,mapping){let t;try{t=readCSV(text)}catch(e){return{fail:[{row:0,field:null,msg:e.message}]}}
 const mp=mapping||detectMapping(t.header,kind),errors=[],warnings=[];
 const bad=Object.values(mp).filter(i=>!(i>=0&&i<t.header.length));if(bad.length)return{fail:[{row:1,field:null,msg:'The column mapping points to a column that does not exist.'}]};
 if(new Set(Object.values(mp)).size!==Object.values(mp).length)return{fail:[{row:1,field:null,msg:'Two fields are mapped to the same CSV column.'}]};
 const miss=FIELDS[kind].filter(f=>f[2]&&!(f[0] in mp)).map(f=>f[1]);if(miss.length)return{fail:[{row:1,field:null,msg:'Required column(s) not found or not mapped: '+miss.join(', ')+'.'}],header:t.header};
 if(!t.rows.length)return{fail:[{row:2,field:null,msg:'The file has a header but no data rows.'}],header:t.header};
 const mapped=new Set(Object.values(mp));t.header.forEach((h,i)=>{if(!mapped.has(i))warnings.push({row:1,field:h,msg:'Column "'+h+'" is not used and was ignored.'})});
 const objs=[];t.rows.forEach((r,i)=>{const n=i+2;if(r.length!==t.header.length){errors.push({row:n,field:null,msg:'Row has '+r.length+' values but the header has '+t.header.length+'. Check for a stray comma or a missing value.'});return}
  objs.push({_row:n,...Object.fromEntries(Object.entries(mp).map(([k,j])=>[k,r[j].trim()]))})});
 return{t,mp,errors,warnings,objs}}
const num=s=>/^\d+(\.\d+)?$/.test(s)?+s:NaN;
const numMsg=(label,v)=>label+' "'+v+'" is not a valid number. Use digits with "." for decimals, no currency symbols or thousands separators, and not negative.';
function validateSalesCSV(text,{skuToPid,today=todayISO(),mapping}){const P=prep(text,'sales',mapping);if(P.fail)return{records:[],errors:P.fail,warnings:[],info:{}};
 const{errors,warnings,objs}=P,agg=new Map(),lower={};for(const k in skuToPid)lower[k.toLowerCase()]=k;let dup=0;const unknown=new Set();
 for(const r of objs){const pid=skuToPid[r.sku],q=num(r.qty);let bad=null,field=null;
  if(!r.sku){bad='SKU is empty.';field='sku'}else if(pid===undefined){unknown.add(r.sku);field='sku';bad='Unknown SKU "'+r.sku+'"'+(lower[r.sku.toLowerCase()]?' (did you mean "'+lower[r.sku.toLowerCase()]+'"?)':' - import your products first.')}
  else if(parseISO(r.date)==null){field='date';bad='Date "'+r.date+'" must be a real date written as YYYY-MM-DD (for example 2026-03-07).'}
  else if(r.date>today){field='date';bad='Date '+r.date+' is in the future.'}
  else if(!isFinite(q)){field='qty';bad=numMsg('Quantity',r.qty)}
  if(bad){errors.push({row:r._row,field,msg:bad});continue}
  const k=pid+'|'+r.date;if(agg.has(k)){agg.get(k).qty+=q;dup++}else agg.set(k,{pid,date:r.date,qty:q})}
 errors.sort((a,b)=>a.row-b.row);
 const records=[...agg.values()],ds=records.map(x=>x.date).sort(),span=ds.length?diffDays(ds[0],ds[ds.length-1])+1:0;
 if(records.length&&span<14)warnings.push({row:0,field:null,msg:'The file covers only '+span+' day(s). Forecasts need at least 14 days of history per product.'});
 return{records,errors,warnings,info:{rows:objs.length+0,accepted:objs.length-errors.filter(e=>e.row>1&&objs.some(o=>o._row===e.row)).length,mergedSameDay:dup,from:ds[0]||null,to:ds[ds.length-1]||null,spanDays:span,unknownSkus:[...unknown]}}}
/* Re-importing the same file is idempotent: imported (pid,date) pairs replace existing ones. */
function mergeSales(existing,incoming){const keys=new Set(incoming.map(r=>r.pid+'|'+r.date));return existing.filter(r=>!keys.has(r.pid+'|'+r.date)).concat(incoming)}
const NUMF=[['cost','cost','Unit cost'],['price','price','Selling price'],['min','minLevel','Minimum level'],['lead','leadDays','Lead time (days)'],['moq','moq','Minimum order qty'],['pack','packSize','Pack size'],['max','maxLevel','Maximum level'],['shelf','shelfLifeDays','Shelf life (days)']];
function validateProductsCSV(text,{existingSkus=[],existingNames={},mapping,allowExisting=false}={}){const P=prep(text,'products',mapping);if(P.fail)return{products:[],errors:P.fail,warnings:[],info:{header:P.header}};
 const{errors,warnings,objs}=P,out=[],ex=new Set(existingSkus),exLower=new Map(existingSkus.map(s=>[s.toLowerCase(),s])),seen=new Set(),seenLower=new Map(),names=new Map();
 for(const r of objs){const e=[],E=(field,msg)=>e.push({row:r._row,field,msg});
  if(!r.sku)E('sku','SKU is blank. Every product needs a unique SKU.');
  else if(seen.has(r.sku))E('sku','SKU "'+r.sku+'" appears more than once in this file.');
  else if(ex.has(r.sku)&&!allowExisting)E('sku','SKU "'+r.sku+'" already exists in your workspace.');
  if(!r.name)E('name','Product name is blank.');
  const p={sku:r.sku,name:r.name,category:r.category||'',onHand:num(r.onhand)};if(!isFinite(p.onHand))E('onhand',numMsg('On-hand quantity',r.onhand));
  for(const[k,f,label]of NUMF)if(k in r&&r[k]!==''){const v=num(r[k]);if(!isFinite(v))E(f,numMsg(label,r[k]));else p[f]=v}
  if(p.packSize===0)E('packSize','Pack size must be at least 1.');
  if(e.length){errors.push(...e);continue}
  seen.add(r.sku);if(ex.has(r.sku))p.existing=true;
  const l=exLower.get(r.sku.toLowerCase())||seenLower.get(r.sku.toLowerCase());seenLower.set(r.sku.toLowerCase(),r.sku);if(l&&l!==r.sku)warnings.push({row:r._row,field:'sku',msg:'SKU "'+r.sku+'" differs only by letter case from SKU "'+l+'". They are treated as different products.'});
  const nk=r.name.toLowerCase();if(names.has(nk))warnings.push({row:r._row,field:'name',msg:'Product name "'+r.name+'" is also used by SKU "'+names.get(nk)+'" in this file.'});else names.set(nk,r.sku);
  if(existingNames[nk]&&existingNames[nk]!==r.sku)warnings.push({row:r._row,field:'name',msg:'Product name "'+r.name+'" is already used by existing SKU "'+existingNames[nk]+'".'});
  if(p.price!=null&&p.cost!=null&&p.price<p.cost)warnings.push({row:r._row,field:'price',msg:'Selling price is below unit cost.'});
  if(p.minLevel!=null&&p.maxLevel!=null&&p.maxLevel>0&&p.minLevel>p.maxLevel)warnings.push({row:r._row,field:'minLevel',msg:'Minimum level is above maximum level.'});
  out.push(p)}
 errors.sort((a,b)=>a.row-b.row);return{products:out,errors,warnings,info:{rows:objs.length,header:P.t.header}}}
/* Convert an imported product to the stored product shape. Expiry is not imported (999 = none). Missing optional values stay absent, never invented. */
function toStored(p){const o={sku:p.sku,name:p.name,cat:p.category||'Uncategorised',wh:'Main',stock:p.onHand,min:p.minLevel??0,max:p.maxLevel??0,cost:p.cost??0,price:p.price??0,exp:999,bc:'',src:'import'};
 if(p.leadDays!=null)o.lead=p.leadDays;if(p.moq!=null)o.moq=p.moq;if(p.packSize!=null)o.pack=p.packSize;if(p.shelfLifeDays!=null)o.shelf=p.shelfLifeDays;return o}
/* strategy 'add': only new SKUs are created, matched SKUs are skipped. 'update': matched SKUs get the fields PRESENT in the file; on-hand only if overwriteStock. */
function planProductImport(existing,incoming,{strategy='add',overwriteStock=false}={}){const bySku=new Map(existing.map(p=>[p.sku,p])),plan={add:[],update:[],skipped:[],unchanged:0,stockChanges:[]};
 const fieldsOf=p=>{const o=toStored(p),f={name:o.name,cat:p.category!==''?o.cat:undefined,min:p.minLevel!=null?o.min:undefined,max:p.maxLevel!=null?o.max:undefined,cost:p.cost!=null?o.cost:undefined,price:p.price!=null?o.price:undefined,lead:o.lead,moq:o.moq,pack:o.pack,shelf:o.shelf};return f};
 for(const p of incoming){const cur=bySku.get(p.sku);
  if(!cur){plan.add.push(toStored(p));continue}
  if(strategy!=='update'){plan.skipped.push(p.sku);continue}
  const changes=[];for(const[k,v]of Object.entries(fieldsOf(p)))if(v!==undefined&&cur[k]!==v)changes.push({field:k,from:cur[k],to:v});
  if(overwriteStock&&cur.stock!==p.onHand){changes.push({field:'stock',from:cur.stock,to:p.onHand});plan.stockChanges.push({sku:p.sku,from:cur.stock,to:p.onHand})}
  if(changes.length)plan.update.push({sku:p.sku,pid:cur.id,changes});else plan.unchanged++}
 return plan}
/* Mutates `st` (call on a state you can roll back). */
function applyProductPlan(st,plan,{who='',t=''}={}){let next=Math.max(0,...st.products.map(p=>p.id),...(st.archived||[]).map(p=>p.id))+1;const added=[];
 for(const o of plan.add){const p={...o,id:next++};st.products.push(p);(st.px=st.px||{})[p.id]={};added.push(p.id)}
 for(const u of plan.update){const p=st.products.find(x=>x.id===u.pid);for(const c of u.changes){if(c.field==='stock'){const d=c.to-p.stock;p.stock=c.to;st.movements.unshift({pid:p.id,t,type:'Adjustment',q:d,who,note:'Stock set by CSV import'})}else p[c.field]=c.to}}
 return{added}}
const hashData=o=>{const s=JSON.stringify(o);let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}return h.toString(16)+':'+s.length};

/* ---------- backup / restore / saved-data validation ---------- */
const DATA_KEYS=['P','archived','SR','mv','R','N','snooze','watch','alerts','px','imports','settings','nid','rid'];
const PFIELDS=['id','sku','name','cat','wh','stock','min','max','cost','price','exp','lead','bc','moq','pack','shelf','src','archived','archivedOn'];
const PO_STATUS=['Pending Approval','Approved','Sent to Supplier','Confirmed','Partially Received','Received','Rejected','Cancelled'];
const LIM={P:20000,SR:500000};
function validateData(d){const err=[],warn=[],E=m=>err.length<50?err.push(m):0;
 if(!d||typeof d!=='object'||Array.isArray(d))return{errors:['The data section is missing.'],warnings:[],summary:{}};
 for(const k of['P','SR'])if(!Array.isArray(d[k]))E('"'+k+'" must be a list.');
 for(const k of['archived','mv','R','N','imports'])if(d[k]!==undefined&&!Array.isArray(d[k]))E('"'+k+'" must be a list.');
 if(err.length)return{errors:err,warnings:warn,summary:{}};
 if(d.P.length>LIM.P||d.SR.length>LIM.SR)E('The data is larger than this version supports.');
 const ids=new Set(),skus=new Set(),all=[...d.P,...(d.archived||[])];
 const fin=v=>typeof v==='number'&&isFinite(v)&&v>=0;
 all.forEach((p,i)=>{const w='Product #'+(i+1);if(!p||typeof p!=='object')return E(w+' is not an object.');
  if(!Number.isInteger(p.id)||p.id<=0)E(w+': id must be a positive whole number.');else if(ids.has(p.id))E(w+': duplicate id '+p.id+'.');else ids.add(p.id);
  if(typeof p.name!=='string'||!p.name.trim())E(w+': name is missing.');
  if(typeof p.sku!=='string'||!p.sku.trim())E(w+': SKU is missing.');else if(i<d.P.length){if(skus.has(p.sku))E(w+': duplicate SKU "'+p.sku+'".');skus.add(p.sku)}
  for(const f of['stock','min','max','cost','price','exp'])if(!fin(p[f]))E(w+': '+f+' must be a number of at least 0.');
  if(p.lead!=null&&!fin(p.lead))E(w+': lead must be a number of at least 0.');
  for(const f of['cat','wh'])if(p[f]!=null&&typeof p[f]!=='string')E(w+': '+f+' must be text.')});
 const seen=new Set();let lo=null,hi=null;
 d.SR.forEach((r,i)=>{if(!r||typeof r!=='object')return E('Sales record #'+(i+1)+' is not an object.');
  if(!ids.has(r.pid))E('Sales record #'+(i+1)+' refers to an unknown product.');if(parseISO(r.date)==null)E('Sales record #'+(i+1)+': invalid date.');
  else{lo=lo===null||r.date<lo?r.date:lo;hi=hi===null||r.date>hi?r.date:hi}
  if(!fin(r.qty))E('Sales record #'+(i+1)+': quantity must be a number of at least 0.');
  const k=r.pid+'|'+r.date;if(seen.has(k))E('Sales record #'+(i+1)+': duplicate product/date.');seen.add(k)});
 (d.R||[]).forEach((r,i)=>{if(!r||!ids.has(r.pid))E('Order #'+(i+1)+' refers to an unknown product.');else{if(!(typeof r.qty==='number'&&r.qty>0))E('Order #'+(i+1)+': quantity must be positive.');if(!PO_STATUS.includes(r.status))E('Order #'+(i+1)+': unknown status.');if(r.got!=null&&!(r.got>=0&&r.got<=r.qty))E('Order #'+(i+1)+': received quantity is out of range.')}});
 (d.mv||[]).forEach((m,i)=>{if(!m||!ids.has(m.pid)||typeof m.q!=='number'||!isFinite(m.q))E('Movement #'+(i+1)+' is invalid.')});
 return{errors:err,warnings:warn,summary:{products:d.P.length,archived:(d.archived||[]).length,sales:d.SR.length,salesFrom:lo,salesTo:hi,movements:(d.mv||[]).length,requests:(d.R||[]).length,imports:(d.imports||[]).length}}}
function buildBackup(S,{workspace,now}){const data={};for(const k of DATA_KEYS)data[k]=S[k];return{app:'Inventra',format:'inventra-backup',schemaVersion:1,workspace,exportedAt:now,data}}
function validateBackup(o){const errors=[],warnings=[];if(!o||typeof o!=='object'||o.format!=='inventra-backup'||o.app!=='Inventra')return{ok:false,errors:['This is not an Inventra backup file.'],warnings,summary:{}};
 if(typeof o.schemaVersion!=='number'||o.schemaVersion>1||o.schemaVersion<1)errors.push('Unsupported backup version '+o.schemaVersion+' (this version of Inventra reads version 1).');
 if(o.workspace!=='biz')errors.push(o.workspace==='demo'?'This backup comes from the Demo workspace. Only Business workspace backups can be restored.':'The backup does not say which workspace it belongs to.');
 const v=validateData(o.data);errors.push(...v.errors);warnings.push(...v.warnings);return{ok:!errors.length,errors,warnings,summary:{...v.summary,workspace:o.workspace,exportedAt:o.exportedAt}}}
/* Whitelist copy: unknown keys (including __proto__ tricks) never reach the live state. */
function restoreData(d){const cp=x=>JSON.parse(JSON.stringify(x)),pick=p=>{const o={};for(const f of PFIELDS)if(p[f]!==undefined)o[f]=p[f];return o};
 return{P:d.P.map(pick),archived:(d.archived||[]).map(pick),SR:d.SR.map(r=>({pid:r.pid,date:r.date,qty:r.qty})),mv:cp(d.mv||[]),R:cp(d.R||[]),N:cp(d.N||[]),snooze:cp(d.snooze||{}),watch:cp(d.watch||[]),alerts:cp(d.alerts||[]),px:{},imports:cp(d.imports||[]).map(i=>({...i,undo:undefined})),settings:{currency:/^[A-Z]{3}$/.test(d.settings&&d.settings.currency)?d.settings.currency:'USD'},nid:Number.isInteger(d.nid)?d.nid:1,rid:Number.isInteger(d.rid)?d.rid:1}}

return{parseISO,addDays,diffDays,todayISO,dailySeries,METHODS,forecast,backtest,weeklyPattern,chooseForecast,zForService,recommend,OPEN_PO,PENDING,openPOQty,recordSale,canDeleteProduct,archiveProduct,parseCSV,detectDelimiter,checkCSVText,FIELDS,detectMapping,readCSV,validateSalesCSV,mergeSales,validateProductsCSV,toStored,planProductImport,applyProductPlan,hashData,validateData,buildBackup,validateBackup,restoreData,DATA_KEYS}
})();
export default Core;
