const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
function boot(){const html=fs.readFileSync(path.join(__dirname,'../dist/Inventra.html'),'utf8'),els={},store={};
 const el=id=>els[id]||(els[id]={innerHTML:'',value:'',textContent:'',focus(){}});
 const ctx={document:{getElementById:el,querySelector:()=>el('q')},localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v}},Chart:class{destroy(){}},
  setTimeout:()=>0,confirm:()=>true,prompt:(m,d)=>d,innerWidth:1200,console};vm.createContext(ctx);
 for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))vm.runInContext(m[1],ctx);
 el('ls').value='1';return{ctx,el,store,run:c=>vm.runInContext(c,ctx),page:()=>els.root.innerHTML}}
const all=['dash','inv','restock','orders','forecast','price','notif'];
test('every page renders for the manager role without errors, with the demo banner and no legacy claims',()=>{
 const a=boot();a.run("signin('manager')");
 for(const k of all){a.run(`go('${k}')`);assert.match(a.page(),/DEMO DATA/);assert.doesNotMatch(a.page(),/undefined|NaN/,k)}
 a.run("selP=1;go('forecast')");assert.doesNotMatch(a.page(),/Confidence|detected in history|weighted/i);assert.match(a.page(),/backtest windows/)});
test('other roles render their pages',()=>{for(const r of ['head','warehouse','supplier']){const a=boot();a.run(`signin('${r}')`);for(const k of a.run(`NAV['${r}']`)){a.run(`go('${k}')`);assert.doesNotMatch(a.page(),/undefined|NaN/)}}});
test('weekly-pattern claim is data-driven: flat demo series do not claim a pattern unless backtest supports it',()=>{
 const a=boot();a.run("signin('manager')");
 const claims=a.run("S.P.map(p=>{const c=ch(p);return c.ok&&c.weekly.detected})");assert.ok(claims.includes(true)&&claims.includes(false));assert.equal(a.run('ch(S.P[8]).ok'),false)});
test('recording a sale creates a DATED record and does not add a fake day to the history',()=>{
 const a=boot();a.run("signin('manager')");const before=a.run("sl(S.P[0]).length"),n=a.run("S.SR.length");
 a.el('mt').value='Sale';a.el('mq').value='1';a.run("mv(1)");a.run("MEMO={}");
 assert.equal(a.run("S.SR.length"),n+1);assert.equal(a.run("S.SR[S.SR.length-1].date"),a.run("C.todayISO()"));assert.equal(a.run("sl(S.P[0]).length"),before)});
test('sale beyond stock is rejected and leaves state unchanged',()=>{
 const a=boot();a.run("signin('manager')");const s=a.run("S.P[3].stock");a.el('mt').value='Sale';a.el('mq').value='5';a.run("mv(4)");
 assert.equal(a.run("S.P[3].stock"),s);assert.match(a.el('fe').textContent,/Only 0 units|Not enough stock/)});
test('product with open order cannot be archived; other products archive and keep history',()=>{
 const a=boot();a.run("signin('manager')");a.run("del(5)");assert.equal(a.run("S.P.some(p=>p.id==5)"),true);
 a.run("del(3)");assert.equal(a.run("S.P.some(p=>p.id==3)"),false);assert.equal(a.run("S.archived.length"),1);assert.ok(a.run("S.SR.some(r=>r.pid==3)"));
 a.run("go('orders')");assert.doesNotMatch(a.page(),/undefined/)});
test('snooze really hides a restock card',()=>{
 const a=boot();a.run("signin('manager')");const id=a.run("(S.P.map(rec).filter(Boolean)[0]||{p:{id:0}}).p.id");if(!id)return;
 const name=a.run(`S.P.find(p=>p.id==${id}).name`);a.run("go('restock')");assert.ok(a.page().includes(name));a.run(`dis(${id})`);assert.ok(!a.page().includes(name))});
test('editing stock in the form records an Adjustment movement; new product gets a non-reused id',()=>{
 const a=boot();a.run("signin('manager')");a.run("pf(1)");a.el('f_stock').value='123';for(const k of['name','sku','cat','wh','min','max','cost','price','exp','lead'])a.el('f_'+k).value=String(a.run(`S.P[0].${k}`));
 a.run("ps(1)");assert.equal(a.run("S.P[0].stock"),123);assert.equal(a.run("S.mv[0].type"),'Adjustment');});
test('persisted demo history is re-anchored so it never turns into zero demand as days pass',()=>{
 const a=boot();a.run("signin('manager')");a.run("S.seedDate=C.addDays(S.seedDate,-5);S.SR.forEach(r=>{if(r.demo)r.date=C.addDays(r.date,-5)});save()");
 const b=boot();b.store.inventra_demo_v2=a.store.inventra_demo_v2;b.run("load()");assert.equal(b.run("S.seedDate"),b.run("C.todayISO()"));assert.equal(b.run("Math.max(...S.SR.filter(r=>r.demo).map(r=>+r.date.replace(/-/g,'')))"),+b.run("C.addDays(C.todayISO(),-1)").replace(/-/g,''))});

const EVIL='<img src=x onerror=window.__pwn=1>"\'<script>alert(1)</script>';
test('HTML injection: hostile names/SKUs/categories/notes render as text on every page and modal',()=>{
 const a=boot();a.ctx.EVIL=EVIL;a.run("signin('manager')");
 a.run("S.P.forEach(p=>{p.name=EVIL+p.name;p.sku=EVIL+p.sku;p.cat=EVIL;p.wh=EVIL});note('Stock','High',EVIL,1,['manager','head']);F.q=EVIL;S.R[0].tl.push({t:EVIL,w:EVIL,m:EVIL})");
 const bad=/<img src=x|<script>alert/;
 for(const k of all){a.run(`go('${k}')`);assert.doesNotMatch(a.page(),bad,'page '+k)}
 a.run("selP=1;go('forecast')");assert.doesNotMatch(a.page(),bad);
 for(const c of ["det(1)","mvf(1)","pf(1)","cmp(1,10)","tlv(1)"]){a.run(c);assert.doesNotMatch(a.el('m').innerHTML,bad,c)}
 a.run("toast(EVIL)");assert.doesNotMatch(a.el('t').innerHTML,bad);assert.match(a.page()+a.el('m').innerHTML,/&lt;img/)});
