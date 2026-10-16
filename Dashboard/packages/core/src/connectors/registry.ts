/**
 * Connector-registret. För att lägga till en ny källa: skapa en fil som
 * exporterar ett objekt som implementerar `Connector` och lägg till den i
 * listan nedan. Inget annat i systemet behöver ändras.
 */
import type { Connector, PlatformId } from "../types";
import { ga4Connector } from "./ga4";
import { googleAdsConnector } from "./google-ads";
import { linkedinConnector } from "./linkedin";
import { metaConnector } from "./meta";
import { tiktokConnector } from "./tiktok";
import { mockConnectors } from "./mock";

const connectors: Connector[] = [
  ga4Connector,
  googleAdsConnector,
  metaConnector,
  linkedinConnector,
  tiktokConnector,
  ...mockConnectors,
];

const byId = new Map(connectors.map((c) => [c.id, c]));

export function getConnector(id: string): Connector {
  const c = byId.get(id);
  if (!c) throw new Error(`Okänd connector: ${id}`);
  return c;
}

export const listConnectors = () => connectors;

export const connectorsForPlatform = (platform: PlatformId) => connectors.filter((c) => c.platform === platform);
