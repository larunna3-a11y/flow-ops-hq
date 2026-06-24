// Mock data for FlowOps SaaS UI — Indonesian e-commerce operations
export type Role = "Owner" | "Supervisor" | "Packer" | "Return Staff";

export type Marketplace =
  | "Shopee"
  | "TikTok Shop"
  | "Lazada"
  | "Tokopedia"
  | "Blibli";

export type Courier =
  | "J&T Express"
  | "SPX Express"
  | "ID Express"
  | "AnterAja"
  | "SiCepat"
  | "GoTo Logistic"
  | "Lazada Express"
  | "JNE";

export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "active" | "invited" | "disabled";
  lastActive: string;
  avatarColor: string;
}

export const currentUser: MockUser = {
  id: "u_001",
  name: "Andi Pratama",
  email: "andi@flowops.id",
  role: "Owner",
  status: "active",
  lastActive: "Just now",
  avatarColor: "oklch(0.65 0.16 220)",
};

export const workspace = {
  name: "Nusantara Logistik",
  plan: "Growth",
  members: 14,
};

export const users: MockUser[] = [
  currentUser,
  { id: "u_002", name: "Putri Anggraini", email: "putri@flowops.id", role: "Supervisor", status: "active", lastActive: "5 min ago", avatarColor: "oklch(0.7 0.15 155)" },
  { id: "u_003", name: "Budi Santoso", email: "budi@flowops.id", role: "Packer", status: "active", lastActive: "12 min ago", avatarColor: "oklch(0.7 0.15 75)" },
  { id: "u_004", name: "Siti Rahayu", email: "siti@flowops.id", role: "Packer", status: "active", lastActive: "1 hr ago", avatarColor: "oklch(0.6 0.2 320)" },
  { id: "u_005", name: "Dewi Lestari", email: "dewi@flowops.id", role: "Return Staff", status: "active", lastActive: "20 min ago", avatarColor: "oklch(0.65 0.16 30)" },
  { id: "u_006", name: "Rizky Maulana", email: "rizky@flowops.id", role: "Packer", status: "invited", lastActive: "—", avatarColor: "oklch(0.6 0.15 280)" },
  { id: "u_007", name: "Agus Wijaya", email: "agus@flowops.id", role: "Supervisor", status: "disabled", lastActive: "3 days ago", avatarColor: "oklch(0.5 0.05 240)" },
];

export interface PackingOrder {
  id: string;
  orderNumber: string;
  marketplace: Marketplace;
  items: number;
  packer?: string;
  status: "queued" | "in_progress" | "packed" | "shipped";
  priority: "low" | "normal" | "high";
  courier: Courier;
  createdAt: string;
}

export const packingOrders: PackingOrder[] = [
  { id: "p1", orderNumber: "INV/20260624/MPL/4410293", marketplace: "Shopee", items: 3, packer: "Budi Santoso", status: "in_progress", priority: "high", courier: "SPX Express", createdAt: "2m ago" },
  { id: "p2", orderNumber: "TS-2026062400294", marketplace: "TikTok Shop", items: 1, packer: "Siti Rahayu", status: "packed", priority: "normal", courier: "J&T Express", createdAt: "4m ago" },
  { id: "p3", orderNumber: "LZD-880012349-0295", marketplace: "Lazada", items: 5, status: "queued", priority: "high", courier: "Lazada Express", createdAt: "6m ago" },
  { id: "p4", orderNumber: "INV/20260624/MPL/4410296", marketplace: "Shopee", items: 2, packer: "Budi Santoso", status: "shipped", priority: "low", courier: "SiCepat", createdAt: "10m ago" },
  { id: "p5", orderNumber: "TKP-INV-2026-10297", marketplace: "Tokopedia", items: 4, status: "queued", priority: "normal", courier: "AnterAja", createdAt: "12m ago" },
  { id: "p6", orderNumber: "BLB-20260624-10298", marketplace: "Blibli", items: 1, packer: "Siti Rahayu", status: "packed", priority: "normal", courier: "ID Express", createdAt: "15m ago" },
  { id: "p7", orderNumber: "TS-2026062400299", marketplace: "TikTok Shop", items: 7, status: "queued", priority: "high", courier: "GoTo Logistic", createdAt: "18m ago" },
  { id: "p8", orderNumber: "TKP-INV-2026-10300", marketplace: "Tokopedia", items: 2, packer: "Budi Santoso", status: "in_progress", priority: "normal", courier: "JNE", createdAt: "21m ago" },
];

export interface ScanEvent {
  id: string;
  code: string;
  type: "barcode" | "qr";
  order: string;
  scannedBy: string;
  station: string;
  timestamp: string;
  result: "matched" | "mismatch" | "unknown";
}

