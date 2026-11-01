import { describe, it, expect } from 'vitest';
import { liquidate } from '../lib/inventra/liquidation';

describe('Dead stock liquidation', () => {
  it('never prices below cost for slow movers', () => {
    const r = liquidate({ stock: 100, cost: 90, price: 100, dailyVel: 0.2, daysLeft: null });
    expect(r.candidate).toBe(true);
    expect(r.reason).toBe('slow');
    expect(r.clearancePrice).toBe(90);
  });
  it('allows 30% below cost within 30 days of expiry', () => {
    const r = liquidate({ stock: 100, cost: 100, price: 120, dailyVel: 1, daysLeft: 10 });
    expect(r.reason).toBe('expiry');
    expect(r.clearancePrice).toBe(72);
    expect(r.atRiskUnits).toBe(90);
  });
  it('skips healthy fast movers', () => {
    expect(liquidate({ stock: 50, cost: 10, price: 20, dailyVel: 5, daysLeft: 200 }).candidate).toBe(false);
  });
});
