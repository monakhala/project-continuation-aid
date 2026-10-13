/* ===== Workspaces, Data & Import page, CSV import wizard, backup/restore. UI layer only: parsing, validation and planning live in core.js. ===== */
let LOADERR=null,IW=null,RW=null;
const DEMO=()=>WS==='demo';
function seedBiz(){S={user:null,ver:2,ws:'biz',P:[],archived:[],SR:[],snooze:{},px:{},mv:[],R:[],N:[],watch:[],alerts:[],nid:1,rid:1,imports:[],settings:{currency:'USD'}}}
function fmtMoney(n){const c=(S&&S.settings&&S.settings.currency)||'USD';try{return new Intl.NumberFormat(undefined,{style:'currency',currency:c,maximumFractionDigits:2}).format(n)}catch(e){return c+' '+Number(n).toLocaleString(undefined,{maximumFractionDigits:2})}}
const stateHash=()=>C.hashData({P:S.P,archived:S.archived,SR:S.SR,mv:S.mv,R:S.R});
const dataSnap=()=>JSON.stringify(C.DATA_KEYS.reduce((o,k)=>(o[k]=S[k],o),{}));
function snapBack(j){const o=JSON.parse(j);C.DATA_KEYS.forEach(k=>{if(o[k]===undefined)delete S[k];else S[k]=o[k]})}
/* Run a change atomically: if anything throws or saving fails, memory is rolled back and storage keeps the previous good state. */
function commit(fn){const snap=dataSnap();try{const r=fn();if(!save())throw new Error('Saving failed: browser storage is full or blocked. Nothing was changed.');return{ok:true,r}}catch(e){snapBack(snap);return{ok:false,error:e.message||String(e)}}}
const dl=(name,text,mime)=>{const u=URL.createObjectURL(new Blob([text],{type:mime||'text/plain'})),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000)};
const emptyState=t=>`<h1>${esc(t)}</h1><div class="card empty">${DEMO()?'No products.':'No products yet. Import your products from a CSV file, or add one on the Inventory page.'}<p><button class="bt p" onclick="go('data')">Open Data &amp; Import</button></p></div>`;
function banner(){return DEMO()?`<div class="ins w" role="note"><b>DEMO DATA.</b> Sales, suppliers, prices and people here are simulated. Nothing reflects a real business.</div>`
 :`<div class="ins" role="note" style="border-color:var(--bl)"><b>BUSINESS WORKSPACE.</b> Your own data, stored only in this browser (not synced; export backups regularly). Roles are labels, not security. Supplier prices and ordering are demo-only for now.</div>${LOADERR?`<div class="ins w" role="alert">${esc(LOADERR)}</div>`:''}`}
const wsBadge=()=>`<span class="b ${DEMO()?'w':''}">${DEMO()?'Demo workspace':'Business workspace'}</span> <button class="bt s" onclick="switchWS('${DEMO()?'biz':'demo'}')">Switch to ${DEMO()?'Business':'Demo'}</button>`;
const wsPicker=()=>`<div class="bar" role="group" aria-label="Workspace">${[['demo','Demo workspace (simulated)'],['biz','Business workspace (your data)']].map(w=>`<button class="bt ${WS==w[0]?'p':''}" aria-pressed="${WS==w[0]}" onclick="switchWS('${w[0]}')">${w[1]}</button>`).join('')}</div>`;
function switchWS(w){if(w===WS)return;const u=S.user;save();WS=w;try{localStorage.setItem('inventra_ws',w)}catch(e){}IW=null;RW=null;load();if(u&&!S.user)S.user={role:(w==='biz'&&u.role==='supplier')?'manager':u.role,sup:u.sup||1};pg=S.user?NAV[S.user.role][0]:'dash';selP=(S.P[0]||{id:1}).id;render()}
function restockEmpty(){const ok=S.P.filter(p=>ch(p).ok).length,n=S.P.length;
 if(!n)return '<div class="card empty">No products yet. Import products in Data &amp; Import.</div>';
 if(!ok)return '<div class="card empty"><b>No recommendations yet.</b> No product has 14 days of dated sales history, so nothing can be forecast. Import sales history in Data &amp; Import or record sales.</div>';
 return `<div class="card empty">No restocking needed right now for the ${ok} product(s) that can be forecast.${ok<n?' '+(n-ok)+' product(s) cannot be forecast yet (fewer than 14 days of sales history).':''}</div>`}
