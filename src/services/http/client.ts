import { env } from '@/config/env';
import { AppError, type AppErrorCode } from '../errors';

/**
 * Cliente HTTP para o backend real. Cada serviço "http" implementa os contratos
 * de ../contracts.ts usando esta função — a UI não muda ao trocar de fonte de dados.
 */
export async function http<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  if (!env.apiBaseUrl) throw new AppError('NETWORK', 'VITE_API_BASE_URL não configurada.');
  let res: Response;
  try {
    res = await fetch(`${env.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
        ...init.headers
      }
    });
  } catch {
    throw new AppError('NETWORK', 'Sem conexão com o servidor.');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { code?: AppErrorCode; message?: string; field?: string };
    throw new AppError(body.code ?? 'UNKNOWN', body.message ?? `Erro ${res.status}`, body.field);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}
