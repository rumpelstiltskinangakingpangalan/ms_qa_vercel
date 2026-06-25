import { createClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client.
 *
 * The project URL and anon key are public values (the anon key is safe to ship
 * to the browser — row-level security governs what it can read/write). They are
 * read from `NEXT_PUBLIC_*` env vars when present, with the original project's
 * values kept as a fallback so the app runs out of the box. To point at a
 * different project, set the env vars in `.env.local` (see `.env.example`).
 */
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://cqnqfvusotfvynhabueh.supabase.co";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbnFmdnVzb3RmdnluaGFidWVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NTI4NTYsImV4cCI6MjA5NzQyODg1Nn0.ZjKFSD7BEdrDK3yXvhB3-KsvEwd5phV1XZY0M_1bKik";

export const msSupabase = createClient(supabaseUrl, supabaseAnonKey);
