import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://csuzochqnfkbmtgglvje.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzdXpvY2hxbmZrYm10Z2dsdmplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjAwNTMsImV4cCI6MjA5MzAzNjA1M30.EOmBXe5oOQ98jOHSbM95PsxZTdQ0JKvAbDgtHuFFVfk";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

function validateSupabaseClientConfig() {
  if (!supabaseUrl) {
    throw new Error("Missing `VITE_SUPABASE_URL` in the frontend environment.");
  }

  if (!supabaseAnonKey) {
    throw new Error("Missing `VITE_SUPABASE_ANON_KEY` in the frontend environment.");
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    throw new Error("`VITE_SUPABASE_URL` must be a valid URL.");
  }

  if (!/^https?:$/.test(parsedUrl.protocol)) {
    throw new Error("`VITE_SUPABASE_URL` must start with `http://` or `https://`.");
  }

  if (parsedUrl.hostname === "your-project-ref.supabase.co") {
    throw new Error("`VITE_SUPABASE_URL` is still using the example Supabase host. Replace it with your real project URL.");
  }
}

function createConfigError(error) {
  const message = error instanceof Error ? error.message : "Supabase configuration is invalid.";
  return `${message} Add the required Vercel environment variables and redeploy.`;
}

function createUnavailableSupabaseClient(message) {
  const unavailable = async () => ({
    data: { session: null, user: null },
    error: new Error(message),
  });

  return {
    auth: {
      getSession: unavailable,
      signInWithPassword: unavailable,
      signInWithOAuth: unavailable,
      resetPasswordForEmail: unavailable,
      updateUser: unavailable,
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe() {},
          },
        },
      }),
    },
  };
}

let supabaseConfigError = null;

try {
  validateSupabaseClientConfig();
} catch (error) {
  supabaseConfigError = createConfigError(error);
}

export { supabaseConfigError };

export const supabase = supabaseConfigError
  ? createUnavailableSupabaseClient(supabaseConfigError)
  : createClient(supabaseUrl, supabaseAnonKey);
