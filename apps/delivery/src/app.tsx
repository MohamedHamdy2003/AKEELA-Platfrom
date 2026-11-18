import { useEffect, useState } from 'react';
import type { User } from '@akeela/portal/models';
import { watchOrders, type RealtimeStatus } from '@akeela/portal/realtime';
import { AccountScreen, OrdersBoard } from '@akeela/portal/screens';
import { AuthPage, Shell } from '@akeela/portal/ui';
import { api, base } from './lib/api';
import { Home } from './features/home';
import { Drivers } from './features/drivers';
import { CompanyProfile } from './features/profile';
import { DeliveryActions } from './features/orders';
const navigation: Array<[string, string]> = [
  ['home', 'نظرة عامة'],
  ['orders', 'طلبات الشركة'],
  ['drivers', 'السائقون'],
  ['profile', 'بيانات الشركة'],
  ['account', 'حسابي'],
];
const currentRoute = () =>
  navigation.some(([key]) => key === location.hash.slice(2))
    ? location.hash.slice(2)
    : 'home';
export function App() {
  const [user, setUser] = useState<User | null>(null),
    [route, setRoute] = useState(currentRoute),
    [revision, setRevision] = useState(0),
    [status, setStatus] = useState<RealtimeStatus>('connecting');
  useEffect(() => {
    const change = () => setRoute(currentRoute());
    window.addEventListener('hashchange', change);
    api.onSessionEnd = () => setUser(null);
    return () => {
      window.removeEventListener('hashchange', change);
      api.onSessionEnd = undefined;
    };
  }, []);
  useEffect(() => {
    if (!user) return;
    return watchOrders({
      baseUrl: base,
      getToken: () => api.tokenForRealtime(),
      changed: () => setRevision((n) => n + 1),
      status: setStatus,
    });
  }, [user?.user_id]);
  const navigate = (key: string) => {
    location.hash = '/' + key;
  };
  if (!user)
    return (
      <AuthPage
        api={api}
        title="إدارة التوصيل"
        theme="delivery"
        login={setUser}
      />
    );
  return (
    <Shell
      user={user}
      appName="إدارة التوصيل"
      theme="delivery"
      navigation={navigation}
      route={route}
      navigate={navigate}
      status={status}
      logout={async () => {
        try {
          await api.request('/auth/logout', { method: 'POST' });
        } finally {
          api.clearSession();
        }
      }}
    >
      {route === 'home' && <Home revision={revision} navigate={navigate} />}
      {route === 'orders' && (
        <OrdersBoard
          api={api}
          prefix="/delivery-company"
          revision={revision}
          delivery
          actions={(order, refresh) => (
            <DeliveryActions
              key={order.order_id + order.updated_at}
              order={order}
              refresh={refresh}
            />
          )}
        />
      )}
      {route === 'drivers' && <Drivers />}
      {route === 'profile' && <CompanyProfile />}
      {route === 'account' && (
        <AccountScreen api={api} user={user} updated={setUser} />
      )}
    </Shell>
  );
}
