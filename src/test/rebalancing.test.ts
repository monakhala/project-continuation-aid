import {describe,it,expect} from 'vitest';
import {emptyData} from '../lib/inventra/data';
import {batchCreateTransfers,findTransferTriggers} from '../lib/inventra/rebalancing';

describe('automated transfer triggers',()=>{
 const product=(id:number,sku:string,locations:Record<string,number>)=>({id,sku,name:sku,cat:'Test',wh:'Main',stock:Object.values(locations).reduce((a,b)=>a+b,0),min:10,max:50,cost:20,price:30,exp:0,locations});

 it('flags critical and moderate shortages based on half of minimum stock',()=>{
  const d=emptyData();
  d.P.push(product(1,'CRIT',{Main:20,Cairo:4}),product(2,'MOD',{Main:20,Alexandria:8}));
  const triggers=findTransferTriggers(d);
  expect(triggers.map(x=>x.urgency)).toEqual(['critical','moderate']);
  expect(triggers[0]).toMatchObject({sku:'CRIT',fromWh:'Main',toWh:'Cairo',currentStockAtTarget:4,transferQty:6});
  expect(triggers[1]).toMatchObject({sku:'MOD',fromWh:'Main',toWh:'Alexandria',currentStockAtTarget:8,transferQty:2});
 });

 it('groups products moving between the same hubs into one draft transfer',()=>{
  const d=emptyData();
  d.P.push(product(1,'A',{Main:20,Cairo:4}),product(2,'B',{Main:18,Cairo:5}));
  const result=batchCreateTransfers(d,findTransferTriggers(d));
  expect(result.transfers).toHaveLength(1);
  expect(result.transfers[0]).toMatchObject({id:1,fromWh:'Main',toWh:'Cairo',status:'draft'});
  expect(result.transfers[0]!.items).toEqual([{pid:1,qty:6},{pid:2,qty:5}]);
 });
});
