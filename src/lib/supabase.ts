import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// A URL e a chave "publishable" são públicas por desenho (ficam no app). Quem protege os dados
// são as regras de segurança do banco (supabase/schema.sql). Nunca coloque aqui a chave secret.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://eavbftumowfcmartijeq.supabase.co";
export const SUPABASE_CHAVE =
  process.env.NEXT_PUBLIC_SUPABASE_KEY ?? "sb_publishable_GmBRiYEtCeNuafzEm63b5A_NmPRUgTj";

let cliente: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!cliente) {
    cliente = createClient(SUPABASE_URL, SUPABASE_CHAVE, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "cownter-auth", detectSessionInUrl: false },
    });
  }
  return cliente;
}
