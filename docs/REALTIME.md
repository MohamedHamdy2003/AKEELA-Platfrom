# Realtime Orders

Socket.IO is part of the existing NestJS process. No new service, database table or mobile push-notification provider is needed. Use REST as the source of truth.

## Connection

- Install a Socket.IO v4 client. A raw WebSocket client is not compatible.
- Connect to namespace `/orders` on the API origin; Engine.IO path is `/socket.io`. The REST prefix `/api/v1` is not part of the socket URL.
- Use WebSocket transport and `auth: {token: access_token}`. Never put tokens in query strings or logs.
- Browser Origin must be in `CORS_ORIGINS`. Native mobile clients may omit Origin; JWT/session checks still apply.
- The server checks the live session, active verified account and role profile. Restaurant activation must be Active; pausing new orders does not prevent existing-order updates. Companies must be active.
- The server selects recipients. Clients cannot join arbitrary rooms, subscribe to another account, or mutate orders through sockets.

```ts
import { io } from 'socket.io-client';

const socket = io('https://api.akeelaonline.tech/orders', {
  transports: ['websocket'],
  autoConnect: false,
  auth: (callback) => {
    // Obtain/refresh the JWT with the existing REST session manager.
    getValidAccessToken().then((token) => callback({ token }));
  },
});
socket.on('connect', refreshOrderListsAndOpenOrder);
socket.on('order.created', refreshOrderListsAndOpenOrder);
socket.on('order.updated', refreshOrderListsAndOpenOrder);
socket.connect();
// Remove listeners and disconnect when the user logs out.
```

## Events

Both events use the same small payload:

```json
{
  "order_id": "42",
  "status": "Accepted",
  "company_id": "1",
  "driver_id": null,
  "updated_at": "2026-11-18T14:30:00+02:00"
}
```

| Event           | Trigger after a successful commit         | Recipients                                           |
| --------------- | ----------------------------------------- | ---------------------------------------------------- |
| `order.created` | Customer checkout                         | Owning customer, restaurant, Admin                   |
| `order.updated` | Status change or driver assignment/change | Owning customer, restaurant, assigned company, Admin |

IDs are strings, company/driver can be null, status uses the existing order enum, and time includes Egypt's current offset. No customer address, email, token, item list or other private snapshot is broadcast.

## Recovery and limits

- Re-fetch the permitted REST list/open order on every connection/reconnection and event. Events are invalidation hints, not patches; they can be missed or arrive in a different order.
- JWT expiry disconnects the socket. Refresh through REST and explicitly reconnect after a server disconnect. Stop retrying when the session ends. Other disconnects use bounded backoff; manual REST refresh stays available.
- Active session/role scope is rechecked every 30 seconds and immediately before each notification. Revoked/suspended accounts do not receive new payloads. Maximum 10 current connections per account; maximum incoming packet 1KB.
- Events are best effort and not persisted/replayed. REST success is not rolled back if notification delivery fails. No outbox, Redis adapter, offline notification delivery or horizontal API scaling is implemented. Run one API instance.
- Admin/Delivery share the small client helper in `packages/portal`; Restaurant uses its realtime export only. Forms keep their drafts while order lists refresh. Mobile implementation is owned by the mobile client.

See [Socket.IO delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/), [middleware](https://socket.io/docs/v4/middlewares/) and [NestJS gateways](https://docs.nestjs.com/websockets/gateways).