function dashBiz(){const P=S.P;if(!P.length)return emptyState('Dashboard');const ok=P.filter(p=>ch(p).ok).length,rc=P.map(rec).filter(Boolean),ins=[];
 const K=[['Products',P.length],['Inventory value (at unit cost)',m$(P.reduce((a,p)=>a+p.stock*p.cost,0))],['At or below minimum',P.filter(p=>p.stock>0&&p.stock<=p.min).length],['Out of stock',P.filter(p=>p.stock==0).length],['Can be forecast',ok+' of '+P.length],['Restock suggestions',rc.filter(r=>!r.review).length]];
 P.forEach(p=>{const d=daysLeft(p);if(p.stock>0&&d!=null&&d<=7)ins.push(`${p.name} is forecast to run out in ${Math.round(d)} day(s).`)});
 const days=Array.from({length:30},(_,i)=>C.addDays(C.todayISO(),i-30)),by={};S.SR.forEach(r=>by[r.date]=(by[r.date]||0)+r.qty);
 if(S.SR.length)chart('c1','bar',days.map(d=>d.slice(5)),[{label:'Units sold',data:days.map(d=>by[d]||0),backgroundColor:'#1677ff'}]);
 return `<h1>Dashboard</h1><p class="sub">Figures come from the data you imported or entered. Forecasts need at least 14 days of dated sales per product.</p>${ok?'':'<div class="ins w" role="note"><b>No forecasts yet.</b> Import sales history (Data &amp; Import) to enable forecasts and restock suggestions. Current stock alone is not demand history.</div>'}
<div class="grid k4">${K.map(k=>`<div class="card kpi"><span>${k[0]}</span><b>${k[1]}</b></div>`).join('')}</div>
<div class="grid g2" style="margin-top:14px"><div class="card"><h3>Insights (rule-based)</h3>${ins.slice(0,6).map(i=>`<div class="ins w">${esc(i)}</div>`).join('')||'<div class="empty">Nothing urgent.</div>'}</div><div class="card"><h3>Units sold, last 30 days</h3>${S.SR.length?'<div class="cv"><canvas id="c1" role="img" aria-label="Units sold per day, last 30 days"></canvas></div>':'<div class="empty">No sales history imported yet.</div>'}</div></div>`}

