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
  socket.on('connect', () => {
    failures = 0;
    options.status?.('connected');
    options.changed();
  });
  for (const event of ['order.created', 'order.updated'])
    socket.on(event, () => options.changed());
  socket.on('disconnect', (reason) => {
    if (stopped) return;
    options.status?.('offline');
    if (reason === 'io server disconnect')
      retry = setTimeout(() => {
        if (!stopped) {
          options.changed();
          socket.connect();
        }
      }, 1000);
  });
  socket.on('connect_error', () => {
    options.status?.('offline');
    if (!socket.active && ++failures <= 3)
      retry = setTimeout(
        () => {
          if (!stopped) {
            options.changed();
            socket.connect();
          }
        },
        Math.min(15000, failures * 3000),
      );
  });
  options.status?.('connecting');
  socket.connect();
  return () => {
    stopped = true;
    if (retry) clearTimeout(retry);
    socket.removeAllListeners();
    socket.disconnect();
  };
}