export const scanEvents: ScanEvent[] = [
  { id: "s1", code: "8991234567890", type: "barcode", order: "INV/20260624/MPL/4410293", scannedBy: "Budi Santoso", station: "Pack Station 02", timestamp: "10:42:11", result: "matched" },
  { id: "s2", code: "QR-TS-10294-A", type: "qr", order: "TS-2026062400294", scannedBy: "Siti Rahayu", station: "Pack Station 01", timestamp: "10:41:55", result: "matched" },
  { id: "s3", code: "8800123498765", type: "barcode", order: "LZD-880012349-0295", scannedBy: "Budi Santoso", station: "Pack Station 02", timestamp: "10:40:18", result: "mismatch" },
  { id: "s4", code: "QR-TKP-10296-B", type: "qr", order: "INV/20260624/MPL/4410296", scannedBy: "Siti Rahayu", station: "Pack Station 01", timestamp: "10:39:02", result: "matched" },
  { id: "s5", code: "0000000000000", type: "barcode", order: "—", scannedBy: "Dewi Lestari", station: "Returns Bay", timestamp: "10:36:44", result: "unknown" },
  { id: "s6", code: "QR-RET-3392", type: "qr", order: "INV/20260620/MPL/4410211", scannedBy: "Dewi Lestari", station: "Returns Bay", timestamp: "10:34:21", result: "matched" },
];

export interface Return {
  id: string;
  rma: string;
  order: string;
  reason: "Damaged" | "Wrong item" | "No longer wanted" | "Late delivery" | "Defective";
  status: "received" | "inspecting" | "restocked" | "rejected";
  marketplace: Marketplace;
  assignedTo?: string;
  receivedAt: string;
}

export const returns: Return[] = [
  { id: "r1", rma: "RMA-44120", order: "INV/20260620/MPL/4410211", reason: "Damaged", status: "inspecting", marketplace: "Shopee", assignedTo: "Dewi Lestari", receivedAt: "Today" },
  { id: "r2", rma: "RMA-44121", order: "TS-2026061900198", reason: "Wrong item", status: "received", marketplace: "TikTok Shop", receivedAt: "Today" },
  { id: "r3", rma: "RMA-44122", order: "LZD-880012298-0142", reason: "No longer wanted", status: "restocked", marketplace: "Lazada", assignedTo: "Dewi Lestari", receivedAt: "Yesterday" },
  { id: "r4", rma: "RMA-44123", order: "INV/20260618/MPL/4410090", reason: "Defective", status: "rejected", marketplace: "Shopee", assignedTo: "Dewi Lestari", receivedAt: "Yesterday" },
  { id: "r5", rma: "RMA-44124", order: "TKP-INV-2026-10077", reason: "Late delivery", status: "restocked", marketplace: "Tokopedia", assignedTo: "Dewi Lestari", receivedAt: "2 days ago" },
  { id: "r6", rma: "RMA-44125", order: "BLB-20260617-10059", reason: "Damaged", status: "inspecting", marketplace: "Blibli", receivedAt: "2 days ago" },
];

// Charts
export const packingTrend = [
  { day: "Sen", packed: 312, target: 350 },
  { day: "Sel", packed: 388, target: 350 },
  { day: "Rab", packed: 421, target: 350 },
  { day: "Kam", packed: 365, target: 350 },
  { day: "Jum", packed: 472, target: 400 },
  { day: "Sab", packed: 510, target: 400 },
  { day: "Min", packed: 298, target: 300 },
];

export const marketplaceBreakdown = [
  { name: "Shopee", orders: 1840, returns: 102 },
  { name: "TikTok Shop", orders: 1320, returns: 71 },
  { name: "Tokopedia", orders: 980, returns: 48 },
  { name: "Lazada", orders: 612, returns: 36 },
  { name: "Blibli", orders: 245, returns: 11 },
];

export const courierStats = [
  { name: "J&T Express", shipments: 1120, onTime: 96 },
  { name: "SPX Express", shipments: 980, onTime: 95 },
  { name: "SiCepat", shipments: 742, onTime: 94 },
  { name: "AnterAja", shipments: 521, onTime: 93 },
  { name: "ID Express", shipments: 388, onTime: 91 },
  { name: "GoTo Logistic", shipments: 322, onTime: 92 },
  { name: "Lazada Express", shipments: 268, onTime: 90 },
];

export const userProductivity = [
  { name: "Budi Santoso", role: "Packer", packed: 412, accuracy: 99.1, hours: 38 },
  { name: "Siti Rahayu", role: "Packer", packed: 388, accuracy: 98.6, hours: 36 },
  { name: "Putri Anggraini", role: "Supervisor", packed: 142, accuracy: 99.5, hours: 40 },
  { name: "Dewi Lestari", role: "Return Staff", packed: 0, accuracy: 97.8, hours: 35 },
];

export const recentActivity = [
  { id: "a1", user: "Budi Santoso", action: "packed order INV/20260624/MPL/4410293", time: "2m ago" },
  { id: "a2", user: "Dewi Lestari", action: "inspected RMA-44120", time: "8m ago" },
  { id: "a3", user: "Siti Rahayu", action: "scanned QR-TS-10294-A", time: "11m ago" },
  { id: "a4", user: "Putri Anggraini", action: "invited rizky@flowops.id", time: "1h ago" },
  { id: "a5", user: "Andi Pratama", action: "exported weekly report", time: "3h ago" },
];
