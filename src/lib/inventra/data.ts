import C from './core';
import type { WorkspaceData, Product, Currency } from './types';

export const SUPPORTED_CURRENCIES: Currency[] = ['EGP', 'USD', 'SAR'];
export const DEFAULT_WAREHOUSES = [
  'Main Warehouse - 10th of Ramadan',
  'Cairo Store / Transit Hub',
  'Alexandria Hub'
] as const;

export const emptyData = (): WorkspaceData => ({
  P: [],
  archived: [],
  SR: [],
  mv: [],
  R: [],
  N: [],
  imports: [],
  settings: { currency: 'EGP' },
  snooze: {},
  watch: [],
  alerts: [],
  px: {},
  nid: 1,
  rid: 1
});

const DEMO_PRICE: ([number, number] | undefined)[] = [
  [0.92, 1.05],
  [0.95, 0.9],
  [1.1, 0.95],
  [0.9, 1],
  [0.9, 1.08],
  [1.08, 0.95],
  [0.94, 1.04],
  [0.92, 1],
  undefined
];
const DEMO_E = [-0.6, -2.4, -1.8, -0.5, -0.7, -1.6, -0.8, -2.2, 0];

interface DemoRow {
  name: string;
  sku: string;
  cat: string;
  stock: number;
  min: number;
  max: number;
  cost: number;
  repCost: number;
  price: number;
  base: number;
  batch: string;
  expDays: number;
  locations: Record<string, number>;
}

export function demoData(): WorkspaceData {
  const rows: DemoRow[] = [
    {
      name: 'Organic Oat Milk 1L', sku: 'DR-101', cat: 'Beverages',
      stock: 98, min: 40, max: 400, cost: 65, repCost: 78, price: 110, base: 13,
      batch: 'LOT-2026-OM01', expDays: 24,
      locations: { 'Main Warehouse - 10th of Ramadan': 70, 'Cairo Store / Transit Hub': 28 }
    },
    {
      name: 'Almond Butter 340g', sku: 'PA-204', cat: 'Pantry',
      stock: 210, min: 60, max: 400, cost: 120, repCost: 145, price: 215, base: 6,
      batch: 'LOT-2026-AB04', expDays: 52,
      locations: { 'Main Warehouse - 10th of Ramadan': 150, 'Cairo Store / Transit Hub': 60 }
    },
    {
      name: 'Greek Yogurt 500g', sku: 'DA-310', cat: 'Dairy',
      stock: 320, min: 40, max: 200, cost: 45, repCost: 55, price: 85, base: 8,
      batch: 'LOT-2026-GY12', expDays: 78,
      locations: { 'Main Warehouse - 10th of Ramadan': 220, 'Cairo Store / Transit Hub': 100 }
    },
    {
      // High inflation shield case: Replacement cost (420) is higher than current selling price (395)
      name: 'Basmati Rice 5kg', sku: 'PA-118', cat: 'Pantry',
      stock: 0, min: 30, max: 300, cost: 280, repCost: 420, price: 395, base: 5,
      batch: 'LOT-2026-BR99', expDays: 320,
      locations: { 'Main Warehouse - 10th of Ramadan': 0, 'Cairo Store / Transit Hub': 0 }
    },
    {
      // Transit hub is 0, main warehouse has 35 -> candidate for inter-warehouse transfer
      name: 'Cold Brew Coffee 330ml', sku: 'DR-155', cat: 'Beverages',
      stock: 35, min: 40, max: 300, cost: 38, repCost: 46, price: 75, base: 9,
      batch: 'LOT-2026-CB15', expDays: 45,
      locations: { 'Main Warehouse - 10th of Ramadan': 35, 'Cairo Store / Transit Hub': 0 }
    },
    {
      name: 'Extra Virgin Olive Oil 1L', sku: 'PA-230', cat: 'Pantry',
      stock: 140, min: 50, max: 300, cost: 260, repCost: 310, price: 450, base: 4,
      batch: 'LOT-2026-EV23', expDays: 190,
      locations: { 'Main Warehouse - 10th of Ramadan': 100, 'Cairo Store / Transit Hub': 40 }
    },
    {
      // Critical FEFO alert: expiring in 12 days
      name: 'Protein Bar Box (12)', sku: 'SN-402', cat: 'Snacks',
      stock: 180, min: 50, max: 350, cost: 320, repCost: 390, price: 580, base: 5,
      batch: 'LOT-2026-PB40', expDays: 12,
      locations: { 'Main Warehouse - 10th of Ramadan': 120, 'Cairo Store / Transit Hub': 60 }
    },
    {
      name: 'Sparkling Water 24pk', sku: 'DR-170', cat: 'Beverages',
      stock: 390, min: 60, max: 300, cost: 180, repCost: 210, price: 310, base: 5,
      batch: 'LOT-2026-SW17', expDays: 240,
      locations: { 'Main Warehouse - 10th of Ramadan': 290, 'Cairo Store / Transit Hub': 100 }
    },
    {
      name: 'Matcha Powder 100g', sku: 'PA-290', cat: 'Pantry',
      stock: 25, min: 10, max: 80, cost: 350, repCost: 420, price: 590, base: 0,
      batch: 'LOT-2026-MP29', expDays: 110,
      locations: { 'Main Warehouse - 10th of Ramadan': 20, 'Cairo Store / Transit Hub': 5 }
    }
  ];

  const d = emptyData();
  const hist: Record<number, { date: string; price: number }[]> = {};

  rows.forEach((row, i) => {
    const p: Product = {
      id: i + 1,
      name: row.name,
      sku: row.sku,
      cat: row.cat,
      stock: row.stock,
      min: row.min,
      max: row.max,
      cost: row.cost,
      repCost: row.repCost,
      price: row.price,
      wh: row.locations['Main Warehouse - 10th of Ramadan'] ? 'Main Warehouse - 10th of Ramadan' : 'Cairo Store / Transit Hub',
      locations: row.locations,
      batch_number: row.batch,
      expiry_date: C.addDays(C.todayISO(), row.expDays),
      exp: 999,
      lead: 3,
      src: 'demo'
    };
    d.P.push(p);

    const steps = DEMO_PRICE[i];
    const n = i === 8 ? 6 : 60;
    if (steps) {
      hist[p.id] = [
        { date: C.addDays(C.todayISO(), -n), price: +(row.price * steps[0]).toFixed(2) },
        { date: C.addDays(C.todayISO(), -40), price: +(row.price * steps[1]).toFixed(2) },
        { date: C.addDays(C.todayISO(), -20), price: row.price }
      ];
    }
    for (let k = 0; k < n; k++) {
      const day = k - n;
      const f = steps ? (day < -40 ? steps[0] : day < -20 ? steps[1] : 1) : 1;
      d.SR.push({
        pid: p.id,
        date: C.addDays(C.todayISO(), day),
        qty: Math.round(row.base * (f ** (DEMO_E[i] ?? 0)) * (([0.9, 0.9, 1, 1, 1.1, 1.6, 1.8][k % 7]) ?? 1))
      });
    }
  });

  d.px = {
    comp: { 1: 105, 2: 210, 3: 82, 4: 410, 5: 72, 6: 440, 7: 570 },
    hist
  };
  d.R = [
    { id: 1, pid: 1, qty: 120, got: 0, status: 'Pending Approval', t: C.todayISO(), supplier: 'FreshLine Foods' },
    { id: 2, pid: 5, qty: 80, got: 0, status: 'Confirmed', t: C.todayISO(), supplier: 'SwiftDist' }
  ];
  d.rid = 3;
  d.N = [
    { id: 1, text: 'Basmati Rice 5kg: selling price is below replacement cost (EGP 420).', read: false },
    { id: 2, text: 'Protein Bar Box (12): batch LOT-2026-PB40 expires within 12 days.', read: false },
    { id: 3, text: 'Organic Oat Milk: purchase request awaiting approval.', read: false }
  ];
  d.nid = 4;
  return d;
}

