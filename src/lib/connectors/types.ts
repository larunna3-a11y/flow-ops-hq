// Generic connector interface — every marketplace adapter implements this.
// No marketplace-specific logic lives outside its own adapter module.

export type ConnectorCapability =
  | "import_orders"
  | "update_status"
  | "tracking"
  | "customer"
  | "sku"
  | "quantity";

export type ConnectionStatus =
  | "connected"
  | "disconnected"
  | "error"
  | "auth_required"
  | "rate_limited";

export type SyncTrigger = "manual" | "auto" | "webhook";
export type SyncStatus = "running" | "success" | "partial" | "failed";

export type ConnectorErrorType =
  | "connection_failed"
  | "auth_failed"
  | "token_expired"
  | "rate_limited"
  | "import_failed"
  | "other";

export interface ConnectorMeta {
  key: string;                  // 'shopee', 'tiktok_shop', ...
  name: string;
  category: "marketplace" | "courier" | "other";
  authMethod: "oauth2" | "api_key" | "custom";
  capabilities: ConnectorCapability[];
  status: "available" | "beta" | "coming_soon" | "disabled";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonObject = Record<string, any>;

export interface ConnectionContext {
  connectionId: string;
  workspaceId: string;
  connectorKey: string;
  credentials: JsonObject;
  oauthTokens: JsonObject;
}



export interface AuthenticateResult {
  ok: boolean;
  tokens?: JsonObject;
  status: ConnectionStatus;
  error?: { type: ConnectorErrorType; message: string };
}

export interface SyncResult {
  status: SyncStatus;
  ordersImported: number;
  ordersUpdated: number;
  ordersFailed: number;
  trackingUpdated: number;
  errorMessage?: string;
  metadata?: JsonObject;
}


/**
 * Generic marketplace connector contract.
 * New marketplaces are added by implementing this interface and
 * registering the module — no changes to the rest of the app are required.
 */
export interface MarketplaceConnector {
  meta: ConnectorMeta;
  connect(ctx: ConnectionContext): Promise<AuthenticateResult>;
  disconnect(ctx: ConnectionContext): Promise<{ ok: boolean }>;
  authenticate(ctx: ConnectionContext): Promise<AuthenticateResult>;
  sync(ctx: ConnectionContext, opts?: { since?: string }): Promise<SyncResult>;
}
