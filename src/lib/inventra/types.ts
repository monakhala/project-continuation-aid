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
export interface Order { id: number; pid: number; qty: number; got: number; status: string; t: string; supplier?: string | undefined; paid?: number | undefined; unitCost?: number | undefined; }
export interface TransferItem { pid: number; qty: number; }
export interface Transfer {
  id: number;
  fromWh: string;
  toWh: string;
  items: TransferItem[];
  status: 'draft' | 'in_transit' | 'completed' | 'cancelled';
  t: string;
  receivedAt?: string | undefined;
  note?: string | undefined;
}
export type CourierStatus = 'in_transit' | 'delivered' | 'rto' | 'remitted';
export interface CourierShipment {
  id: number;
  tracking: string;
  courier: string;
  customer: string;
  items: { pid: number; qty: number }[];
  codAmount: number;
  remittedAmount?: number | undefined;
  fee: number;
  status: CourierStatus;
  t: string;
  deliveredAt?: string | undefined;
  remittedAt?: string | undefined;
}
export interface Supplier { id: number; name: string; terms: number; creditLimit: number; }
export interface ImportRecord { id: number; t: string; kind: string; file: string; outcome: string; summary: string; undo?: { snap: string; hash: string }; }
export interface WorkspaceData {
  P: Product[];
  archived: Product[];
  SR: Sale[];
  mv: Movement[];
  R: Order[];
  transfers: Transfer[];
  shipments: CourierShipment[];
  sup: Supplier[];
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
export const sections = ['dashboard', 'inventory', 'restock', 'orders', 'credit', 'transfers', 'courier', 'forecast', 'pricing', 'notifications', 'data', 'team'] as const;
export type Section = typeof sections[number];
