import {describe,it,expect} from 'vitest';
import {emptyData} from '../lib/inventra/data';
import {courierSummary,shipmentsByCourier,generateSampleCourierCsv,parseCourierCsv,applyCourierStatement} from '../lib/inventra/courier';
describe('courier COD reconciliation',()=>{it('sums pending cash and ghost stock value',()=>{const d=emptyData();d.P.push({id:1,sku:'X',name:'X',cat:'',wh:'Main',stock:5,min:0,max:10,cost:10,price:20,exp:0});d.shipments.push({id:1,tracking:'A',courier:'Bosta',customer:'C',items:[{pid:1,qty:2}],codAmount:150,fee:20,status:'in_transit',t:'2026-11-01'},{id:2,tracking:'B',courier:'Mylerz',customer:'D',items:[{pid:1,qty:1}],codAmount:200,fee:25,status:'delivered',t:'2026-11-01'});const s=courierSummary(d);expect(s.inTransitGhostStockValue).toBe(20);expect(s.deliveredPendingCash).toBe(200);});it('calculates RTO rate and remittance discrepancy',()=>{const d=emptyData();d.shipments.push({id:1,tracking:'A',courier:'Bosta',customer:'C',items:[{pid:1,qty:1}],codAmount:100,remittedAmount:90,fee:10,status:'remitted',t:'2026-11-01'},{id:2,tracking:'B',courier:'Bosta',customer:'D',items:[{pid:1,qty:1}],codAmount:50,fee:10,status:'rto',t:'2026-11-01'});expect(courierSummary(d).rtoRate).toBe(.5);expect(courierSummary(d).discrepancy).toBe(10);expect(shipmentsByCourier(d)[0]!.rtoRate).toBe(.5);});});

it('generateSampleCourierCsv produces valid CSV that can be parsed and reconciled',()=>{
 const d=emptyData();
 d.shipments.push(
  {id:1,tracking:'BST-101',courier:'Bosta',customer:'A',items:[],codAmount:450,fee:35,status:'in_transit',t:'2026-11-01'},
  {id:2,tracking:'MYL-202',courier:'Mylerz',customer:'B',items:[],codAmount:600,fee:40,status:'delivered',t:'2026-11-01'},
  {id:3,tracking:'BST-303',courier:'Bosta',customer:'C',items:[],codAmount:300,fee:25,status:'rto',t:'2026-11-01'},
 );
 const {rows,errors}=parseCourierCsv(generateSampleCourierCsv(d));
 expect(errors).toEqual([]);
 expect(rows.map(row=>row.status)).toEqual(['delivered','delivered','rto','delivered']);
 const result=applyCourierStatement(d,rows,'sample.csv');
 expect(result.updated).toBe(1);
 expect(result.unmatched).toEqual(['BSTA-TEST-UNMATCHED']);
 expect(d.shipments[0]!.status).toBe('delivered');
 expect(d.shipments[2]!.status).toBe('rto');
});
