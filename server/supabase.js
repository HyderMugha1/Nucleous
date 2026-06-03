import { getSupabaseAdminClient, getSupabaseClient } from "./db.js";

export const supabase = getSupabaseClient();
export const supabaseAdmin = getSupabaseAdminClient();
