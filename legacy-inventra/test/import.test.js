const test=require('node:test'),assert=require('node:assert/strict'),C=require('../src/core.js');
const T='2026-10-13',PC='sku,name,on hand,category,cost,price,lead time,moq\n';
test('delimiter detection: semicolon and tab exports (common from Excel) parse correctly',()=>{
 assert.equal(C.detectDelimiter('sku;name;qty\nA;B;1'),';');assert.equal(C.detectDelimiter('sku\tname\nA\tB'),'\t');assert.equal(C.detectDelimiter('a,b'),',');
 const r=C.validateProductsCSV('sku;name;on hand\nA1;Tea;5\n');assert.equal(r.errors.length,0);assert.equal(r.products[0].onHand,5)});
test('unsupported / empty input is refused in plain language',()=>{
 for(const bad of['','   \n ','PK\u0003\u0004xl/workbook','%PDF-1.4','a,b\u0000c']){const r=C.validateProductsCSV(bad);assert.equal(r.products.length,0);assert.equal(r.errors.length,1)}
 assert.match(C.validateProductsCSV('sku,name,on hand\n').errors[0].msg,/no data rows/)});
test('mapping: auto-detects aliases, honours manual mapping, rejects bad mappings, reports missing required columns',()=>{
 assert.deepEqual(C.detectMapping(['Item Code','Description','Stock'],'products'),{sku:0,name:1,onhand:2});
 const csv='code,title,qty_here\nA1,Tea,5\n';assert.match(C.validateProductsCSV(csv).errors[0].msg,/Required column.*SKU/);
 const ok=C.validateProductsCSV(csv,{mapping:{sku:0,name:1,onhand:2}});assert.equal(ok.errors.length,0);assert.equal(ok.products[0].name,'Tea');
 assert.match(C.validateProductsCSV(csv,{mapping:{sku:0,name:0,onhand:2}}).errors[0].msg,/same CSV column/);
 assert.match(C.validateProductsCSV(csv,{mapping:{sku:0,name:1,onhand:9}}).errors[0].msg,/does not exist/)});
test('products: row/field errors, blank and duplicate SKUs, bad numbers, decimals allowed, unused columns warned',()=>{
 const csv=PC+'A1,Tea,5,Drinks,1.50,2.25,3,12\n,NoSku,1,,,,,\nA1,Dup,2,,,,,\nB2,,1,,,,,\nC3,Neg,-4,,,,,\nD4,Cur,1,,$1.50,,,\nE5,Thou,1,,"1,200",,,\nF6,Dec,2.5,,,,,\nG7,Wide,1,,,,,,EXTRA\n';
 const r=C.validateProductsCSV(csv+'',{});
 assert.deepEqual(r.errors.map(e=>[e.row,e.field]),[[3,'sku'],[4,'sku'],[5,'name'],[6,'onhand'],[7,'cost'],[8,'cost'],[10,null]]);
 assert.deepEqual(r.products.map(p=>p.sku),['A1','F6']);assert.equal(r.products[1].onHand,2.5);assert.equal(r.products[0].cost,1.5);
 const w=C.validateProductsCSV('sku,name,on hand,notes\nA,B,1,hello\n');assert.match(w.warnings[0].msg,/"notes" is not used/)});
test('products: duplicate names warn (in file and vs existing) but do not block; price<cost and case-only SKU differences warn',()=>{
 const r=C.validateProductsCSV('sku,name,on hand,cost,price\nA1,Tea,1,5,2\nA2,tea,1,,\nA3,Coffee,1,,\na1,Zed,1,,\n',{existingSkus:['Z9'],existingNames:{coffee:'Z9'}});
 assert.equal(r.errors.length,0);const m=r.warnings.map(x=>x.msg).join('|');assert.match(m,/below unit cost/);assert.match(m,/also used by SKU "A1"/);assert.match(m,/already used by existing SKU "Z9"/);assert.match(m,/letter case/)});
test('existing SKUs: error by default, flagged when allowExisting',()=>{
 assert.equal(C.validateProductsCSV('sku,name,on hand\nX,Y,1\n',{existingSkus:['X']}).errors.length,1);
 assert.equal(C.validateProductsCSV('sku,name,on hand\nX,Y,1\n',{existingSkus:['X'],allowExisting:true}).products[0].existing,true)});
