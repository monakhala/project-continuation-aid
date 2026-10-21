import C from './core';
import type { WorkspaceData, Product } from './types';
import { recommendation, getExpiryInfo } from './data';

/* Price intelligence derived only from recorded data. Competitor prices are user-entered;
   elasticity is measured from recorded price changes vs. sales — never assumed. */
type PricePoint = { date: string; price: number };
type Px = { comp?: Record<string, number>; hist?: Record<string, PricePoint[]> };
export const px = (d: WorkspaceData) => (d.px ?? {}) as Px;
export const competitor = (d: WorkspaceData, p: Product) => px(d).comp?.[p.id] ?? null;

export function priceOn(d: WorkspaceData, p: Product, date: string) {
  const h = [...(px(d).hist?.[p.id] ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  let v = h[0]?.price ?? p.price;
  for (const x of h) if (x.date <= date) v = x.price;
  return v;
}

export const margin = (price: number, cost: number) => price > 0 ? (price - cost) / price : 0;

export interface Week { start: string; qty: number; price: number }
export function weekly(d: WorkspaceData, p: Product, weeks = 12): Week[] {
  const today = C.todayISO();
  const out: Week[] = [];
  for (let w = weeks; w >= 1; w--) {
    const start = C.addDays(today, -7 * w), end = C.addDays(start, 7);
    const qty = d.SR.filter(r => r.pid === p.id && r.date >= start && r.date < end).reduce((s, r) => s + r.qty, 0);
    out.push({ start, qty, price: priceOn(d, p, C.addDays(start, 3)) });
  }
  const first = d.SR.filter(r => r.pid === p.id).map(r => r.date).sort()[0];
  return first ? out.filter(w => C.addDays(w.start, 7) > first) : [];
}

/** Log-log regression of weekly volume on weekly price. Null when the data cannot support it. */
export function elasticity(d: WorkspaceData, p: Product): { e: number; r2: number; n: number } | null {
  const w = weekly(d, p).filter(x => x.qty > 0 && x.price > 0);
  if (w.length < 6) return null;
  const prices = new Set(w.map(x => x.price));
  if (prices.size < 2) return null;
  const X = w.map(x => Math.log(x.price)), Y = w.map(x => Math.log(x.qty));
  const mx = X.reduce((a, b) => a + b, 0) / X.length, my = Y.reduce((a, b) => a + b, 0) / Y.length;
  let sxy = 0, sxx = 0, syy = 0;
  X.forEach((x, i) => {
    sxy += (x - mx) * ((Y[i] ?? my) - my);
    sxx += (x - mx) ** 2;
    syy += ((Y[i] ?? my) - my) ** 2;
  });
  if (sxx < 1e-6 || syy < 1e-9) return null;
  const e = sxy / sxx, r2 = (sxy * sxy) / (sxx * syy);
  return { e, r2, n: w.length };
}

export interface PriceRow {
  p: Product;
  comp: number | null;
  cost: number;
  repCost: number;
  gm: number; // Historical gross margin
  repGm: number; // Replacement gross margin
  isEroded: boolean; // Selling price is below replacement cost
  el: ReturnType<typeof elasticity>;
  opt: number | null;
  weeklyQty: number;
  liftWeekly: number;
}

export function priceRow(d: WorkspaceData, p: Product): PriceRow {
  const el = elasticity(d, p), w = weekly(d, p, 4);
  const weeklyQty = w.length ? w.reduce((s, x) => s + x.qty, 0) / w.length : 0;
  const repCost = p.repCost != null && p.repCost > 0 ? p.repCost : p.cost;
  const gm = margin(p.price, p.cost);
  const repGm = margin(p.price, repCost);
  const isEroded = p.price > 0 && p.price < repCost;

  let opt: number | null = null, liftWeekly = 0;
  // Calculate recommended price based on replacement cost to prevent margin erosion
  const costBasis = repCost > 0 ? repCost : p.cost;
  if (el && el.r2 >= 0.3 && el.e < 0 && costBasis > 0) {
    const raw = el.e < -1 ? costBasis * el.e / (1 + el.e) : p.price * 1.1; // inelastic demand: profit rises with price
    opt = Math.round(Math.min(p.price * 1.15, Math.max(p.price * 0.85, raw)) * 100) / 100;
    const q2 = weeklyQty * (opt / p.price) ** el.e;
    liftWeekly = (opt - costBasis) * q2 - (p.price - costBasis) * weeklyQty;
    if (Math.abs(opt - p.price) < 0.01) { opt = p.price; liftWeekly = 0; }
  } else if (isEroded) {
    // If margin is eroded and no elasticity data, minimum recommended price restores healthy 25% replacement margin
    opt = Math.round((repCost / 0.75) * 100) / 100;
    liftWeekly = (opt - repCost) * weeklyQty - (p.price - repCost) * weeklyQty;
  }

  return {
    p,
    comp: competitor(d, p),
    cost: p.cost,
    repCost,
    gm,
    repGm,
    isEroded,
    el,
    opt,
    weeklyQty,
    liftWeekly
  };
}

/* ---- Dashboard analytics ---- */
export function stockDaysAgo(d: WorkspaceData, p: Product, days: number) {
  const from = C.addDays(C.todayISO(), -days);
  const sold = d.SR.filter(r => r.pid === p.id && r.date >= from).reduce((s, r) => s + r.qty, 0);
  const recv = d.mv.filter(m => m.pid === p.id && m.t >= from && m.type === 'receive').reduce((s, m) => s + m.q, 0);
  return Math.max(0, p.stock + sold - recv);
}

export type Insight = {
  kind: 'erosion' | 'adjust' | 'dead' | 'stockout' | 'expiry';
  sev: 1 | 2 | 3;
  pid: number;
  name: string;
  metric: string;
  detail?: string;
};

export function analytics(d: WorkspaceData) {
  const ago = C.addDays(C.todayISO(), -30);
  const val = d.P.reduce((s, p) => s + p.stock * p.cost, 0);
  const repVal = d.P.reduce((s, p) => s + p.stock * (p.repCost ?? p.cost), 0);
  const valPrev = d.P.reduce((s, p) => s + stockDaysAgo(d, p, 30) * p.cost, 0);

  const rev = (costFn: (p: Product) => number) => {
    let r = 0, g = 0;
    d.P.forEach(p => {
      const q = d.SR.filter(x => x.pid === p.id && x.date >= C.addDays(C.todayISO(), -30)).reduce((s, x) => s + x.qty, 0);
      r += p.price * q;
      g += (p.price - costFn(p)) * q;
    });
    return r > 0 ? g / r : null;
  };

  const gm = rev(p => p.cost);
  const repGm = rev(p => p.repCost ?? p.cost);
  const gmPrev = rev(p => priceOn(d, p, ago));

  const rows = d.P.map(p => priceRow(d, p));
  const lift = rows.reduce((s, r) => s + Math.max(0, r.liftWeekly), 0);
  const weeklyGP = rows.reduce((s, r) => s + (r.p.price - r.cost) * r.weeklyQty, 0);
  const recs = d.P.map(p => ({ p, r: recommendation(d, p) })).filter(x => x.r.action === 'order');
  const capital = recs.reduce((s, x) => s + x.r.qty * (x.p.repCost ?? x.p.cost), 0);

  const insights: Insight[] = [];
  const vel = rows.map(r => r.weeklyQty).sort((a, b) => b - a);
  const fast = vel[Math.floor(vel.length / 3)] ?? Infinity;

  for (const r of rows) {
    const p = r.p;
    if (p.stock === 0) {
      insights.push({ kind: 'stockout', sev: 3, pid: p.id, name: p.name, metric: '0' });
    }
    // Task A: Flag SKUs where selling price is below replacement cost (critical erosion alert)
    if (r.isEroded) {
      insights.push({
        kind: 'erosion',
        sev: 3,
        pid: p.id,
        name: p.name,
        metric: `${(r.repGm * 100).toFixed(1)}%`,
        detail: `Price (${p.price}) < Rep. Cost (${r.repCost})`
      });
    } else if (r.repGm < 0.25 || r.gm < 0.3) {
      insights.push({
        kind: 'erosion',
        sev: r.repGm < 0.2 ? 3 : 2,
        pid: p.id,
        name: p.name,
        metric: `${(r.repGm * 100).toFixed(1)}%`
      });
    }

    if (r.opt !== null && r.opt !== p.price && r.weeklyQty >= fast) {
      insights.push({
        kind: 'adjust',
        sev: 2,
        pid: p.id,
        name: p.name,
        metric: `${r.opt > p.price ? '+' : ''}${(((r.opt - p.price) / p.price) * 100).toFixed(1)}%`
      });
    }

    const cover = r.weeklyQty > 0 ? (p.stock / r.weeklyQty) * 7 : p.stock > 0 ? Infinity : 0;
    if (p.stock > 0 && cover > 90) {
      insights.push({
        kind: 'dead',
        sev: cover === Infinity ? 3 : 1,
        pid: p.id,
        name: p.name,
        metric: cover === Infinity ? '∞' : `${Math.round(cover)}d`
      });
    }

    // Task C: Highlight expiring batches
    if (p.expiry_date && p.stock > 0) {
      const exp = getExpiryInfo(p.expiry_date);
      if (exp.tier === 'expired') {
        insights.push({ kind: 'expiry', sev: 3, pid: p.id, name: p.name, metric: 'Expired' });
      } else if (exp.tier === 'tier30') {
        insights.push({ kind: 'expiry', sev: 3, pid: p.id, name: p.name, metric: `${exp.daysLeft}d` });
      } else if (exp.tier === 'tier60') {
        insights.push({ kind: 'expiry', sev: 2, pid: p.id, name: p.name, metric: `${exp.daysLeft}d` });
      } else if (exp.tier === 'tier90') {
        insights.push({ kind: 'expiry', sev: 1, pid: p.id, name: p.name, metric: `${exp.daysLeft}d` });
      }
    }
  }

  insights.sort((a, b) => b.sev - a.sev);
  return { val, repVal, valPrev, gm, repGm, gmPrev, lift, weeklyGP, recs, capital, insights, rows };
}
