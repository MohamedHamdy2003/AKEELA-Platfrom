import { navigation } from './lib/navigation';
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
  PageTitle,
  Shell,
} from '@akeela/portal/ui';
import { useSessionRestore } from '@akeela/portal/use-session-restore';
import { api, base } from './lib/api';
import { Home } from './features/home';
import { Restaurants } from './features/restaurants';
import { Users, Companies } from './features/users';
import { AdminActions } from './features/orders';
import { ArabicFields } from './components/arabic-fields';
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
    <ErrorBoundary theme="admin">
      <AdminWorkspace />
    </ErrorBoundary>
  );
}
function AdminWorkspace() {
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
        data-portal="admin"
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
      <AuthPage api={api} title="إدارة المنصة" theme="admin" login={setUser} />
    );
  return (
    <ArabicFields>
      <Shell
        user={user}
        appName="إدارة المنصة"
        theme="admin"
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
        {route === 'restaurants' && <Restaurants />}
        {route === 'users' && (
          <>
            <PageTitle
              title="المستخدمون"
              description="الحسابات والأدوار وحالة النشاط."
            />
            <Users />
          </>
        )}
        {route === 'companies' && <Companies />}
        {route === 'orders' && (
          <OrdersBoard
            api={api}
            prefix="/admin"
            revision={revision}
            dateFields={(value, change) => (
              <ArabicDateFields value={value} change={change} />
            )}
            actions={(order, refresh) => (
              <AdminActions order={order} refresh={refresh} />
            )}
          />
        )}
        {route === 'account' && (
          <AccountScreen api={api} user={user} updated={setUser} />
        )}
      </Shell>
    </ArabicFields>
  );
}
