export interface ScanVerificationItem {
  pid: number;
  sku: string;
  name: string;
  expectedQty: number;
  scannedQty: number;
}

export function initScanSession(
  items: { pid: number; qty: number }[],
  products: { id: number; sku: string; name: string }[],
): ScanVerificationItem[] {
  return items.map(item => {
    const product = products.find(p => p.id === item.pid);
    return {
      pid: item.pid,
      sku: product?.sku ?? String(item.pid),
      name: product?.name ?? `Product ${item.pid}`,
      expectedQty: Math.max(0, item.qty),
      scannedQty: 0,
    };
  });
}

export function recordScan(
  session: ScanVerificationItem[],
  scannedCode: string,
): { session: ScanVerificationItem[]; matched: boolean; completed: boolean } {
  const code = scannedCode.trim().toLocaleLowerCase();
  const index = code ? session.findIndex(item => item.sku.trim().toLocaleLowerCase() === code && item.scannedQty < item.expectedQty) : -1;
  const updated = index < 0
    ? session
    : session.map((item, i) => i === index ? { ...item, scannedQty: Math.min(item.expectedQty, item.scannedQty + 1) } : item);
  return {
    session: updated,
    matched: index >= 0,
    completed: updated.every(item => item.scannedQty >= item.expectedQty),
  };
}
