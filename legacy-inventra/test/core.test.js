const test=require('node:test'),assert=require('node:assert/strict'),C=require('../src/core.js');
const TODAY='2026-10-13';
let seed=12345;const rnd=()=>(seed=(seed*1664525+1013904223)>>>0)/4294967296;
const weekly=(n,noise=0)=>Array.from({length:n},(_,i)=>Math.max(0,[10,10,10,10,12,40,45][i%7]+(rnd()-.5)*noise));
const fc=(daily,sigma=0)=>({ok:true,daily,sigma});

test('dates: strict ISO, leap years, no DST drift',()=>{
 assert.equal(C.parseISO('2026-02-30'),null);assert.notEqual(C.parseISO('2028-02-29'),null);assert.equal(C.parseISO('13/10/2026'),null);
 assert.equal(C.addDays('2026-01-30',3),'2026-02-02');assert.equal(C.diffDays('2026-03-28','2026-03-30'),2);assert.equal(C.diffDays('2026-10-24','2026-10-26'),2)});
test('dailySeries: zero-fills, sums same-day records, ignores other products and out-of-range dates',()=>{
 const recs=[{pid:1,date:'2026-10-01',qty:3},{pid:1,date:'2026-10-01',qty:2},{pid:1,date:'2026-10-04',qty:7},{pid:2,date:'2026-10-02',qty:99},{pid:1,date:'2026-09-01',qty:5}];
 assert.deepEqual(C.dailySeries(recs,1,'2026-10-01','2026-10-05'),[5,0,0,7,0])});
test('forecast: seasonal4 continues a perfect weekly pattern exactly; ma needs enough history',()=>{
 const s=Array.from({length:35},(_,i)=>[1,2,3,4,5,6,7][i%7]);assert.deepEqual(C.forecast(s,14,'seasonal4'),Array.from({length:14},(_,i)=>[1,2,3,4,5,6,7][(35+i)%7]));
 assert.equal(C.forecast([1,2,3],7,'ma14'),null);assert.deepEqual(C.forecast([4,6],3,'naive'),[6,6,6])});
test('backtest: never feeds a method data from its own test window',()=>{
 const s=weekly(60,4),lens=[],o=C.METHODS.ma14.fn;C.METHODS.ma14.fn=(x,h)=>{lens.push(x.length);return o(x,h)};
 const bt=C.backtest(s,{h:7});C.METHODS.ma14.fn=o;assert.equal(Math.max(...lens),53);assert.equal(Math.min(...lens),28);assert.equal(bt.ma14.n,26)});
test('weekly pattern: detected on weekly data, NOT on random noise, and short history refuses',()=>{
 const w=weekly(70,3),bt=C.backtest(w);assert.ok(C.weeklyPattern(w,bt).detected);
 const n=Array.from({length:70},()=>20+rnd()*6),bn=C.backtest(n);assert.equal(C.weeklyPattern(n,bn).detected,false);
 assert.equal(C.weeklyPattern([1,2,3],{}).detected,false)});
test('chooseForecast: picks seasonal method on weekly data, plain average on noise, reports measured accuracy',()=>{
 const a=C.chooseForecast(weekly(70,3));assert.equal(a.method,'seasonal4');assert.ok(a.accuracy.windows>=8);assert.ok(a.accuracy.wapeDaily<.15);
 const b=C.chooseForecast(Array.from({length:70},()=>20+rnd()*6));assert.notEqual(b.method,'seasonal4')});
test('chooseForecast: short history is honest (no fake confidence)',()=>{
 assert.equal(C.chooseForecast([1,2,3]).ok,false);const r=C.chooseForecast(Array(20).fill(5));
 assert.equal(r.ok,true);assert.equal(r.accuracy,null);assert.ok(r.warnings.length>=1)});
test('zForService matches normal quantiles and is monotonic',()=>{
 assert.ok(Math.abs(C.zForService(.95)-1.6449)<1e-3);assert.ok(C.zForService(.9)<C.zForService(.93)&&C.zForService(.93)<C.zForService(.95))});

const flat=fc(Array(60).fill(10));
test('recommend: no order above reorder point; open POs count towards position',()=>{
 assert.equal(C.recommend({onHand:60,leadDays:5,forecast:flat}).action,'none');
 assert.equal(C.recommend({onHand:40,leadDays:5,forecast:flat}).action,'order');
 assert.equal(C.recommend({onHand:40,openPO:100,leadDays:5,forecast:flat}).action,'none')});
test('recommend: quantity = demand over lead+cover + safety stock - position',()=>{
 const r=C.recommend({onHand:40,leadDays:5,coverDays:14,forecast:flat});assert.equal(r.qty,150);assert.equal(r.reorderPoint,50);
 const s=C.recommend({onHand:0,leadDays:4,forecast:fc(Array(60).fill(10),5)});assert.equal(s.safetyStock,17)});
test('recommend: MOQ and pack size raise the order and say so; max level warns instead of silently cutting',()=>{
 const m=C.recommend({onHand:40,leadDays:5,moq:200,forecast:flat});assert.equal(m.qty,200);assert.match(m.warnings[0],/minimum order/);
 assert.equal(C.recommend({onHand:40,leadDays:5,packSize:24,forecast:flat}).qty,168);
 const x=C.recommend({onHand:40,leadDays:5,maxLevel:100,forecast:flat});assert.equal(x.qty,150);assert.equal(x.needsReview,true);assert.match(x.warnings.join(' '),/maximum level/)});