const base=()=>({products:[{id:1,sku:'A1',name:'Tea',cat:'Old',stock:10,min:2,max:50,cost:1,price:2,lead:3},{id:4,sku:'Z',name:'Z',cat:'c',stock:1,min:0,max:0,cost:0,price:0}],archived:[{id:7}],movements:[],px:{}});
test('strategy "add": new SKUs created with fresh ids; matched SKUs skipped and untouched; archived ids never reused',()=>{
 const inc=C.validateProductsCSV(PC+'A1,Tea2,99,,,,,\nB2,Bean,5,Food,,,,\n',{existingSkus:['A1','Z'],allowExisting:true}).products,st=base();
 const plan=C.planProductImport(st.products,inc,{strategy:'add'});assert.deepEqual(plan.skipped,['A1']);assert.equal(plan.add.length,1);
 C.applyProductPlan(st,plan);assert.equal(st.products.find(p=>p.sku==='A1').stock,10);assert.equal(st.products.find(p=>p.sku==='B2').id,8);assert.deepEqual(st.px[8],{})});
test('strategy "update": only fields present in the file change; stock untouched unless explicitly overwritten, then logged as Adjustment',()=>{
 const inc=C.validateProductsCSV('sku,name,on hand,category\nA1,Tea Deluxe,99,New\n',{existingSkus:['A1'],allowExisting:true}).products;
 let st=base(),plan=C.planProductImport(st.products,inc,{strategy:'update'});C.applyProductPlan(st,plan);
 const p=st.products[0];assert.deepEqual([p.name,p.cat,p.stock,p.cost,p.lead],['Tea Deluxe','New',10,1,3]);assert.equal(st.movements.length,0);
 st=base();plan=C.planProductImport(st.products,inc,{strategy:'update',overwriteStock:true});assert.deepEqual(plan.stockChanges,[{sku:'A1',from:10,to:99}]);
 C.applyProductPlan(st,plan,{who:'t',t:'now'});assert.equal(st.products[0].stock,99);assert.deepEqual([st.movements[0].type,st.movements[0].q],['Adjustment',89])});
test('imported products never get invented values: missing lead/moq stay absent; expiry not imported',()=>{
 const o=C.toStored(C.validateProductsCSV('sku,name,on hand\nA,B,1\n').products[0]);assert.equal('lead' in o,false);assert.equal('moq' in o,false);assert.equal(o.exp,999);assert.equal(o.src,'import')});
test('separation: an inventory CSV is never read as sales, and a sales CSV never as inventory',()=>{
 const inv=C.validateSalesCSV(PC+'A1,Tea,5,,,,,\n',{skuToPid:{A1:1},today:T});assert.equal(inv.records.length,0);assert.match(inv.errors[0].msg,/Required column.*Date/);
 const sal=C.validateProductsCSV('sku,date,qty\nA1,2026-10-01,3\n');assert.equal(sal.products.length,0);assert.match(sal.errors[0].msg,/Required column.*On-hand/)});
test('sales: plain-language errors with field, case hint for SKUs, short-history warning, idempotent',()=>{
 const r=C.validateSalesCSV('sku,date,qty\na1,2026-10-01,3\nA1,2026-13-01,3\nA1,2026-10-02,x\n',{skuToPid:{A1:1},today:T});
 assert.match(r.errors[0].msg,/did you mean "A1"/);assert.deepEqual(r.errors.map(e=>e.field),['sku','date','qty']);
 const ok=C.validateSalesCSV('sku,date,qty\nA1,2026-10-01,3.5\nA1,2026-10-02,1\n',{skuToPid:{A1:1},today:T});assert.equal(ok.records[0].qty,3.5);assert.match(ok.warnings[0].msg,/only 2 day/);
 assert.equal(C.validateSalesCSV('sku,date,qty\n',{skuToPid:{A1:1}}).records.length,0)});
