import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { Envelope } from './models';

export function useResource<T>(path: string | null) {
  const [state, setState] = useState<{
    path: string | null;
    result: Envelope<T> | null;
    error: unknown;
    loading: boolean;
  }>(() => ({
    path,
    result: null,
    error: null,
    loading: Boolean(path),
  }));
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    if (
      !path?.startsWith('/restaurant/orders') &&
      !path?.startsWith('/restaurant/analytics')
    )
      return;
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      timer = setTimeout(
        reload,
        path.startsWith('/restaurant/analytics') ? 1500 : 120,
      );
    };
    window.addEventListener('akeela:orders-changed', update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('akeela:orders-changed', update);
    };
  }, [path, reload]);
  useEffect(() => {
    if (!path) {
      setState({ path: null, result: null, error: null, loading: false });
      return;
    }
    const controller = new AbortController();
    setState((current) => ({
      path,
      result: current.path === path ? current.result : null,
      error: null,
      loading: true,
    }));
    api
      .request<T>(path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ path, result: data, error: null, loading: false });
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setState((current) => ({
            path,
            result: current.path === path ? current.result : null,
            error: cause,
            loading: false,
          }));
        }
      });
    return () => controller.abort();
  }, [path, revision]);
  const matches = state.path === path;
  return {
    result: matches ? state.result : null,
    error: matches ? state.error : null,
    loading: matches ? state.loading : Boolean(path),
    reload,
  };
}
