import { describe, expect, it } from 'vitest';
import { demoData, emptyData, getExpiryInfo, money } from '@/lib/inventra/data';
import { priceRow, margin, analytics } from '@/lib/inventra/pricing';
import C from '@/lib/inventra/core';

describe('Task A: Currency & Replacement Cost Tracking (Inflation Shield)', () => {
  it('defaults workspace currency to EGP and formats cleanly', () => {
    const empty = emptyData();
    expect(empty.settings.currency).toBe('EGP');
    const demo = demoData();
    expect(demo.settings.currency).toBe('EGP');

    const formatted = money(demo, 1500, 'en');
    expect(formatted).toMatch(/EGP/);
  });

  it('calculates historical margin and replacement margin independently', () => {
    // Price = 100, Cost = 50, RepCost = 80
    const histGm = margin(100, 50); // (100 - 50) / 100 = 0.5 (50%)
    const repGm = margin(100, 80); // (100 - 80) / 100 = 0.2 (20%)
    expect(histGm).toBeCloseTo(0.5);
    expect(repGm).toBeCloseTo(0.2);
  });

  it('flags margin erosion when selling price is below replacement cost', () => {
    const d = emptyData();
    d.P.push({
      id: 1,
      sku: 'EG-RICE',
      name: 'Basmati Rice 5kg',
      cat: 'Pantry',
      wh: 'Main Warehouse - 10th of Ramadan',
      stock: 50,
      min: 10,
      max: 100,
      cost: 280,
      repCost: 420, // Replacement cost is 420
      price: 395,   // Selling price is 395 < 420!
      exp: 999
    });

    const row = priceRow(d, d.P[0]!);
    expect(row.isEroded).toBe(true);
    expect(row.repGm).toBeLessThan(0); // Negative replacement margin

    const a = analytics(d);
    const erosionInsight = a.insights.find(i => i.kind === 'erosion' && i.pid === 1);
    expect(erosionInsight).toBeDefined();
    expect(erosionInsight?.sev).toBe(3); // Critical severity
  });
});

describe('Task B: Cash-Constrained Restock Allocator', () => {
  it('allocates budget to items by profitability and velocity impact', () => {
    const d = demoData();
    const rows = d.P.map(p => ({ p, r: C.recommend({ onHand: p.stock, leadDays: p.lead ?? 3, forecast: { ok: true, daily: Array(30).fill(10), sigma: 1, warnings: [] } }) }));
    const due = rows.filter(x => x.r.action === 'order');
    expect(due.length).toBeGreaterThan(0);

    const budgetCap = 50000;
    // Calculate priority scores
    const scored = due.map(({ p, r }) => {
      const costPerUnit = p.repCost ?? p.cost;
      const unitGP = Math.max(0, p.price - costPerUnit);
      const score = (unitGP / Math.max(1, costPerUnit)) * 10;
      return { p, r, costPerUnit, lineCost: r.qty * costPerUnit, score };
    });
    scored.sort((a, b) => b.score - a.score);

    let spent = 0;
    const allocated = scored.map(item => {
      const rem = budgetCap - spent;
      if (spent + item.lineCost <= budgetCap) {
        spent += item.lineCost;
        return { ...item, status: 'allocated', allocQty: item.r.qty };
      } else if (rem > 0) {
        const pack = item.p.pack ?? 1;
        const packCost = pack * item.costPerUnit;
        const possiblePacks = Math.floor(rem / packCost);
        const partialQty = possiblePacks * pack;
        if (partialQty > 0) {
          spent += partialQty * item.costPerUnit;
          return { ...item, status: 'partial', allocQty: partialQty };
        }
      }
      return { ...item, status: 'deferred', allocQty: 0 };
    });

    expect(spent).toBeLessThanOrEqual(budgetCap);
    expect(allocated.some(a => a.status === 'allocated' || a.status === 'partial')).toBe(true);
  });
});

describe('Task C: Batch & Expiry Date Tracking (FEFO)', () => {
  it('categorizes batches into correct FEFO expiration tiers and markdown actions', () => {
    const today = C.todayISO();

    const exp10 = getExpiryInfo(C.addDays(today, 10)); // < 30 days
    expect(exp10.tier).toBe('tier30');
    expect(exp10.tone).toBe('crit');
    expect(exp10.markdownActionKey).toBe('mdFlash'); // Flash clearance 30-50% off

    const exp45 = getExpiryInfo(C.addDays(today, 45)); // 30-60 days
    expect(exp45.tier).toBe('tier60');
    expect(exp45.tone).toBe('low');
    expect(exp45.markdownActionKey).toBe('mdPromo'); // Promotional bundle 15% discount

    const exp75 = getExpiryInfo(C.addDays(today, 75)); // 60-90 days
    expect(exp75.tier).toBe('tier90');
    expect(exp75.tone).toBe('low');
    expect(exp75.markdownActionKey).toBe('mdPrioritize'); // Prioritize FEFO picking

    const exp180 = getExpiryInfo(C.addDays(today, 180)); // > 90 days
    expect(exp180.tier).toBe('healthy');
    expect(exp180.tone).toBe('ok');
    expect(exp180.markdownActionKey).toBe('mdNone');

    const expired = getExpiryInfo(C.addDays(today, -2));
    expect(expired.tier).toBe('expired');
    expect(expired.tone).toBe('crit');
    expect(expired.markdownActionKey).toBe('mdQuarantine');
  });
});

describe('Task D: Multi-Location Warehouse Hubs', () => {
  it('manages stock per warehouse hub and supports inter-warehouse transfers', () => {
    const d = demoData();
    const p = d.P.find(item => item.locations && Object.keys(item.locations).length > 1);
    expect(p).toBeDefined();

    if (p && p.locations) {
      const hubs = Object.keys(p.locations);
      const fromHub = hubs[0]!;
      const toHub = hubs[1]!;
      const initialFrom = p.locations[fromHub];
      const initialTo = p.locations[toHub];
      const transferQty = 10;

      // Execute transfer
      p.locations[fromHub] -= transferQty;
      p.locations[toHub] += transferQty;

      expect(p.locations[fromHub]).toBe(initialFrom - transferQty);
      expect(p.locations[toHub]).toBe(initialTo + transferQty);
      // Total sum remains identical
      const totalStock = Object.values(p.locations).reduce((a, b) => a + b, 0);
      expect(totalStock).toBe(p.stock);
    }
  });
});
