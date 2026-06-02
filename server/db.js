import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

let adminClient = null;
let browserCompatibleClient = null;

export function getSupabaseAdminClient() {
  if (!config.supabaseServiceRoleKey) {
    return null;
  }

  if (!adminClient) {
    adminClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return adminClient;
}

export function getSupabaseClient() {
  if (!browserCompatibleClient) {
    browserCompatibleClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return browserCompatibleClient;
}

export async function connectDatabase() {
  const client = getSupabaseAdminClient() || getSupabaseClient();
  return client;
}
