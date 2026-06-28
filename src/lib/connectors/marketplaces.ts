import { BaseMarketplaceConnector } from "./base";
import type { ConnectorMeta, MarketplaceConnector } from "./types";

const DEFAULT_CAPS: ConnectorMeta["capabilities"] = [
  "import_orders",
  "update_status",
  "tracking",
  "customer",
  "sku",
  "quantity",
];

class ShopeeConnector extends BaseMarketplaceConnector {
  meta: ConnectorMeta = { key: "shopee", name: "Shopee", category: "marketplace", authMethod: "oauth2", capabilities: DEFAULT_CAPS, status: "coming_soon" };
}
class TikTokShopConnector extends BaseMarketplaceConnector {
  meta: ConnectorMeta = { key: "tiktok_shop", name: "TikTok Shop", category: "marketplace", authMethod: "oauth2", capabilities: DEFAULT_CAPS, status: "coming_soon" };
}
class TokopediaConnector extends BaseMarketplaceConnector {
  meta: ConnectorMeta = { key: "tokopedia", name: "Tokopedia", category: "marketplace", authMethod: "oauth2", capabilities: DEFAULT_CAPS, status: "coming_soon" };
}
class LazadaConnector extends BaseMarketplaceConnector {
  meta: ConnectorMeta = { key: "lazada", name: "Lazada", category: "marketplace", authMethod: "oauth2", capabilities: DEFAULT_CAPS, status: "coming_soon" };
}
class BlibliConnector extends BaseMarketplaceConnector {
  meta: ConnectorMeta = { key: "blibli", name: "Blibli", category: "marketplace", authMethod: "oauth2", capabilities: DEFAULT_CAPS, status: "coming_soon" };
}

/**
 * Connector registry. Adding a new marketplace = implement the interface
 * (extend BaseMarketplaceConnector) and register it here. No other module
 * needs to change.
 */
export const CONNECTOR_REGISTRY: Record<string, MarketplaceConnector> = {
  shopee: new ShopeeConnector(),
  tiktok_shop: new TikTokShopConnector(),
  tokopedia: new TokopediaConnector(),
  lazada: new LazadaConnector(),
  blibli: new BlibliConnector(),
};

export function getConnector(key: string): MarketplaceConnector | undefined {
  return CONNECTOR_REGISTRY[key];
}

export function listConnectors(): MarketplaceConnector[] {
  return Object.values(CONNECTOR_REGISTRY);
}