export function series(d: WorkspaceData, p: Product): number[] {
  const dates = d.SR.filter(r => r.pid === p.id).map(r => r.date).sort();
  const first = dates[0];
  return first ? C.dailySeries(d.SR, p.id, first, C.addDays(C.todayISO(), -1)) : [];
}

export const forecastFor = (d: WorkspaceData, p: Product) => C.chooseForecast(series(d, p), 90);
export const recommendation = (d: WorkspaceData, p: Product) => C.recommend({
  onHand: p.stock,
  openPO: C.openPOQty(d.R, p.id),
  pendingQty: d.R.filter(r => r.pid === p.id && r.status === 'Pending Approval').reduce((s, r) => s + r.qty, 0),
  leadDays: p.lead,
  forecast: forecastFor(d, p),
  moq: p.moq ?? 0,
  packSize: p.pack ?? 1,
  maxLevel: p.max || null,
  shelfLifeDays: p.shelf ?? null
});

export const status = (p: Product) => p.stock === 0 ? 'Out of stock' : p.stock <= p.min ? 'Low stock' : 'In stock';

export const money = (d: WorkspaceData, n: number, lang: 'en' | 'ar' = 'en') => {
  const curr = d.settings?.currency || 'EGP';
  try {
    const locale = lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';
    return new Intl.NumberFormat(locale, { style: 'currency', currency: curr, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${curr} ${Number(n).toFixed(2)}`;
  }
};

export const dataHash = (d: WorkspaceData) => C.hashData({ P: d.P, archived: d.archived, SR: d.SR, mv: d.mv, R: d.R });

export function download(name: string, text: string, type = 'application/json') {
  const u = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}

export type ExpiryTier = 'expired' | 'tier30' | 'tier60' | 'tier90' | 'healthy' | 'none';
export interface ExpiryInfo {
  tier: ExpiryTier;
  daysLeft: number | null;
  tone: 'crit' | 'low' | 'ok' | 'idle';
  labelKey: 'expired' | 'expiring30' | 'expiring60' | 'expiring90' | 'expiringHealthy' | 'na';
  markdownActionKey: 'mdQuarantine' | 'mdFlash' | 'mdPromo' | 'mdPrioritize' | 'mdNone';
}

export function getExpiryInfo(expiryDate?: string): ExpiryInfo {
  if (!expiryDate) {
    return { tier: 'none', daysLeft: null, tone: 'idle', labelKey: 'na', markdownActionKey: 'mdNone' };
  }
  const days = C.diffDays(C.todayISO(), expiryDate);
  if (days <= 0) {
    return { tier: 'expired', daysLeft: days, tone: 'crit', labelKey: 'expired', markdownActionKey: 'mdQuarantine' };
  }
  if (days <= 30) {
    return { tier: 'tier30', daysLeft: days, tone: 'crit', labelKey: 'expiring30', markdownActionKey: 'mdFlash' };
  }
  if (days <= 60) {
    return { tier: 'tier60', daysLeft: days, tone: 'low', labelKey: 'expiring60', markdownActionKey: 'mdPromo' };
  }
  if (days <= 90) {
    return { tier: 'tier90', daysLeft: days, tone: 'low', labelKey: 'expiring90', markdownActionKey: 'mdPrioritize' };
  }
  return { tier: 'healthy', daysLeft: days, tone: 'ok', labelKey: 'expiringHealthy', markdownActionKey: 'mdNone' };
}
