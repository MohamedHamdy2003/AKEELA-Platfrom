import { navigation } from './lib/navigation';
import { Suspense, lazy, useEffect, useState } from 'react';
import type { User } from '@akeela/portal/models';
import type { RealtimeStatus } from '@akeela/portal/realtime';
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
import { ArabicFields } from './components/arabic-fields';
import { AdminActions } from './features/orders';

const Home = lazy(() =>
  import('./features/home').then((m) => ({ default: m.Home })),
);
const Restaurants = lazy(() =>
  import('./features/restaurants').then((m) => ({ default: m.Restaurants })),
);
const Users = lazy(() =>
  import('./features/users').then((m) => ({ default: m.Users })),
);
const Companies = lazy(() =>
  import('./features/users').then((m) => ({ default: m.Companies })),
);
const OrdersBoard = lazy(() =>
  import('@akeela/portal/screens').then((m) => ({ default: m.OrdersBoard })),
);
const AccountScreen = lazy(() =>
  import('@akeela/portal/screens').then((m) => ({ default: m.AccountScreen })),
);
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
    [analyticsRevision, setAnalyticsRevision] = useState(0),
    [ordersStatus, setOrdersStatus] = useState(''),
    [restaurantsStatus, setRestaurantsStatus] = useState(''),
    [authNotice, setAuthNotice] = useState(''),
    [status, setStatus] = useState<RealtimeStatus>('connecting');
  const { restoring, restoreError, retryRestore } = useSessionRestore(
    api,
    setUser,
  );
  useEffect(() => {
    const label = navigation.find(([key]) => key === route)?.[1];
    document.title = user
      ? `AKEELA - إدارة المنصة${label ? ` - ${label}` : ''}`
      : 'AKEELA - إدارة المنصة';
  }, [user, route]);
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
    if (revision === 0) return;
    const timer = setTimeout(() => setAnalyticsRevision(revision), 2000);
    return () => clearTimeout(timer);
  }, [revision]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    let stop: (() => void) | undefined;
    void import('@akeela/portal/realtime').then(({ watchOrders }) => {
      if (!active) return;
      stop = watchOrders({
        baseUrl: base,
        getToken: () => api.tokenForRealtime(),
        changed: () => setRevision((n) => n + 1),
        status: setStatus,
      });
    });
    return () => {
      active = false;
      stop?.();
    };
  }, [user?.user_id]);
  const navigate = (key: string, filter?: string) => {
    if (key === 'orders') setOrdersStatus(filter ?? '');
    if (key === 'restaurants') setRestaurantsStatus(filter ?? '');
    const target = '/' + key;
    if (window.location.pathname !== target) {
      window.history.pushState(null, '', target);
    }
    setRoute(key);
  };
  const forceLocalLogout = () => {
    api.clearSession();
    window.history.replaceState(null, '', '/');
    setRoute('home');
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
      <AuthPage
        api={api}
        title="إدارة المنصة"
        theme="admin"
        initialNotice={authNotice}
        login={(account) => {
          setAuthNotice('');
          setUser(account);
        }}
      />
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
        forceLocalLogout={forceLocalLogout}
        logout={async () => {
          await api.request('/auth/logout', { method: 'POST' });
          forceLocalLogout();
        }}
      >
        <Suspense fallback={<Loading />}>
          {route === 'home' && (
            <Home revision={analyticsRevision} navigate={navigate} />
          )}
          {route === 'restaurants' && (
            <Restaurants
              revision={revision}
              analyticsRevision={analyticsRevision}
              initialStatus={restaurantsStatus}
              onInitialStatusConsumed={() => setRestaurantsStatus('')}
            />
          )}
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
              initialStatus={ordersStatus}
              onInitialStatusConsumed={() => setOrdersStatus('')}
              dateFields={(value, change) => (
                <ArabicDateFields value={value} change={change} />
              )}
              actions={(order, refresh) => (
                <AdminActions order={order} refresh={refresh} />
              )}
            />
          )}
          {route === 'account' && (
            <AccountScreen
              api={api}
              user={user}
              updated={setUser}
              onPasswordChanged={() =>
                setAuthNotice(
                  'تم تغيير كلمة المرور بنجاح. سجّل الدخول بكلمة المرور الجديدة.',
                )
              }
            />
          )}
        </Suspense>
      </Shell>
    </ArabicFields>
  );
}
