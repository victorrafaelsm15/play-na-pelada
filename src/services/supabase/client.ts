import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/config/env';

/**
 * Cliente único do Supabase (auth + Postgres via RPC/PostgREST + Storage).
 * Criado sob demanda: importar este módulo não deve falhar quando o app roda
 * em modo mock e as variáveis VITE_SUPABASE_* não estão configuradas.
 */
let instance: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!instance) {
    instance = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
  }
  return instance;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getClient() as unknown as Record<string | symbol, unknown>;
    const value = client[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  }
});
