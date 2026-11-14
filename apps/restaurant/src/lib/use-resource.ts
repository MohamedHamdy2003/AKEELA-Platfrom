import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { Envelope } from './models';

export function useResource<T>(path: string | null) {
  const [result, setResult] = useState<Envelope<T> | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
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
