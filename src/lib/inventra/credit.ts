import C from './core';
import type { WorkspaceData, Order, Supplier } from './types';

/* Supplier credit terms (deferred payment) & payables runway. Pure arithmetic on recorded orders.
   A payable exists once an order is confirmed or received; its due date is the order date plus the
   supplier's agreed credit days. Payments are recorded on the order itself (o.paid). */

export const PAYABLE_STATUSES = ['Confirmed', 'Received'];

export const supplierList = (d: WorkspaceData): Supplier[] => d.sup ?? [];

export const supplierByName = (d: WorkspaceData, name?: string): Supplier | undefined =>
  name ? supplierList(d).find(s => s.name === name) : undefined;

export function unitCostOf(d: WorkspaceData, o: Order): number {
  if (typeof o.unitCost === 'number' && isFinite(o.unitCost) && o.unitCost >= 0) return o.unitCost;
  const p = d.P.find(x => x.id === o.pid) ?? d.archived.find(x => x.id === o.pid);
  return p ? (p.repCost ?? p.cost) : 0;
}

export const orderTotal = (d: WorkspaceData, o: Order) => Math.round(o.qty * unitCostOf(d, o) * 100) / 100;

export const orderRemaining = (d: WorkspaceData, o: Order) => Math.max(0, orderTotal(d, o) - (o.paid ?? 0));

export const dueDateOf = (o: Order, terms: number) => C.addDays(o.t, terms);

export type Bucket = 'overdue' | 'week' | 'month' | 'later';

export function bucketOf(due: string, today: string): Bucket {
  const dd = C.diffDays(today, due);
  if (dd < 0) return 'overdue';
  if (dd <= 7) return 'week';
  if (dd <= 30) return 'month';
  return 'later';
}

export interface PayableRow { o: Order; supplier?: Supplier | undefined; terms: number; due: string; total: number; remaining: number; bucket: Bucket; }

export interface PaymentReminder {
  orderId: number;
  supplierId: number;
  supplierName: string;
  amountDue: number;
  dueDate: string;
  status: 'overdue' | 'due_soon' | 'due_today';
  daysRemaining: number;
}

export function findPaymentReminders(d:WorkspaceData,referenceDateISO=C.todayISO()):PaymentReminder[]{
  return payableRows(d).flatMap(row=>{
    const daysRemaining=C.diffDays(referenceDateISO,row.due);
    let status:PaymentReminder['status'];
    if(daysRemaining<0)status='overdue';
    else if(daysRemaining===0)status='due_today';
    else if(daysRemaining<=7)status='due_soon';
    else return [];
    return [{orderId:row.o.id,supplierId:row.supplier?.id??0,supplierName:row.supplier?.name??row.o.supplier??'',
      amountDue:row.remaining,dueDate:row.due,status,daysRemaining}];
  }).sort((a,b)=>a.daysRemaining-b.daysRemaining||a.orderId-b.orderId);
}

export function generateSupplierMessage(rem:PaymentReminder,lang:'ar'|'en',currency:string):string{
  const amount=rem.amountDue.toFixed(2);
  if(lang==='ar')return `تحية طيبة من إدارة الحسابات، بخصوص مستحقات توريد ${rem.supplierName} لأمر الشراء #${rem.orderId} بمبلغ ${amount} ${currency} المستحق في ${rem.dueDate}. نرجو تأكيد ميعاد الصرف.`;
  return `Dear ${rem.supplierName} Accounts team, regarding payment for PO #${rem.orderId} of ${amount} ${currency} due on ${rem.dueDate}. Please confirm settlement schedule.`;
}

export function payableRows(d: WorkspaceData): PayableRow[] {
  const today = C.todayISO();
  return (d.R ?? [])
    .filter(o => PAYABLE_STATUSES.includes(o.status) && orderRemaining(d, o) > 0)
    .map(o => {
      const supplier = supplierByName(d, o.supplier);
      const terms = supplier ? supplier.terms : 0;
      const due = dueDateOf(o, terms);
      return { o, supplier, terms, due, total: orderTotal(d, o), remaining: orderRemaining(d, o), bucket: bucketOf(due, today) };
    })
    .sort((a, b) => a.due.localeCompare(b.due));
}

export interface Runway { overdue: number; week: number; month: number; later: number; total: number; overdueCount: number; }

export function runway(d: WorkspaceData): Runway {
  const r: Runway = { overdue: 0, week: 0, month: 0, later: 0, total: 0, overdueCount: 0 };
  for (const row of payableRows(d)) {
    r.total += row.remaining;
    r[row.bucket] += row.remaining;
    if (row.bucket === 'overdue') r.overdueCount++;
  }
  return r;
}

export interface SupplierCreditRow {
  s: Supplier; outstanding: number; pending: number; overdueAmount: number;
  utilization: number | null; available: number | null; overLimit: boolean; nextDue: string | null;
}

export function supplierCreditRows(d: WorkspaceData): SupplierCreditRow[] {
  const today = C.todayISO();
  return supplierList(d).map(s => {
    const mine = (d.R ?? []).filter(o => o.supplier === s.name);
    const outstanding = mine.filter(o => PAYABLE_STATUSES.includes(o.status)).reduce((sum, o) => sum + orderRemaining(d, o), 0);
    const pending = mine.filter(o => o.status === 'Pending Approval').reduce((sum, o) => sum + orderTotal(d, o), 0);
    const dueRows = mine.filter(o => PAYABLE_STATUSES.includes(o.status) && orderRemaining(d, o) > 0);
    const overdueAmount = dueRows.filter(o => C.diffDays(today, dueDateOf(o, s.terms)) < 0).reduce((sum, o) => sum + orderRemaining(d, o), 0);
    const nextDue = dueRows.map(o => dueDateOf(o, s.terms)).sort()[0] ?? null;
    const utilization = s.creditLimit > 0 ? outstanding / s.creditLimit : null;
    return {
      s, outstanding, pending, overdueAmount, utilization,
      available: s.creditLimit > 0 ? Math.max(0, s.creditLimit - outstanding) : null,
      overLimit: s.creditLimit > 0 && outstanding > s.creditLimit,
      nextDue
    };
  }).sort((a, b) => b.outstanding - a.outstanding);
}

export interface CreditCheck { limit: number; current: number; exceeds: boolean; }

/* Exposure check before approving a purchase order for a named supplier. */
export function creditCheck(d: WorkspaceData, supplierName: string | undefined, extra: number): CreditCheck | null {
  const s = supplierByName(d, supplierName);
  if (!s || s.creditLimit <= 0) return null;
  const current = (d.R ?? []).filter(o => o.supplier === s.name && PAYABLE_STATUSES.includes(o.status))
    .reduce((sum, o) => sum + orderRemaining(d, o), 0);
  return { limit: s.creditLimit, current, exceeds: current + extra > s.creditLimit };
}
