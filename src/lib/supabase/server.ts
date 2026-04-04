import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedPublicClient: SupabaseClient | null | undefined;
let cachedAdminClient: SupabaseClient | null | undefined;

export function createSupabaseServerClient() {
  if (cachedPublicClient !== undefined) {
    return cachedPublicClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    cachedPublicClient = null;
    return cachedPublicClient;
  }

  cachedPublicClient = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedPublicClient;
}

export function createSupabaseAdminClient() {
  if (cachedAdminClient !== undefined) {
    return cachedAdminClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    cachedAdminClient = null;
    return cachedAdminClient;
  }

  cachedAdminClient = createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedAdminClient;
}
