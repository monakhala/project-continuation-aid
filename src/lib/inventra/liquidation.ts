import C from './core';
import type { WorkspaceData, Product } from './types';

/* Dead stock liquidation. Pure arithmetic on recorded stock, cost, price, sales and expiry.
   Monthly holding cost rate reflects financing + storage cost of tied-up cash. */
export const HOLD_RATE_MONTHLY = 0.025;

export interface LiqInput { stock: number; cost: number; price: number; dailyVel: number; daysLeft: number | null }
export interface LiqResult {
  candidate: boolean; reason: 'expiry' | 'slow' | 'none';
  daysCover: number | null; atRiskUnits: number; trapped: number;
  holdingCost: number; discount: number; floorPrice: number; clearancePrice: number; cashRecovered: number;
}

export function liquidate(i: LiqInput): LiqResult {
  const daysCover = i.dailyVel > 0 ? i.stock / i.dailyVel : null;
  const expiring = i.daysLeft !== null && i.daysLeft <= 60;
  const slow = daysCover === null ? i.stock > 0 : daysCover > 90;
  const candidate = i.stock > 0 && (expiring || slow);
  const reason = !candidate ? 'none' : expiring ? 'expiry' : 'slow';
  const sellable = i.daysLeft === null ? i.stock : Math.min(i.stock, Math.max(0, i.dailyVel * i.daysLeft));
  const atRiskUnits = i.daysLeft === null ? 0 : Math.round(i.stock - sellable);
  const trapped = i.stock * i.cost;
  const holdDays = Math.min(daysCover ?? 365, i.daysLeft ?? 365, 365);
  const holdingCost = trapped * HOLD_RATE_MONTHLY * (holdDays / 30);
  const discount = !candidate ? 0 : i.daysLeft !== null && i.daysLeft <= 30 ? 0.4 : expiring ? 0.25 : (daysCover ?? 999) > 180 ? 0.2 : 0.15;
  // Break-even floor is cost; within 30 days of expiry recovering cash beats a full write-off.
  const floorPrice = i.daysLeft !== null && i.daysLeft <= 30 ? i.cost * 0.7 : i.cost;
  const clearancePrice = candidate ? Math.max(floorPrice, i.price * (1 - discount)) : i.price;
  return { candidate, reason, daysCover, atRiskUnits, trapped, holdingCost, discount, floorPrice,
    clearancePrice: Math.round(clearancePrice * 100) / 100, cashRecovered: Math.round(clearancePrice * i.stock) };
}

export function liquidationRows(d: WorkspaceData) {
  const today = C.todayISO(), from = C.addDays(today, -30);
  return d.P.map((p: Product) => {
    const sold = d.SR.filter(r => r.pid === p.id && r.date >= from).reduce((s, r) => s + r.qty, 0);
    const daysLeft = p.expiry_date ? C.diffDays(today, p.expiry_date) : null;
    return { p, r: liquidate({ stock: p.stock, cost: p.cost, price: p.price, dailyVel: sold / 30, daysLeft }) };
  }).filter(x => x.r.candidate).sort((a, b) => b.r.trapped - a.r.trapped);
}

/* ============ Clearance actions ============
   Applies the liquidation engine's clearance price to a product. The applied
   marker lives in px so the price is never ratcheted down twice. New sales
   recorded afterwards book revenue at the clearance price. */

type Px = { clear?: Record<string, { t: string; from: number; to: number }> };

export function clearanceApplied(d: WorkspaceData, pid: number): boolean {
  return !!((d.px ?? {}) as Px).clear?.[String(pid)];
}

export type ClearanceError = 'not_found' | 'not_candidate' | 'already_applied';

export function applyClearance(d: WorkspaceData, pid: number): { ok: true } | { ok: false; error: ClearanceError } {
  const p = d.P.find(x => x.id === pid);
  if (!p) return { ok: false, error: 'not_found' };
  if (clearanceApplied(d, pid)) return { ok: false, error: 'already_applied' };
  const row = liquidationRows(d).find(x => x.p.id === pid);
  if (!row) return { ok: false, error: 'not_candidate' };
  const from = p.price;
  p.price = row.r.clearancePrice;
  const px = (d.px ??={}) as Px;
  px.clear = { ...(px.clear ?? {}), [String(pid)]: { t: C.todayISO(), from, to: row.r.clearancePrice } };
  d.mv.unshift({ pid, t: C.todayISO(), type: 'clearance', q: p.stock, who: 'app', note: `Clearance price ${from} -> ${row.r.clearancePrice}` });
  d.N.unshift({ id: d.nid++, text: `${p.name}: clearance price set to ${row.r.clearancePrice} (was ${from}).`, read: false });
  return { ok: true };
}
