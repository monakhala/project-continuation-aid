import {describe,it,expect} from 'vitest';
import {emptyData} from '../lib/inventra/data';
import {applyClearance,clearanceApplied} from '../lib/inventra/liquidation';
describe('Clearance action',()=>{it('applies the floor price once and logs an audit movement',()=>{const d=emptyData();d.P.push({id:1,sku:'SLOW-1',name:'Slow Item',cat:'Test',wh:'Main',stock:100,min:10,max:200,cost:90,price:150,exp:0});expect(clearanceApplied(d,1)).toBe(false);expect(applyClearance(d,1).ok).toBe(true);expect(d.P[0]!.price).toBe(90);expect(clearanceApplied(d,1)).toBe(true);expect(d.mv.some(m=>m.type==='clearance'&&m.pid===1)).toBe(true);const second=applyClearance(d,1);expect(second.ok).toBe(false);if(!second.ok)expect(second.error).toBe('already_applied');});});
