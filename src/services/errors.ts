export type AppErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'EVENT_FULL'
  | 'NETWORK'
  | 'UNKNOWN';

export class AppError extends Error {
  constructor(public code: AppErrorCode, message: string, public field?: string) {
    super(message);
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof AppError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Algo deu errado. Tente novamente.';
}
