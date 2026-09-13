import { env } from '@/config/env';
import type { Services } from './contracts';
import { mockServices } from './mock/services';

/**
 * Ponto único de acesso aos dados. Para conectar o backend real, implemente
 * `httpServices` (ou `supabaseServices`) seguindo ./contracts e selecione aqui.
 */
function resolveServices(): Services {
  switch (env.dataSource) {
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
