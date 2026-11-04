import {describe,it,expect} from 'vitest';
import {emptyData} from '../lib/inventra/data';
import {parseCourierCsv,applyCourierStatement} from '../lib/inventra/courier';
describe('courier statement CSV import',()=>{
 it('parses courier rows and normalizes statuses',()=>{const csv='Tracking,Courier,Status,COD Amount,Fee,Date\nBST-101,Bosta,Delivered,450.00,35.00,2026-11-02\nMYL-202,Mylerz,Paid/Remitted,600.00,40.00,2026-11-03\nBST-999,Bosta,RTO,0,30.00,2026-11-04';const {rows,errors}=parseCourierCsv(csv);expect(errors).toHaveLength(0);expect(rows).toHaveLength(3);expect(rows.map(x=>x.status)).toEqual(['delivered','remitted','rto']);expect(rows[0]!.cod).toBe(450);});
 it('reconciles matching shipments and records unmatched tracking numbers',()=>{const d=emptyData();d.shipments.push({id:1,tracking:'BST-101',courier:'Bosta',customer:'Ahmed',items:[{pid:1,qty:1}],codAmount:450,fee:35,status:'in_transit',t:'2026-11-01'});const result=applyCourierStatement(d,[{tracking:'BST-101',courier:'Bosta',status:'remitted',cod:450,fee:35,date:'2026-11-03'},{tracking:'UNKNOWN-99',courier:'Bosta',status:'delivered',cod:100,fee:20,date:'2026-11-03'}],'test-statement.csv');expect(result.updated).toBe(1);expect(result.matched).toBe(1);expect(result.unmatched).toEqual(['UNKNOWN-99']);expect(d.shipments[0]!.remittedAmount).toBe(450);expect(d.imports[0]!.kind).toBe('courier-statement');});
});
