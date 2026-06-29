import type { AppRole } from "@/lib/use-workspace";

// Module keys map 1:1 to top-level app routes under /_app.
export type ModuleKey =
  | "dashboard"
  | "orders"
  | "packing"
  | "scanning"
  | "returns"
  | "reports"
  | "imports"
  | "stores"
  | "marketplace"
  | "users"
  | "settings"
  | "detection-rules"
  | "integrations"
  | "operations"
  | "automation"
  | "system";

const ALL: ModuleKey[] = [
  "dashboard", "orders", "packing", "scanning", "returns",
  "reports", "imports", "stores", "marketplace", "users", "settings", "detection-rules",
  "integrations", "operations", "automation", "system",
];

const ROLE_MODULES: Record<AppRole, ModuleKey[]> = {
  Owner: ALL,
  // Supervisor: Dashboard, Packing, Returns, Reports only.
  Supervisor: ["dashboard", "packing", "returns", "reports"],
  // Packer: Packing only.
  Packer: ["packing"],
  // Return Staff: Returns only.
  "Return Staff": ["returns"],
};

// Landing route per role after sign-in / when blocked from a module.
export const HOME_PATH: Record<AppRole, string> = {
  Owner: "/dashboard",
  Supervisor: "/dashboard",
  Packer: "/packing",
  "Return Staff": "/returns",
};

export function canAccess(role: AppRole | null | undefined, module: ModuleKey): boolean {
  if (!role) return false;
  return ROLE_MODULES[role].includes(module);
}

export function allowedModules(role: AppRole | null | undefined): ModuleKey[] {
  if (!role) return [];
  return ROLE_MODULES[role];
}

// Map a pathname to a module key (or null when public/unknown).
export function moduleForPath(pathname: string): ModuleKey | null {
  const seg = pathname.split("/").filter(Boolean)[0];
  if (!seg) return null;
  if ((ALL as string[]).includes(seg)) return seg as ModuleKey;
  return null;
}
