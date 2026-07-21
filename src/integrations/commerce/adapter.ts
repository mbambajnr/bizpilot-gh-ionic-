import type { CommerceCapabilities, CommerceProviderId } from './types';
import type { CommerceCatalog, CommerceOrder, CommerceOrderInput } from './domain';

// A commerce adapter is one platform's implementation of the neutral contract:
// load a catalog, place an order. Everything platform-specific — REST paths,
// payload shapes, credentials handling — lives behind this and is mapped to the
// neutral domain model before it reaches the rest of the app.
export interface CommerceAdapter {
  readonly id: CommerceProviderId;
  readonly label: string;
  readonly capabilities: CommerceCapabilities;
  loadCatalog(): Promise<CommerceCatalog>;
  placeOrder(input: CommerceOrderInput): Promise<CommerceOrder>;
}

// Per-tenant configuration. In the SaaS model this is resolved per business
// from Supabase (provider choice + status + non-secret settings); secret
// credentials are injected server-side and never travel in this object.
export type CommerceProviderConfig = {
  provider: CommerceProviderId;
  label?: string;
  /** Provider-specific, non-secret settings (e.g. the custom adapter's field map). */
  settings?: Record<string, unknown>;
};

// Minimal HTTP transport so adapters that talk to the BizPilot server proxy can
// be unit-tested with an injected fake instead of real network calls.
export interface CommerceTransport {
  get(path: string): Promise<unknown>;
  post(path: string, body: unknown): Promise<unknown>;
}