/* ---------- Data & Import page ---------- */
const TPL={products:'sku,name,on_hand,category,unit_cost,selling_price,min_level,lead_time_days,moq,pack_size,max_level,shelf_life_days\nEXAMPLE-001,Example product (delete this row),24,Drinks,1.20,2.50,10,7,12,12,200,365\n',sales:'sku,date,quantity_sold\nEXAMPLE-001,2026-01-15,6\n'};
const dlTemplate=k=>dl('inventra-'+k+'-template.csv',TPL[k],'text/csv');
const issues=(L,n=100)=>L.length?`<div class="tw"><table class="er"><tr><th scope="col">Row</th><th scope="col">Field</th><th scope="col">Problem</th></tr>${L.slice(0,n).map(e=>`<tr><td>${e.row||'-'}</td><td>${esc(e.field||'')}</td><td>${esc(e.msg)}</td></tr>`).join('')}</table></div>${L.length>n?`<p class="sub">…and ${L.length-n} more.</p>`:''}`:'';
const csvCell=s=>'"'+String(s).replace(/"/g,'""')+'"';
const dlErrors=()=>dl('inventra-import-problems.csv','row,field,problem\n'+[...IW.result.errors,...IW.result.warnings.map(w=>({...w,msg:'WARNING: '+w.msg}))].map(e=>[e.row,e.field||'',csvCell(e.msg)].join(',')).join('\n'),'text/csv');
const STEPS=['Choose file','Match columns','Review','Confirm'];
function impKind(k){IW={kind:k,step:1};render()}
function impPick(inp){const f=inp.files&&inp.files[0];if(!f)return;IW.error=null;
 if(!/\.(csv|txt)$/i.test(f.name))return impFail('"'+f.name+'" is not a CSV file. Export your spreadsheet as CSV (Excel: File > Save As > CSV) and try again.');
 if(f.size>5e6)return impFail('This file is larger than 5 MB. Split it into smaller files.');
 IW.busy=true;render();const r=new FileReader();r.onerror=()=>impFail('The file could not be read.');r.onload=()=>impLoad(f.name,String(r.result));r.readAsText(f)}
function impFail(m){IW.busy=false;IW.error=m;render()}
function impLoad(name,text){IW.busy=true;render();setTimeout(()=>{impLoadNow(name,text);render()},15)}
function impLoadNow(name,text){IW.busy=false;IW.error=null;try{const t=C.readCSV(text);if(t.rows.length>1e5)throw new Error('This file has more than 100,000 rows. Split it into smaller files.');
 Object.assign(IW,{fileName:name,text,header:t.header,preview:t.rows.slice(0,8),total:t.rows.length,mapping:C.detectMapping(t.header,IW.kind),step:2,result:null,plan:null,ack:false,strategy:'add',overwrite:false})}catch(e){IW.error=e.message}}
function impMap(k,v){if(v==='')delete IW.mapping[k];else IW.mapping[k]=+v}
function impBack(){IW.step=Math.max(1,IW.step-1);IW.error=null;render()}
function impValidate(){IW.busy=true;render();setTimeout(()=>{impValidateNow();render()},15)}
function impValidateNow(){IW.busy=false;const k=IW.kind;
 IW.result=k==='products'?C.validateProductsCSV(IW.text,{existingSkus:S.P.map(p=>p.sku),existingNames:Object.fromEntries(S.P.map(p=>[p.name.toLowerCase(),p.sku])),mapping:IW.mapping,allowExisting:true})
  :C.validateSalesCSV(IW.text,{skuToPid:Object.fromEntries(S.P.map(p=>[p.sku,p.id])),mapping:IW.mapping});
 IW.step=3;IW.ack=false;impPlan()}
function impPlan(){if(IW.kind==='products'&&IW.result)IW.plan=C.planProductImport(S.P,IW.result.products,{strategy:IW.strategy,overwriteStock:IW.strategy==='update'&&IW.overwrite})}
const impStrategy=v=>{IW.strategy=v;if(v!=='update')IW.overwrite=false;impPlan();render()},impOverwrite=c=>{IW.overwrite=c;impPlan();render()},impAck=c=>{IW.ack=c;render()},impToConfirm=()=>{IW.step=4;render()};
function impCounts(){const r=IW.result;if(IW.kind==='products'){const p=IW.plan||{add:[],update:[],skipped:[]};return{todo:p.add.length+p.update.length}}
 const ex=new Set(S.SR.map(x=>x.pid+'|'+x.date)),rep=r.records.filter(x=>ex.has(x.pid+'|'+x.date)).length;return{todo:r.records.length,replaced:rep,added:r.records.length-rep}}
function impCommit(){const r=IW.result,errs=r.errors.length;if(errs&&!IW.ack)return toast('Tick the box to confirm that rows with errors will be skipped.',1);
 const kind=IW.kind,file=IW.fileName,strat=IW.strategy,c=impCounts(),pre=dataSnap(),when=new Date().toISOString();
 const out=commit(()=>{let summary;
  if(kind==='products'){const pl=IW.plan,res=C.applyProductPlan({products:S.P,archived:S.archived,movements:S.mv,px:S.px},pl,{who:WHO(),t:now()});
   summary=`Added ${pl.add.length}, updated ${pl.update.length}, skipped ${pl.skipped.length} existing, ${errs} row(s) rejected`+(pl.stockChanges.length?`; on-hand changed for ${pl.stockChanges.length}`:'')}
  else{S.SR=C.mergeSales(S.SR,r.records);summary=`${c.added} product-day(s) added, ${c.replaced} replaced (${r.info.from} to ${r.info.to}), ${errs} row(s) rejected; stock unchanged`}
  S.imports=S.imports||[];S.imports.forEach(i=>delete i.undo);
  const rec_={id:Math.max(0,...S.imports.map(i=>i.id))+1,t:when,kind,file,strategy:kind==='products'?strat:'replace days',outcome:'ok',summary};
  if(pre.length<1e6)rec_.undo={snap:pre,hash:stateHash()};S.imports.push(rec_);return summary});
 if(!out.ok){IW.error='Import failed and nothing was changed: '+out.error;IW.step=3;commit(()=>{S.imports=S.imports||[];S.imports.push({id:Math.max(0,...S.imports.map(i=>i.id))+1,t:when,kind,file,outcome:'failed',summary:out.error})});return render()}
 IW={kind,step:5,done:out.r};toast('Import complete');render()}
function impUndo(id){const rec_=(S.imports||[]).find(i=>i.id===id);if(!rec_||!rec_.undo)return toast('This import can no longer be undone.',1);
 if(stateHash()!==rec_.undo.hash)return toast('Data has changed since this import (sales, stock movements, orders or product edits), so undoing it would lose those changes. Export a backup, or restore an earlier backup instead.',1);
 if(!confirm('Undo this import? Products, sales and stock return to how they were before it.'))return;
 const keep=S.imports,out=commit(()=>{snapBack(rec_.undo.snap);S.imports=keep;rec_.outcome='undone';delete rec_.undo});
 if(!out.ok){S.imports=keep;return toast('Undo failed: '+out.error,1)}toast('Import undone');render()}
function impHTML(){const w=IW,k=w.kind;
 const steps=`<ol class="stp" aria-label="Import steps">${STEPS.map((s,i)=>`<li class="${w.step===i+1?'on':''}" ${w.step===i+1?'aria-current="step"':''}>${i+1}. ${s}</li>`).join('')}</ol>`;
 const err=w.error?`<div class="ins w" role="alert">${esc(w.error)}</div>`:'';
 if(w.busy)return steps+'<div class="empty" role="status" aria-live="polite">Processing file…</div>';
 if(w.step===5)return `<div class="ins" role="status"><b>Import complete.</b> ${esc(w.done)}</div><p><button class="bt p" onclick="impReset()">Import another file</button></p>`;
 if(w.step===1)return `${steps}${err}<fieldset><legend>What are you importing?</legend><label><input type="radio" name="ik" ${k==='products'?'checked':''} onchange="impKind('products')"> Products &amp; current stock levels</label><br><label><input type="radio" name="ik" ${k==='sales'?'checked':''} onchange="impKind('sales')"> Sales history (dated)</label>
 <p class="sub">${k==='products'?'One row per product with its current on-hand quantity. This is a stock snapshot, <b>not</b> sales history, and it will never create forecasts.':'One row per product per day: SKU, date (YYYY-MM-DD) and quantity sold. Products must already exist. Importing sales does <b>not</b> change stock.'}</p></fieldset>
 <p><label for="impfile">CSV file</label> <input id="impfile" type="file" accept=".csv,.txt,text/csv" onchange="impPick(this)"> <button class="bt s" onclick="dlTemplate('${k}')">Download template</button></p>
 <p class="sub">Required columns: ${C.FIELDS[k].filter(f=>f[2]).map(f=>f[1]).join(', ')}. Optional: ${C.FIELDS[k].filter(f=>!f[2]).map(f=>f[1]).join(', ')||'none'}. Comma, semicolon and tab separators are detected automatically.</p>`;
 if(w.step===2)return `${steps}${err}<p><b>${esc(w.fileName)}</b> · ${w.total} data row(s) · preview of the first ${w.preview.length}:</p><div class="tw"><table><tr>${w.header.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr>${w.preview.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>
 <h3 style="margin-top:14px">Match your columns to Inventra fields</h3><div class="fm">${C.FIELDS[k].map(f=>`<label for="map_${f[0]}">${f[1]}${f[2]?' (required)':''}<select id="map_${f[0]}" onchange="impMap('${f[0]}',this.value)"><option value="">- not used -</option>${w.header.map((h,i)=>`<option value="${i}" ${w.mapping[f[0]]===i?'selected':''}>${esc(h)}</option>`).join('')}</select></label>`).join('')}</div>
 <p style="margin-top:12px"><button class="bt" onclick="impBack()">Back</button> <button class="bt p" onclick="impValidate()">Check the data</button></p>`;
 const r=w.result,fatal=!r.products&&!r.records||(r.errors.length&&!(r.products||r.records).length&&r.errors[0].row<=1&&r.info&&!r.info.rows&&!r.info.accepted&&r.errors.length===1&&r.errors[0].row<=1);
 const n=(r.products||r.records).length;
 if(w.step===3)return `${steps}${err}<div class="grid k4"><div class="card kpi"><span>Rows OK</span><b>${n}</b></div><div class="card kpi"><span>Rows with errors (will be skipped)</span><b>${r.errors.length}</b></div><div class="card kpi"><span>Warnings</span><b>${r.warnings.length}</b></div></div>
 ${r.errors.length?`<h3 style="margin-top:12px">Errors</h3><p class="sub">These rows will not be imported. Fix them in your file and upload again, or continue with the valid rows.</p>${issues(r.errors)}`:'<div class="ins" role="status">No errors found.</div>'}
 ${r.warnings.length?`<details style="margin-top:10px" ${r.warnings.length<6?'open':''}><summary>${r.warnings.length} warning(s)</summary>${issues(r.warnings)}</details>`:''}
 <p style="margin-top:12px"><button class="bt" onclick="impBack()">Back</button> ${r.errors.length||r.warnings.length?'<button class="bt" onclick="dlErrors()">Download problem list (CSV)</button> ':''}<button class="bt p" ${n?'':'disabled'} onclick="impToConfirm()">Continue</button></p>`;
 const c=impCounts();let body;
 if(k==='products'){const p=w.plan;body=`<fieldset><legend>How should matching products be handled?</legend><p class="sub">Products are matched by <b>SKU</b> (exact, ignoring surrounding spaces).</p>
  <label><input type="radio" name="st" ${w.strategy==='add'?'checked':''} onchange="impStrategy('add')"> <b>Add new products only.</b> Products whose SKU already exists are left completely untouched.</label><br>
  <label><input type="radio" name="st" ${w.strategy==='update'?'checked':''} onchange="impStrategy('update')"> <b>Add new and update existing.</b> Existing products get the values in your file for the columns you mapped. Columns you did not map are not changed.</label><br>
  <label style="margin-left:22px"><input type="checkbox" ${w.strategy==='update'?'':'disabled'} ${w.overwrite?'checked':''} onchange="impOverwrite(this.checked)"> Also replace on-hand quantities of existing products (recorded as stock adjustments, never as sales)</label></fieldset>
  <p><b>This will:</b> add ${p.add.length} new product(s)${w.strategy==='update'?`, update ${p.update.length} existing product(s) (${p.unchanged} already identical)`:`, skip ${p.skipped.length} existing product(s)`}${p.stockChanges.length?`, <b class="up">change on-hand quantity for ${p.stockChanges.length} product(s)</b>`:'. Existing on-hand quantities will not change.'}</p>
  ${p.update.length?`<div class="tw"><table><tr><th scope="col">SKU</th><th scope="col">Field</th><th scope="col">Current</th><th scope="col">New</th></tr>${p.update.slice(0,8).flatMap(u=>u.changes.map(ch_=>`<tr><td>${esc(u.sku)}</td><td>${esc(ch_.field)}</td><td>${esc(ch_.from??'')}</td><td>${esc(ch_.to)}</td></tr>`)).slice(0,25).join('')}</table></div>${p.update.length>8?'<p class="sub">Showing the first products only.</p>':''}`:''}
  <p class="sub">Values come from your file and are not verified. Missing optional values stay empty (nothing is invented). Lead time and minimum order quantity are used as you entered them.</p>`}
 else body=`<p><b>This will:</b> add ${c.added} and <b class="up">replace ${c.replaced}</b> product-day record(s) between ${esc(r.info.from)} and ${esc(r.info.to)} (${r.info.spanDays} days). Existing days for the same product and date are overwritten by the file; re-importing the same file changes nothing. <b>Stock levels are not changed.</b></p><p class="sub">Forecasts need at least 14 days of history per product.</p>`;
 return `${steps}${err}${body}${r.errors.length?`<p><label><input type="checkbox" ${w.ack?'checked':''} onchange="impAck(this.checked)"> I understand that ${r.errors.length} row(s) with errors will be skipped and not imported.</label></p>`:''}
 <p><button class="bt" onclick="impBack()">Back</button> <button class="bt p" ${c.todo||0?'':'disabled'} onclick="impCommit()">Confirm import</button></p>`}
function impReset(){IW={kind:IW?IW.kind:'products',step:1};render()}

/* ---------- backup / restore ---------- */
const makeBackupText=()=>JSON.stringify(C.buildBackup(S,{workspace:WS,now:new Date().toISOString()}),null,1);
function exportBackup(){dl('inventra-'+WS+'-backup-'+C.todayISO()+'.json',makeBackupText(),'application/json');if(S.settings){S.settings.lastBackup=new Date().toISOString();save()}toast('Backup downloaded');render()}
function rsPick(inp){const f=inp.files&&inp.files[0];if(!f)return;if(!/\.json$/i.test(f.name)){RW={error:'Please choose an Inventra backup file (.json).'};return render()}
 if(f.size>5e7){RW={error:'This file is too large to be an Inventra backup.'};return render()}const r=new FileReader();r.onerror=()=>{RW={error:'The file could not be read.'};render()};r.onload=()=>{rsLoad(String(r.result));render()};r.readAsText(f)}
function rsLoad(text){let o;try{o=JSON.parse(text)}catch(e){RW={error:'This file is not valid JSON (it may be truncated or corrupted). Nothing was changed.'};return}
 RW={obj:o,v:C.validateBackup(o),ack:false}}
const rsAck=c=>{RW.ack=c;render()},rsReset=()=>{RW=null;render()};
function rsApply(){if(DEMO()||!RW||!RW.v.ok||!RW.ack)return;const prev=S;
 try{localStorage.setItem(KEYS.biz+'_prerestore',JSON.stringify(prev))}catch(e){return toast('Could not make a safety copy of your current data (storage full), so nothing was restored. Export a backup first.',1)}
 const d=C.restoreData(RW.obj.data);S=Object.assign({user:prev.user,ver:2,ws:'biz'},d);S.imports.push({id:Math.max(0,...S.imports.map(i=>i.id))+1,t:new Date().toISOString(),kind:'restore',file:'backup from '+(RW.obj.exportedAt||'unknown date'),outcome:'ok',summary:`Replaced workspace with backup: ${RW.v.summary.products} products, ${RW.v.summary.sales} sales records`});
 if(!save()){S=prev;return toast('Restore failed and nothing was changed.',1)}LOADERR=null;RW=null;toast('Backup restored');render()}
function rsUndo(){let raw=null;try{raw=localStorage.getItem(KEYS.biz+'_prerestore')}catch(e){}if(!raw)return toast('No pre-restore copy found.',1);
 let o;try{o=JSON.parse(raw)}catch(e){return toast('The saved copy is unreadable.',1)}if(C.validateData(o).errors.length)return toast('The saved copy failed validation.',1);
 if(!confirm('Go back to the data you had before the last restore? The restored data will be replaced.'))return;const prev=S;S=Object.assign(o,{user:prev.user});
 if(!save()){S=prev;return toast('Undo failed; nothing was changed.',1)}try{localStorage.removeItem(KEYS.biz+'_prerestore')}catch(e){}toast('Previous data recovered');render()}
function setCur(){const v=($('cur').value||'').trim().toUpperCase();try{if(!/^[A-Z]{3}$/.test(v))throw 0;new Intl.NumberFormat(undefined,{style:'currency',currency:v})}catch(e){return toast('Enter a valid 3-letter currency code such as EGP, USD or EUR.',1)}
 S.settings=S.settings||{};S.settings.currency=v;save();toast('Currency saved');render()}

PG.data=()=>{const d=S.SR.map(r=>r.date).sort(),kb=Math.round(JSON.stringify(S).length/1024),hist=(S.imports||[]).slice().reverse(),canUndo=hist.find(i=>i.undo&&i.outcome==='ok');IW=IW||{kind:'products',step:1};
 let hasPre=false;try{hasPre=!DEMO()&&!!localStorage.getItem(KEYS.biz+'_prerestore')}catch(e){}
 const row=(a,b)=>`<tr><th scope="row">${a}</th><td>${b}</td></tr>`;
 return `<h1>Data &amp; Import</h1><p class="sub">Active workspace: <b>${DEMO()?'Demo (simulated data)':'Business (your data)'}</b>. The two workspaces are stored separately and never mix.</p>
<div class="grid g2"><div class="card"><h3>What Inventra holds</h3><div class="tw"><table>${row('Products',S.P.length+(S.archived.length?' (+'+S.archived.length+' archived)':''))}${row('Sales history',S.SR.length?`${S.SR.length} product-day record(s), ${d[0]} to ${d[d.length-1]}`:'none')}${row('Stock movements',S.mv.length)}${row('Purchase orders',S.R.length)}${row('Imports',(S.imports||[]).length)}${row('Approx. storage used',kb+' KB of roughly 5,000 KB available in this browser')}${row('Last backup',DEMO()?'n/a (demo)':(S.settings&&S.settings.lastBackup?esc(new Date(S.settings.lastBackup).toLocaleString()):'never'))}</table></div>${kb>3500?'<div class="ins w" role="alert">Browser storage is nearly full. Export a backup and consider archiving old data.</div>':''}</div>
<div class="card"><h3>Backup &amp; restore</h3><p class="sub">A backup contains products, dated sales, stock movements, purchase orders, notifications, import history and settings.</p><p><button class="bt p" onclick="exportBackup()">Download backup (JSON)</button></p>
${DEMO()?'<p class="sub">Restoring is only available in the Business workspace.</p>':rsHTML(hasPre)}</div></div>
${DEMO()?`<div class="card" style="margin-top:14px"><h3>Import</h3><p>Imports are disabled in the Demo workspace so simulated and real data can never mix.</p><button class="bt p" onclick="switchWS('biz')">Switch to Business workspace</button></div>`:`<div class="card" style="margin-top:14px"><h3>Import from CSV</h3>${!S.P.length&&!(S.imports||[]).length?'<p class="sub"><b>This workspace is empty.</b> Start by importing your products and stock levels, then import dated sales history to enable forecasts.</p>':''}${impHTML()}</div>`}
<div class="card" style="margin-top:14px"><h3>Import history</h3>${hist.length?`<div class="tw"><table><tr><th scope="col">When</th><th scope="col">Type</th><th scope="col">File</th><th scope="col">Outcome</th><th scope="col">Summary</th><th scope="col"></th></tr>${hist.map(i=>`<tr><td>${esc(new Date(i.t).toLocaleString())}</td><td>${esc(i.kind)}</td><td>${esc(i.file)}</td><td><span class="b ${i.outcome==='ok'?'':'w'}">${esc(i.outcome)}</span></td><td style="white-space:normal">${esc(i.summary)}</td><td>${i.undo&&i.outcome==='ok'?`<button class="bt s d" onclick="impUndo(${i.id})">Undo</button>`:''}</td></tr>`).join('')}</table></div><p class="sub">${canUndo?'Only the most recent import can be undone, and only while no other data has changed since. ':''}To go back further, restore a backup.</p>`:'<div class="empty">No imports yet.</div>'}</div>
${DEMO()?'':`<div class="card" style="margin-top:14px"><h3>Settings</h3><label for="cur">Currency (3-letter code)</label> <input id="cur" value="${esc((S.settings&&S.settings.currency)||'USD')}" maxlength="3" size="4" style="text-transform:uppercase"> <button class="bt s" onclick="setCur()">Save</button><p class="sub">Used for display only; Inventra does not convert currencies.</p></div>`}`};
function rsHTML(hasPre){const w=RW,cur=`${S.P.length} products, ${S.SR.length} sales records`;
 let h=`<p><label for="rsfile">Restore from a backup file</label> <input id="rsfile" type="file" accept=".json,application/json" onchange="rsPick(this)"></p>`;
 if(hasPre)h+=`<p class="sub">A copy of your data from before the last restore is available. <button class="bt s" onclick="rsUndo()">Recover it</button></p>`;
 if(!w)return h;if(w.error)return h+`<div class="ins w" role="alert">${esc(w.error)}</div>`;
 const v=w.v,s=v.summary;
 if(!v.ok)return h+`<div class="ins w" role="alert"><b>This backup cannot be restored.</b> Nothing was changed.</div>${issues(v.errors.slice(0,20).map(m=>({msg:m})))}`;
 return h+`<div class="ins" role="status"><b>Backup is valid.</b> Exported ${esc(s.exportedAt||'(date unknown)')}.</div><div class="tw"><table><tr><th scope="col"></th><th scope="col">In backup</th><th scope="col">Current workspace</th></tr><tr><th scope="row">Products</th><td>${s.products} (+${s.archived} archived)</td><td>${S.P.length} (+${S.archived.length})</td></tr><tr><th scope="row">Sales records</th><td>${s.sales}${s.salesFrom?` (${s.salesFrom} to ${s.salesTo})`:''}</td><td>${S.SR.length}</td></tr><tr><th scope="row">Movements / orders</th><td>${s.movements} / ${s.requests}</td><td>${S.mv.length} / ${S.R.length}</td></tr></table></div>
 <p><b class="up">Restoring REPLACES everything in this Business workspace</b> (${cur}) with the backup. Nothing is merged. A safety copy of the current data is kept so you can recover it.</p>
 <p><label><input type="checkbox" ${w.ack?'checked':''} onchange="rsAck(this.checked)"> I understand the current workspace will be replaced.</label></p><p><button class="bt" onclick="rsReset()">Cancel</button> <button class="bt p" ${w.ack?'':'disabled'} onclick="rsApply()">Restore backup</button></p>`}
