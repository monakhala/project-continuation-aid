import {describe,it,expect} from 'vitest';
import {initScanSession,recordScan} from '../lib/inventra/scanner';

describe('barcode and SKU scan verification',()=>{
 it('initializes verification rows for multi-item transfers',()=>{
  const session=initScanSession([{pid:1,qty:2},{pid:2,qty:1}],[{id:1,sku:'DR-155',name:'Drink'},{id:2,sku:'FD-220',name:'Food'}]);
  expect(session).toEqual([
   {pid:1,sku:'DR-155',name:'Drink',expectedQty:2,scannedQty:0},
   {pid:2,sku:'FD-220',name:'Food',expectedQty:1,scannedQty:0},
  ]);
 });

 it('matches SKUs case-insensitively and increments the matching quantity',()=>{
  const initial=initScanSession([{pid:1,qty:2},{pid:2,qty:1}],[{id:1,sku:'DR-155',name:'Drink'},{id:2,sku:'FD-220',name:'Food'}]);
  const first=recordScan(initial,'  dr-155  ');
  expect(first.matched).toBe(true);
  expect(first.completed).toBe(false);
  expect(first.session[0]!.scannedQty).toBe(1);
  const second=recordScan(first.session,'DR-155');
  expect(second.session[0]!.scannedQty).toBe(2);
  expect(second.completed).toBe(false);
 });

 it('reports completion once every required unit has been scanned',()=>{
  let session=initScanSession([{pid:1,qty:1},{pid:2,qty:2}],[{id:1,sku:'A-1',name:'A'},{id:2,sku:'B-2',name:'B'}]);
  session=recordScan(session,'A-1').session;
  session=recordScan(session,'B-2').session;
  expect(recordScan(session,'B-2').completed).toBe(true);
 });
});
