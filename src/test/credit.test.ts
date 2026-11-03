import { describe, it, expect } from 'vitest';
import { emptyData } from '../lib/inventra/data';
import C from '../lib/inventra/core';
import type { WorkspaceData } from '../lib/inventra/types';
import {
  orderTotal, orderRemaining, dueDateOf, bucketOf, payableRows, runway,
  supplierCreditRows, creditCheck
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
    expect(dueDateOf(d.R[0], 30)).toBe(C.addDays(today, -10));
    expect(bucketOf(dueDateOf(d.R[0], 30), today)).toBe('overdue');
    expect(dueDateOf(d.R[1], 30)).toBe(C.addDays(today, 2));
    expect(bucketOf(dueDateOf(d.R[1], 30), today)).toBe('week');
    expect(bucketOf(dueDateOf(d.R[2], 10), today)).toBe('week');
  });
  it('treats unknown suppliers as cash terms (due immediately)', () => {
    const d = fixture(), today = C.todayISO();
    expect(bucketOf(dueDateOf(d.R[4], 0), today)).toBe('overdue');
  });
  it('never counts negative remaining after payments and excludes pending approval from payables', () => {
    const d = fixture();
    expect(orderTotal(d, d.R[2])).toBe(500);
    expect(orderRemaining(d, d.R[2])).toBe(300);
    const paid = { ...d.R[2], paid: 999 };
    expect(orderRemaining(d, paid)).toBe(0);
    const rows = payableRows(d);
    expect(rows.map(r => r.o.id)).toEqual([1, 5, 2, 3]);
    expect(orderRemaining(d, d.R[3])).toBeGreaterThan(0);
    expect(rows.some(r => r.o.id === 4)).toBe(false);
  });
  it('falls back to product cost when an order has no recorded unit cost', () => {
    const d = fixture();
    expect(orderTotal(d, d.R[4])).toBe(500);
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
});
