export type Role = 'head' | 'manager' | 'warehouse' | 'supplier';
export type Currency = 'EGP' | 'USD' | 'SAR';

export interface Product {
  id: number;
  sku: string;
  name: string;
  cat: string;
  wh: string;
  stock: number;
  min: number;
  max: number;
  cost: number;
  price: number;
  exp: number;
  repCost?: number | undefined;
  batch_number?: string | undefined;
  expiry_date?: string | undefined;
  locations?: Record<string, number>;
  lead?: number;
  moq?: number;
  pack?: number;
  shelf?: number;
  archived?: boolean;
  archivedOn?: string;
  src?: string;
}

export interface Sale { pid: number; date: string; qty: number; }
export interface Movement { pid: number; t: string; type: string; q: number; who: string; note?: string; fromWh?: string; toWh?: string; }
export interface Order { id: number; pid: number; qty: number; got: number; status: string; t: string; supplier?: string; paid?: number | undefined; unitCost?: number | undefined; }
export interface Supplier { id: number; name: string; terms: number; creditLimit: number; }
export interface ImportRecord { id: number; t: string; kind: string; file: string; outcome: string; summary: string; undo?: { snap: string; hash: string }; }
export interface WorkspaceData {
  P: Product[];
  archived: Product[];
  SR: Sale[];
  mv: Movement[];
  R: Order[];
  N: { id: number; text: string; read: boolean }[];
  imports: ImportRecord[];
  settings: { currency: Currency | string };
  snooze: Record<string, string>;
  watch: number[];
  alerts: string[];
  px: Record<string, unknown>;
  nid: number;
  rid: number;
}
export const sections = ['dashboard', 'inventory', 'restock', 'orders', 'forecast', 'pricing', 'notifications', 'data', 'team'] as const;
export type Section = typeof sections[number];
