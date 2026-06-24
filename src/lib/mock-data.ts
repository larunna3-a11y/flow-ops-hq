// Mock data for FlowOps SaaS UI
export type Role = "Owner" | "Supervisor" | "Packer" | "Return Staff";

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
  name: "Alex Morgan",
  email: "alex@flowops.io",
  role: "Owner",
  status: "active",
  lastActive: "Just now",
  avatarColor: "oklch(0.65 0.16 220)",
};

export const workspace = {
  name: "Northwind Logistics",
  plan: "Growth",
  members: 14,
};

export const users: MockUser[] = [
  currentUser,
  { id: "u_002", name: "Priya Shah", email: "priya@flowops.io", role: "Supervisor", status: "active", lastActive: "5 min ago", avatarColor: "oklch(0.7 0.15 155)" },
  { id: "u_003", name: "Marcus Lee", email: "marcus@flowops.io", role: "Packer", status: "active", lastActive: "12 min ago", avatarColor: "oklch(0.7 0.15 75)" },
  { id: "u_004", name: "Sofia Reyes", email: "sofia@flowops.io", role: "Packer", status: "active", lastActive: "1 hr ago", avatarColor: "oklch(0.6 0.2 320)" },
  { id: "u_005", name: "Daniel Kim", email: "daniel@flowops.io", role: "Return Staff", status: "active", lastActive: "20 min ago", avatarColor: "oklch(0.65 0.16 30)" },
  { id: "u_006", name: "Emma Watson", email: "emma@flowops.io", role: "Packer", status: "invited", lastActive: "—", avatarColor: "oklch(0.6 0.15 280)" },
  { id: "u_007", name: "Liam Chen", email: "liam@flowops.io", role: "Supervisor", status: "disabled", lastActive: "3 days ago", avatarColor: "oklch(0.5 0.05 240)" },
];

export interface PackingOrder {
  id: string;
  orderNumber: string;
  marketplace: "Amazon" | "Shopify" | "Trendyol" | "eBay" | "Etsy";
  items: number;
  packer?: string;
  status: "queued" | "in_progress" | "packed" | "shipped";
  priority: "low" | "normal" | "high";
  courier: "UPS" | "FedEx" | "DHL" | "USPS";
  createdAt: string;
}

export const packingOrders: PackingOrder[] = [
  { id: "p1", orderNumber: "FO-10293", marketplace: "Amazon", items: 3, packer: "Marcus Lee", status: "in_progress", priority: "high", courier: "UPS", createdAt: "2m ago" },
  { id: "p2", orderNumber: "FO-10294", marketplace: "Shopify", items: 1, packer: "Sofia Reyes", status: "packed", priority: "normal", courier: "FedEx", createdAt: "4m ago" },
  { id: "p3", orderNumber: "FO-10295", marketplace: "Trendyol", items: 5, status: "queued", priority: "high", courier: "DHL", createdAt: "6m ago" },
  { id: "p4", orderNumber: "FO-10296", marketplace: "Amazon", items: 2, packer: "Marcus Lee", status: "shipped", priority: "low", courier: "USPS", createdAt: "10m ago" },
  { id: "p5", orderNumber: "FO-10297", marketplace: "eBay", items: 4, status: "queued", priority: "normal", courier: "UPS", createdAt: "12m ago" },
  { id: "p6", orderNumber: "FO-10298", marketplace: "Etsy", items: 1, packer: "Sofia Reyes", status: "packed", priority: "normal", courier: "FedEx", createdAt: "15m ago" },
  { id: "p7", orderNumber: "FO-10299", marketplace: "Shopify", items: 7, status: "queued", priority: "high", courier: "DHL", createdAt: "18m ago" },
  { id: "p8", orderNumber: "FO-10300", marketplace: "Amazon", items: 2, packer: "Marcus Lee", status: "in_progress", priority: "normal", courier: "UPS", createdAt: "21m ago" },
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
  { id: "s1", code: "8901234567890", type: "barcode", order: "FO-10293", scannedBy: "Marcus Lee", station: "Pack Station 02", timestamp: "10:42:11", result: "matched" },
  { id: "s2", code: "QR-FO10294-A", type: "qr", order: "FO-10294", scannedBy: "Sofia Reyes", station: "Pack Station 01", timestamp: "10:41:55", result: "matched" },
  { id: "s3", code: "8800123498765", type: "barcode", order: "FO-10295", scannedBy: "Marcus Lee", station: "Pack Station 02", timestamp: "10:40:18", result: "mismatch" },
  { id: "s4", code: "QR-FO10296-B", type: "qr", order: "FO-10296", scannedBy: "Sofia Reyes", station: "Pack Station 01", timestamp: "10:39:02", result: "matched" },
  { id: "s5", code: "0000000000000", type: "barcode", order: "—", scannedBy: "Daniel Kim", station: "Returns Bay", timestamp: "10:36:44", result: "unknown" },
  { id: "s6", code: "QR-RET-3392", type: "qr", order: "FO-10211", scannedBy: "Daniel Kim", station: "Returns Bay", timestamp: "10:34:21", result: "matched" },
];

