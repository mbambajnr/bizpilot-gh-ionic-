type ViteImportMeta = ImportMeta & {
  env?: Record<string, string | undefined>;
};

type BizPilotRuntimeEnv = {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  apiBaseUrl?: string;
};

declare global {
  var __BIZPILOT_PUBLIC_ENV__: BizPilotRuntimeEnv | undefined;
}

const viteEnv = (import.meta as ViteImportMeta).env;
const runtimeEnv = globalThis.__BIZPILOT_PUBLIC_ENV__;

export const publicEnv = {
  supabaseUrl: runtimeEnv?.supabaseUrl || viteEnv?.VITE_SUPABASE_URL,
  supabasePublishableKey:
    runtimeEnv?.supabasePublishableKey || viteEnv?.VITE_SUPABASE_PUBLISHABLE_KEY,
  viteApiBaseUrl: viteEnv?.VITE_API_BASE_URL,
  nextApiBaseUrl: runtimeEnv?.apiBaseUrl,
};
