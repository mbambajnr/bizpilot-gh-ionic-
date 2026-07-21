import { createClient } from '@supabase/supabase-js';

import { publicEnv } from './publicEnv';

const supabaseUrl = publicEnv.supabaseUrl;
const supabasePublishableKey = publicEnv.supabasePublishableKey;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabasePublishableKey);

function getSupabaseProjectRef() {
  if (!supabaseUrl) {
    return null;
  }

  try {
    return new URL(supabaseUrl).hostname.split('.')[0] ?? null;
  } catch {
    return null;
  }
}

export function getSupabaseAuthStorageKeys() {
  const projectRef = getSupabaseProjectRef();
  if (!projectRef) {
    return [];
  }

  return [
    `sb-${projectRef}-auth-token`,
    `sb-${projectRef}-auth-token-code-verifier`,
  ];
}

export const supabase = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null;

export function getSupabaseClient() {
  if (!supabase) {
    throw new Error('Missing Supabase environment variables for the current web runtime.');
  }

  return supabase;
}