test('recommend: shelf life limits quantity; zero room becomes "review", never silent',()=>{
 const a=C.recommend({onHand:40,leadDays:5,shelfLifeDays:10,forecast:flat});assert.equal(a.qty,100);assert.match(a.warnings[0],/shelf life/);
 assert.equal(C.recommend({onHand:40,leadDays:5,shelfLifeDays:0,forecast:flat}).action,'review')});
test('recommend: refuses without forecast/lead time; flags pending requests',()=>{
 assert.equal(C.recommend({onHand:1,leadDays:5,forecast:{ok:false,reason:'x'}}).action,'no_forecast');
 assert.equal(C.recommend({onHand:1,forecast:flat}).action,'no_forecast');
 assert.match(C.recommend({onHand:40,pendingQty:50,leadDays:5,forecast:flat}).warnings[0],/awaiting approval/)});
test('daysOfCover interpolates within the day stock runs out',()=>{assert.equal(C.recommend({onHand:25,leadDays:5,forecast:flat}).daysOfCover,2.5)});

const mk=()=>({products:[{id:1,stock:10},{id:2,stock:5,archived:true}],sales:[],movements:[],requests:[]});
test('recordSale: dated, aggregates per day, rejects bad input without changing state',()=>{
 const st=mk();assert.ok(C.recordSale(st,{pid:1,date:'2026-10-12',qty:3,today:TODAY}).ok);assert.ok(C.recordSale(st,{pid:1,date:'2026-10-12',qty:2,today:TODAY}).ok);
 assert.deepEqual(st.sales,[{pid:1,date:'2026-10-12',qty:5}]);assert.equal(st.products[0].stock,5);
 const snap=JSON.stringify(st);
 for(const b of [{pid:1,date:'2026-10-14',qty:1},{pid:1,date:'2026-10-12',qty:6},{pid:1,date:'2026-10-12',qty:0},{pid:1,date:'2026-10-12',qty:NaN},{pid:2,date:'2026-10-12',qty:1},{pid:1,date:'bad',qty:1}])
  assert.equal(C.recordSale(st,{...b,today:TODAY}).ok,false);assert.equal(JSON.stringify(st),snap)});
test('deleting: blocked by open/pending orders; archive keeps history; partial deliveries counted correctly',()=>{
 const st=mk();st.sales.push({pid:1,date:'2026-10-01',qty:2});st.requests.push({id:7,pid:1,qty:100,got:40,status:'Partially Received'},{id:8,pid:1,qty:50,status:'Pending Approval'},{id:9,pid:1,qty:30,status:'Received',got:30});
 assert.equal(C.openPOQty(st.requests,1),60);assert.equal(C.archiveProduct(st,1).ok,false);
 st.requests=st.requests.filter(r=>r.id===9);assert.ok(C.archiveProduct(st,1,TODAY).ok);assert.equal(st.products[0].archived,true);assert.equal(st.sales.length,1)});

test('CSV parser: quotes, commas, escaped quotes, CRLF, BOM; unterminated quote is an error',()=>{
 assert.deepEqual(C.parseCSV('\uFEFFa,b\r\n"x, y","say ""hi"""\r\n'),[['a','b'],['x, y','say "hi"']]);
 assert.equal(C.validateSalesCSV('sku,date,qty\n"A,1',{skuToPid:{}}).errors.length,1)});
const map={A1:1,B2:2};
test('sales import: row-level errors with correct row numbers; good rows still accepted; same-day rows merge',()=>{
 const csv='SKU,Date,Units Sold\nA1,2026-10-01,5\nA1,2026-10-01,2\nB2,2026-02-30,1\nZZ,2026-10-02,1\nA1,2026-10-20,1\nA1,2026-10-03,-3\nA1,2026-10-04,"1,200"\nB2,2026-10-05,4\n';
 const r=C.validateSalesCSV(csv,{skuToPid:map,today:TODAY});
 assert.deepEqual(r.errors.map(e=>e.row),[4,5,6,7,8]);assert.deepEqual(r.records,[{pid:1,date:'2026-10-01',qty:7},{pid:2,date:'2026-10-05',qty:4}]);
 assert.equal(r.info.mergedSameDay,1);assert.deepEqual(r.info.unknownSkus,['ZZ']);
 assert.equal(C.validateSalesCSV('sku,qty\nA1,1',{skuToPid:map}).errors[0].row,1)});
test('sales import is idempotent and replaces corrected days',()=>{
 const a=[{pid:1,date:'2026-10-01',qty:7},{pid:1,date:'2026-09-30',qty:1}],b=[{pid:1,date:'2026-10-01',qty:9}];
 const once=C.mergeSales(a,b),twice=C.mergeSales(once,b);assert.deepEqual(once,twice);assert.equal(once.find(r=>r.date==='2026-10-01').qty,9);assert.equal(once.length,2)});
test('product import: validates required fields, duplicates (in file and existing), numbers',()=>{
 const r=C.validateProductsCSV('SKU,Name,On hand,Lead time,Pack size,MOQ\nA1,Oat Milk,10,3,12,24\nA1,Dup,5,,,\nC3,,5,,,\nD4,Bad,-2,,,\nE5,Pack0,1,,0,\nX9,Existing,1,,,',{existingSkus:['X9']});
 assert.equal(r.products.length,1);assert.deepEqual(r.products[0],{sku:'A1',name:'Oat Milk',category:'',onHand:10,leadDays:3,packSize:12,moq:24});assert.deepEqual(r.errors.map(e=>e.row),[3,4,5,6,7])});
