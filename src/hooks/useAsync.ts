import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/services';

export interface AsyncState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload(): void;
  setData(updater: T | ((prev: T | undefined) => T)): void;
}

/** Carregamento assíncrono com estados de loading/erro e recarga. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fnRef.current()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading, reload, setData: setData as AsyncState<T>['setData'] };
}
