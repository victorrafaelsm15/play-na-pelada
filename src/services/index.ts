import { env } from '@/config/env';
import type { Services } from './contracts';
import { mockServices } from './mock/services';
import { supabaseServices } from './supabase/services';

/**
 * Ponto único de acesso aos dados. Para conectar o backend real, implemente
 * `httpServices` seguindo ./contracts e selecione aqui.
 */
function resolveServices(): Services {
  switch (env.dataSource) {
    case 'supabase':
      if (!env.supabaseUrl || !env.supabaseAnonKey) {
        console.warn('[racha] VITE_DATA_SOURCE=supabase mas VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY não configuradas — usando dados de demonstração.');
        return mockServices;
      }
      return supabaseServices;
    case 'api':
      console.warn('[racha] VITE_DATA_SOURCE=api ainda sem implementação — usando dados de demonstração.');
      return mockServices;
    default:
      return mockServices;
  }
}

export const services = resolveServices();
export * from './contracts';
export { AppError, errorMessage } from './errors';
