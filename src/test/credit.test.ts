import { describe, it, expect } from 'vitest';
import { emptyData } from '../lib/inventra/data';
import C from '../lib/inventra/core';
import type { WorkspaceData } from '../lib/inventra/types';
import {
  orderTotal, orderRemaining, dueDateOf, bucketOf, payableRows, runway,
  supplierCreditRows, creditCheck, findPaymentReminders, generateSupplierMessage
} from '../lib/inventra/credit';

function fixture(): WorkspaceData {
  const d = emptyData();
  d.P.push({ id: 1, sku: 'A-1', name: 'Alpha', cat: 'x', wh: 'W1', stock: 10, min: 5, max: 100, cost: 100, price: 150, exp: 999 });
  d.sup = [
    { id: 1, name: 'Fresh', terms: 30, creditLimit: 5000 },
    { id: 2, name: 'Swift', terms: 10, creditLimit: 0 }
  ];
  const today = C.todayISO();
  d.R.push(
    { id: 1, pid: 1, qty: 10, got: 10, status: 'Received', t: C.addDays(today, -40), supplier: 'Fresh', unitCost: 100 },
    { id: 2, pid: 1, qty: 20, got: 0, status: 'Confirmed', t: C.addDays(today, -28), supplier: 'Fresh', unitCost: 100 },
    { id: 3, pid: 1, qty: 5, got: 5, status: 'Received', t: C.addDays(today, -10), supplier: 'Swift', unitCost: 100, paid: 200 },
    { id: 4, pid: 1, qty: 50, got: 0, status: 'Pending Approval', t: today, supplier: 'Fresh', unitCost: 100 },
    { id: 5, pid: 1, qty: 5, got: 5, status: 'Received', t: C.addDays(today, -5) }
  );
  return d;
}

describe('Supplier credit terms & payables runway', () => {
  it('schedules due dates from agreed credit days and buckets overdue vs this week', () => {
    const d = fixture(), today = C.todayISO();
    expect(dueDateOf(d.R[0]!, 30)).toBe(C.addDays(today, -10));
    expect(bucketOf(dueDateOf(d.R[0]!, 30), today)).toBe('overdue');
    expect(dueDateOf(d.R[1]!, 30)).toBe(C.addDays(today, 2));
    expect(bucketOf(dueDateOf(d.R[1]!, 30), today)).toBe('week');
    expect(bucketOf(dueDateOf(d.R[2]!, 10), today)).toBe('week');
  });
  it('treats unknown suppliers as cash terms (due immediately)', () => {
    const d = fixture(), today = C.todayISO();
    expect(bucketOf(dueDateOf(d.R[4]!, 0), today)).toBe('overdue');
  });
  it('never counts negative remaining after payments and excludes pending approval from payables', () => {
    const d = fixture();
    expect(orderTotal(d, d.R[2]!)).toBe(500);
    expect(orderRemaining(d, d.R[2]!)).toBe(300);
    const paid = { ...d.R[2]!, paid: 999 };
    expect(orderRemaining(d, paid)).toBe(0);
    const rows = payableRows(d);
    // Payables are ordered by earliest due date, including cash terms due today.
    expect(rows.map(r => r.o.id)).toEqual([1, 5, 3, 2]);
    expect(orderRemaining(d, d.R[3]!)).toBeGreaterThan(0);
    expect(rows.some(r => r.o.id === 4)).toBe(false);
  });
  it('falls back to product cost when an order has no recorded unit cost', () => {
    const d = fixture();
    expect(orderTotal(d, d.R[4]!)).toBe(500);
  });
  it('sums the runway per bucket', () => {
    const d = fixture();
    const r = runway(d);
    expect(r.overdue).toBe(1000 + 500);
    expect(r.week).toBe(2000 + 300);
    expect(r.total).toBe(3800);
    expect(r.overdueCount).toBe(2);
  });
  it('computes per-supplier outstanding, utilization and available credit', () => {
    const d = fixture();
    const rows = supplierCreditRows(d);
    const fresh = rows.find(r => r.s.name === 'Fresh')!;
    expect(fresh.outstanding).toBe(3000);
    expect(fresh.pending).toBe(5000);
    expect(fresh.utilization).toBeCloseTo(0.6);
    expect(fresh.available).toBe(2000);
    expect(fresh.overLimit).toBe(false);
    const swift = rows.find(r => r.s.name === 'Swift')!;
    expect(swift.outstanding).toBe(300);
    expect(swift.utilization).toBe(null);
    expect(swift.overLimit).toBe(false);
  });
  it('flags approvals that would exceed the supplier credit limit', () => {
    const d = fixture();
    expect(creditCheck(d, 'Fresh', 2500)?.exceeds).toBe(true);
    expect(creditCheck(d, 'Fresh', 2000)?.exceeds).toBe(false);
    expect(creditCheck(d, 'Swift', 100)).toBe(null);
  });
  it('finds overdue, due today, and the 7-day threshold without including day eight',()=>{
    const d=emptyData(),reference='2026-11-04';
    d.P.push({id:1,sku:'A',name:'Alpha',cat:'x',wh:'W1',stock:10,min:1,max:20,cost:100,price:150,exp:0});
    d.sup=[{id:7,name:'Fresh',terms:10,creditLimit:0}];
    d.R.push(
      {id:1,pid:1,qty:1,got:1,status:'Received',t:'2026-10-24',supplier:'Fresh',unitCost:100},
      {id:2,pid:1,qty:2,got:2,status:'Received',t:'2026-10-25',supplier:'Fresh',unitCost:100},
      {id:3,pid:1,qty:3,got:3,status:'Confirmed',t:'2026-11-01',supplier:'Fresh',unitCost:100},
      {id:4,pid:1,qty:4,got:4,status:'Confirmed',t:'2026-11-02',supplier:'Fresh',unitCost:100},
    );
    const reminders=findPaymentReminders(d,reference);
    expect(reminders.map(x=>[x.orderId,x.status,x.daysRemaining])).toEqual([
      [1,'overdue',-1],[2,'due_today',0],[3,'due_soon',7],
    ]);
    expect(reminders[0]).toMatchObject({supplierId:7,supplierName:'Fresh',amountDue:100,dueDate:'2026-11-03'});
  });
  it('formats settlement notices in English and Arabic',()=>{
    const reminder={orderId:42,supplierId:7,supplierName:'Fresh Foods',amountDue:1234.5,dueDate:'2026-11-11',status:'due_soon' as const,daysRemaining:7};
    expect(generateSupplierMessage(reminder,'en','EGP')).toBe('Dear Fresh Foods Accounts team, regarding payment for PO #42 of 1234.50 EGP due on 2026-11-11. Please confirm settlement schedule.');
    expect(generateSupplierMessage(reminder,'ar','EGP')).toBe('تحية طيبة من إدارة الحسابات، بخصوص مستحقات توريد Fresh Foods لأمر الشراء #42 بمبلغ 1234.50 EGP المستحق في 2026-11-11. نرجو تأكيد ميعاد الصرف.');
  });
});
