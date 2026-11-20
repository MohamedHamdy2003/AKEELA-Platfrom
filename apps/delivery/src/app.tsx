import { useEffect, useState } from 'react';
import type { User } from '@akeela/portal/models';
import { watchOrders, type RealtimeStatus } from '@akeela/portal/realtime';
import { AccountScreen, OrdersBoard } from '@akeela/portal/screens';
import { ArabicDateFields } from '@akeela/portal/arabic-date-fields';
import {
  AuthPage,
  ErrorBoundary,
  Failure,
  Loading,
  Shell,
} from '@akeela/portal/ui';
import { useSessionRestore } from '@akeela/portal/use-session-restore';
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
const currentRoute = () => {
  if (typeof window === 'undefined') return 'home';
  if (window.location.hash.startsWith('#/')) {
    const hashKey = window.location.hash.slice(2);
    if (hashKey) {
      window.history.replaceState(null, '', '/' + hashKey);
      return navigation.some(([key]) => key === hashKey) ? hashKey : 'home';
    }
  }
  const segment = window.location.pathname
    .replace(/^\/+|\/+$/g, '')
    .split('/')[0];
  return navigation.some(([key]) => key === segment) ? segment : 'home';
};
export function App() {
  return (
    <ErrorBoundary theme="delivery">
      <DeliveryWorkspace />
    </ErrorBoundary>
  );
}
function DeliveryWorkspace() {
  const [user, setUser] = useState<User | null>(null),
    [route, setRoute] = useState(currentRoute),
    [revision, setRevision] = useState(0),
    [status, setStatus] = useState<RealtimeStatus>('connecting');
  const { restoring, restoreError, retryRestore } = useSessionRestore(
    api,
    setUser,
  );
  useEffect(() => {
    const change = () => setRoute(currentRoute());
    window.addEventListener('popstate', change);
    window.addEventListener('hashchange', change);
    api.onSessionEnd = () => setUser(null);
    return () => {
      window.removeEventListener('popstate', change);
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
    const target = '/' + key;
    if (window.location.pathname !== target) {
      window.history.pushState(null, '', target);
    }
    setRoute(key);
  };
  if (restoring || restoreError)
    return (
      <main
        className="portal session-recovery"
        data-portal="delivery"
        aria-label="استعادة الجلسة"
      >
        <section className="session-recovery-panel">
          <h1>{restoring ? 'جارٍ استعادة الجلسة' : 'تعذّر استعادة الجلسة'}</h1>
          {restoring ? (
            <Loading />
          ) : (
            <Failure error={restoreError} retry={retryRestore} />
          )}
        </section>
      </main>
    );
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
        await api.request('/auth/logout', { method: 'POST' });
        api.clearSession();
        window.history.replaceState(null, '', '/');
        setRoute('home');
      }}
    >
      {route === 'home' && <Home revision={revision} navigate={navigate} />}
      {route === 'orders' && (
        <OrdersBoard
          api={api}
          prefix="/delivery-company"
          revision={revision}
          delivery
          dateFields={(value, change) => (
            <ArabicDateFields value={value} change={change} />
          )}
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