export interface Return {
  id: string;
  rma: string;
  order: string;
  reason: "Damaged" | "Wrong item" | "No longer wanted" | "Late delivery" | "Defective";
  status: "received" | "inspecting" | "restocked" | "rejected";
  marketplace: string;
  assignedTo?: string;
  receivedAt: string;
}

export const returns: Return[] = [
  { id: "r1", rma: "RMA-44120", order: "FO-10211", reason: "Damaged", status: "inspecting", marketplace: "Amazon", assignedTo: "Daniel Kim", receivedAt: "Today" },
  { id: "r2", rma: "RMA-44121", order: "FO-10198", reason: "Wrong item", status: "received", marketplace: "Shopify", receivedAt: "Today" },
  { id: "r3", rma: "RMA-44122", order: "FO-10142", reason: "No longer wanted", status: "restocked", marketplace: "Trendyol", assignedTo: "Daniel Kim", receivedAt: "Yesterday" },
  { id: "r4", rma: "RMA-44123", order: "FO-10090", reason: "Defective", status: "rejected", marketplace: "Amazon", assignedTo: "Daniel Kim", receivedAt: "Yesterday" },
  { id: "r5", rma: "RMA-44124", order: "FO-10077", reason: "Late delivery", status: "restocked", marketplace: "eBay", assignedTo: "Daniel Kim", receivedAt: "2 days ago" },
  { id: "r6", rma: "RMA-44125", order: "FO-10059", reason: "Damaged", status: "inspecting", marketplace: "Shopify", receivedAt: "2 days ago" },
];

// Charts
export const packingTrend = [
  { day: "Mon", packed: 312, target: 350 },
  { day: "Tue", packed: 388, target: 350 },
  { day: "Wed", packed: 421, target: 350 },
  { day: "Thu", packed: 365, target: 350 },
  { day: "Fri", packed: 472, target: 400 },
  { day: "Sat", packed: 510, target: 400 },
  { day: "Sun", packed: 298, target: 300 },
];

export const marketplaceBreakdown = [
  { name: "Amazon", orders: 1240, returns: 88 },
  { name: "Shopify", orders: 920, returns: 41 },
  { name: "Trendyol", orders: 612, returns: 36 },
  { name: "eBay", orders: 405, returns: 22 },
  { name: "Etsy", orders: 188, returns: 9 },
];

export const courierStats = [
  { name: "UPS", shipments: 980, onTime: 96 },
  { name: "FedEx", shipments: 742, onTime: 94 },
  { name: "DHL", shipments: 521, onTime: 92 },
  { name: "USPS", shipments: 388, onTime: 89 },
];

export const userProductivity = [
  { name: "Marcus Lee", role: "Packer", packed: 412, accuracy: 99.1, hours: 38 },
  { name: "Sofia Reyes", role: "Packer", packed: 388, accuracy: 98.6, hours: 36 },
  { name: "Priya Shah", role: "Supervisor", packed: 142, accuracy: 99.5, hours: 40 },
  { name: "Daniel Kim", role: "Return Staff", packed: 0, accuracy: 97.8, hours: 35 },
];

export const recentActivity = [
  { id: "a1", user: "Marcus Lee", action: "packed order FO-10293", time: "2m ago" },
  { id: "a2", user: "Daniel Kim", action: "inspected RMA-44120", time: "8m ago" },
  { id: "a3", user: "Sofia Reyes", action: "scanned QR-FO10294-A", time: "11m ago" },
  { id: "a4", user: "Priya Shah", action: "invited emma@flowops.io", time: "1h ago" },
  { id: "a5", user: "Alex Morgan", action: "exported weekly report", time: "3h ago" },
];