test('hashData changes when data changes and is stable otherwise',()=>{assert.equal(C.hashData({a:1}),C.hashData({a:1}));assert.notEqual(C.hashData({a:1}),C.hashData({a:2}))});

const S0=()=>({P:[{id:1,sku:'A1',name:'Tea',cat:'D',wh:'Main',stock:5,min:1,max:0,cost:1,price:2,exp:999,lead:3}],archived:[{id:2,sku:'B',name:'Old',cat:'x',wh:'Main',stock:0,min:0,max:0,cost:0,price:0,exp:999,archived:true}],SR:[{pid:1,date:'2026-10-01',qty:2},{pid:2,date:'2026-09-01',qty:1}],mv:[{pid:1,t:'x',type:'Sale',q:-1,who:''}],R:[{id:1,pid:1,qty:10,got:4,status:'Partially Received'}],N:[],snooze:{},watch:[],alerts:[],px:{},imports:[{id:1,kind:'products'}],settings:{currency:'EGP'},nid:3,rid:2});
test('backup round trip: export -> JSON -> validate -> restore keeps products, dated sales, movements, orders, settings',()=>{
 const s=S0(),b=JSON.parse(JSON.stringify(C.buildBackup(s,{workspace:'biz',now:'2026-10-13T10:00:00Z'}))),v=C.validateBackup(b);
 assert.equal(v.ok,true,v.errors.join());assert.deepEqual([v.summary.products,v.summary.archived,v.summary.sales,v.summary.salesFrom,v.summary.salesTo],[1,1,2,'2026-09-01','2026-10-01']);
 const r=C.restoreData(b.data);assert.deepEqual(r.P,s.P);assert.deepEqual(r.archived,s.archived);assert.deepEqual(r.SR,s.SR);assert.deepEqual(r.mv,s.mv);assert.deepEqual(r.R,s.R);assert.equal(r.settings.currency,'EGP');assert.equal(r.rid,2)});
test('backup validation rejects bad files with specific reasons',()=>{
 const mk=f=>{const b=JSON.parse(JSON.stringify(C.buildBackup(S0(),{workspace:'biz',now:'t'})));f(b);return C.validateBackup(b)};
 assert.equal(C.validateBackup(null).ok,false);assert.equal(C.validateBackup({format:'x'}).ok,false);
 assert.match(mk(b=>b.schemaVersion=2).errors[0],/Unsupported backup version/);assert.match(mk(b=>b.workspace='demo').errors.join(),/Demo workspace/);
 assert.match(mk(b=>b.data.P.push({...b.data.P[0],id:9})).errors.join(),/duplicate SKU/);assert.match(mk(b=>b.data.SR[0].pid=99).errors.join(),/unknown product/);
 assert.match(mk(b=>b.data.SR[0].date='2026-02-30').errors.join(),/invalid date/);assert.match(mk(b=>b.data.P[0].stock='5').errors.join(),/stock must be a number/);
 assert.match(mk(b=>b.data.R[0].status='Weird').errors.join(),/unknown status/);assert.match(mk(b=>delete b.data.SR).errors.join(),/"SR" must be a list/);
 assert.match(mk(b=>b.data.SR.push({...b.data.SR[0]})).errors.join(),/duplicate product\/date/)});
test('restore uses a whitelist: hostile keys never reach live state',()=>{
 const b=JSON.parse(JSON.stringify(C.buildBackup(S0(),{workspace:'biz',now:'t'})));b.data.P[0].isAdmin=true;b.data.P[0].__proto__x=1;
 const raw=JSON.stringify(b).replace('"id":1,"sku"','"__proto__":{"polluted":1},"id":1,"sku"');const r=C.restoreData(JSON.parse(raw).data);
 assert.equal(r.P[0].isAdmin,undefined);assert.equal(({}).polluted,undefined);assert.equal(Object.keys(r.P[0]).includes('polluted'),false);assert.equal(r.settings.currency,'EGP')});
test('validateData handles garbage (used for saved-data checks)',()=>{for(const g of[null,5,[],{},{P:[],SR:'x'}])assert.ok(C.validateData(g).errors.length>0);assert.equal(C.validateData({P:[],SR:[]}).errors.length,0)});
