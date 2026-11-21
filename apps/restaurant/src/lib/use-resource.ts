import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import type { Envelope } from './models';

export function useResource<T>(path: string | null) {
  const [result, setResult] = useState<Envelope<T> | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((n) => n + 1), []);
  const previousPath = useRef<string | null>(null);
  useEffect(() => {
    if (
      !path?.startsWith('/restaurant/orders') &&
      !path?.startsWith('/restaurant/analytics')
    )
      return;
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      timer = setTimeout(reload, 100);
    };
    window.addEventListener('akeela:orders-changed', update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('akeela:orders-changed', update);
    };
  }, [path, reload]);
  useEffect(() => {
    const controller = new AbortController();
    if (previousPath.current !== path) setResult(null);
    previousPath.current = path;
    setError(null);
    setLoading(!!path);
    if (path)
      api
        .request<T>(path, { signal: controller.signal })
        .then((data) => {
          if (!controller.signal.aborted) setResult(data);
        })
        .catch((cause) => {
          if (!controller.signal.aborted) setError(cause);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    return () => controller.abort();
  }, [path, revision]);
  return { result, error, loading, reload };
}
