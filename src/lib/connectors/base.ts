import type {
  MarketplaceConnector,
  ConnectorMeta,
  ConnectionContext,
  AuthenticateResult,
  SyncResult,
} from "./types";

/**
 * Base adapter — provides safe "not yet implemented" defaults so a new
 * marketplace can be registered with only its `meta`. Real adapters
 * override the relevant methods. This is architecture only — no real
 * marketplace APIs are called here.
 */
export abstract class BaseMarketplaceConnector implements MarketplaceConnector {
  abstract meta: ConnectorMeta;

  async connect(_ctx: ConnectionContext): Promise<AuthenticateResult> {
    return {
      ok: false,
      status: "auth_required",
      error: { type: "connection_failed", message: `${this.meta.name} connector is not yet implemented.` },
    };
  }
  async disconnect(_ctx: ConnectionContext): Promise<{ ok: boolean }> {
    return { ok: true };
  }
  async authenticate(_ctx: ConnectionContext): Promise<AuthenticateResult> {
    return {
      ok: false,
      status: "auth_required",
      error: { type: "auth_failed", message: `${this.meta.name} authentication is not yet implemented.` },
    };
  }
  async sync(_ctx: ConnectionContext): Promise<SyncResult> {
    return {
      status: "failed",
      ordersImported: 0,
      ordersUpdated: 0,
      ordersFailed: 0,
      trackingUpdated: 0,
      errorMessage: `${this.meta.name} sync is not yet implemented.`,
    };
  }
}
