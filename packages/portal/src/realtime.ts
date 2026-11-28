import { io } from 'socket.io-client';
export type RealtimeStatus = 'connecting' | 'connected' | 'offline';
export function watchOrders(options: {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  changed: () => void;
  status?: (state: RealtimeStatus) => void;
}) {
  const origin = new URL(
    options.baseUrl,
    globalThis.location?.href ?? 'http://localhost',
  ).origin;
  let stopped = false;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;
  let hasConnectedOnce = false;
  const socket = io(origin + '/orders', {
    transports: ['websocket'],
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 15000,
    auth: (done) => {
      void options
        .getToken()
        .then((token) => {
          if (!stopped) done({ token: token ?? '' });
        })
        .catch(() => {
          if (!stopped) done({ token: '' });
        });
    },
  });

  const scheduleReconnect = (delayMs: number, sync = true) => {
    if (stopped) return;
    if (retry) clearTimeout(retry);
    retry = setTimeout(() => {
      retry = undefined;
      if (stopped || socket.connected) return;
      if (sync) options.changed();
      options.status?.('connecting');
      socket.connect();
    }, delayMs);
  };

  socket.on('connect', () => {
    if (retry) {
      clearTimeout(retry);
      retry = undefined;
    }
    failures = 0;
    options.status?.('connected');
    // Skip redundant refetch on the very first connect since views just mounted;
    // always resynchronize after any reconnect to recover missed events.
    if (hasConnectedOnce) {
      options.changed();
    }
    hasConnectedOnce = true;
  });

  for (const event of ['order.created', 'order.updated']) {
    socket.on(event, () => options.changed());
  }

  socket.on('disconnect', (reason) => {
    if (stopped) return;
    options.status?.('offline');
    if (reason === 'io server disconnect') {
      failures = Math.min(failures + 1, 6);
      const backoff = Math.min(30_000, 1500 * 2 ** (failures - 1));
      // Resynchronize REST once on actual reconnect (connect handler), not on every failed retry.
      scheduleReconnect(backoff, false);
    }
  });

  socket.on('connect_error', (err) => {
    if (stopped) return;
    options.status?.('offline');
    if (!socket.active) {
      if (
        err?.message === 'ORIGIN_NOT_ALLOWED' ||
        err?.message === 'CONNECTION_LIMIT'
      ) {
        return;
      }
      failures = Math.min(failures + 1, 6);
      const backoff = Math.min(30_000, 2000 * 2 ** (failures - 1));
      scheduleReconnect(backoff, false);
    }
  });

  const onNetworkReturn = () => {
    if (stopped || socket.connected) return;
    if (
      typeof document !== 'undefined' &&
      document.visibilityState === 'hidden'
    ) {
      return;
    }
    failures = 0;
    scheduleReconnect(300, hasConnectedOnce);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', onNetworkReturn);
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onNetworkReturn);
  }

  options.status?.('connecting');
  socket.connect();

  return () => {
    stopped = true;
    if (retry) clearTimeout(retry);
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', onNetworkReturn);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onNetworkReturn);
    }
    socket.removeAllListeners();
    socket.disconnect();
  };
}
