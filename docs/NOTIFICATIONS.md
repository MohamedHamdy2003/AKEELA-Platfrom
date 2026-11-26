# Push Notifications (FCM HTTP v1)

AKEELA delivers mobile and web push notifications directly through **Firebase Cloud Messaging (FCM) HTTP v1** using Google Service Account OAuth2 credentials — with zero third-party Firebase SDK dependencies.

## Environment configuration

Leave all three variables empty to run in no-op mode (local dev, CI, or before Firebase is configured). Set all three together to enable live FCM delivery:

| Variable           | Description                                                                |
| ------------------ | -------------------------------------------------------------------------- |
| `FCM_PROJECT_ID`   | Firebase project ID (from Service Account JSON `project_id`)               |
| `FCM_CLIENT_EMAIL` | Service account email (`client_email`)                                     |
| `FCM_PRIVATE_KEY`  | PEM private key (`private_key`); `\n` escapes are normalized automatically |

Generate these values in **Firebase Console → Project Settings → Service Accounts → Generate new private key**. Store them only in private `.env` / `/opt/akeela/.env.production` (mode `600`); never commit them.

## Client integration (Flutter / React Native / Android / iOS)

1. After login (and whenever `onTokenRefresh` fires), call:
   - `PUT /api/v1/me/device-tokens` with `{ "fcm_token": "...", "platform": "android" | "ios" | "web", "device_label": "..." }`.
2. Re-registering the same `fcm_token` from another account automatically reassigns the token to the new signed-in user and session.
3. On logout, either call `DELETE /api/v1/me/device-tokens/{token_id}` or simply `POST /api/v1/auth/logout` — revoked/expired sessions are automatically excluded from push delivery and cleaned up.
4. Handle deep-link navigation using the string `data` payload sent with every order push:
   - `type`: `order.created` | `order.updated`
   - `order_id`, `status`, `rest_id`, `company_id`, `driver_id`
5. On Android, create notification channel `akeela_orders` with high importance for sound/heads-up alerts.

## Automatic order lifecycle triggers

| Trigger                                   | Recipients                                   |
| ----------------------------------------- | -------------------------------------------- |
| Checkout (`Pending`)                      | Restaurant owner, Admin                      |
| Restaurant accepts (`Accepted`)           | Customer, assigned Delivery_Company          |
| Driver assigned / picked up (`Picked_Up`) | Customer                                     |
| Delivered / auto-delivered (`Delivered`)  | Customer, Restaurant owner                   |
| Restaurant rejects (`Rejected`)           | Customer                                     |
| Customer cancels (`Cancelled`)            | Restaurant owner                             |
| Admin marks failed (`Failed`)             | Customer, Restaurant owner, Delivery_Company |

Permanently invalid tokens (`UNREGISTERED`, `SENDER_ID_MISMATCH`) are automatically pruned from `device_tokens`. Push delivery is best-effort after transaction commit and never rolls back an order action.
