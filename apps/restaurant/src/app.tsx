import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  BellRing,
  SquarePlus,
  ConciergeBell,
  House,
  Layers,
  LogOut,
  Menu,
  Package,
  RefreshCw,
  Store,
  Tag,
  UserRound,
  X,
} from 'lucide-react';
import logo from '@akeela/brand/logo.png';
import { watchOrders } from '@akeela/portal/realtime';
import { api } from './lib/api';
import type { CatalogKind, Dashboard, Profile, User } from './lib/models';
import { today } from './lib/format';
import { Auth } from './features/auth';
import { Home } from './features/home';
import { Catalog } from './features/catalog';
import { Orders } from './features/orders';
import { Account, RestaurantProfile } from './features/settings';
import { ButtonContent, Failure, Loading, Notice } from './components/ui';
import { Presence } from './components/presence';

const navigation = [
  { key: 'home', label: 'الرئيسية', icon: House },
  { key: 'orders', label: 'الطلبات', icon: ConciergeBell },
  { key: 'categories', label: 'التصنيفات', icon: Layers },
  { key: 'products', label: 'المنتجات', icon: Package },
  { key: 'addons', label: 'الإضافات', icon: SquarePlus },
  { key: 'offers', label: 'العروض', icon: Tag },
  { key: 'profile', label: 'ملف المطعم', icon: Store },
  { key: 'account', label: 'حسابي', icon: UserRound },
];
function currentRoute() {
  const key = window.location.hash.slice(2);
  return navigation.some((item) => item.key === key) ? key : 'home';
}
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="state">
        <h1>تعذّر عرض الصفحة.</h1>
        <button
          className="button primary"
          onClick={() => window.location.reload()}
        >
          إعادة تحميل التطبيق
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
export function App() {
  return (
    <ErrorBoundary>
      <Workspace />
    </ErrorBoundary>
  );
}
function Workspace() {
  const sessionGeneration = useRef(0);
  const sidebarRef = useRef<HTMLElement>(null);
  const [compactNavigation, setCompactNavigation] = useState(
    () => window.matchMedia('(max-width: 960px)').matches,
  );
  const [user, setUser] = useState<User | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [route, setRoute] = useState(currentRoute);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 960px)');
    const update = () => {
      setCompactNavigation(media.matches);
      setMobile(false);
    };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!mobile) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebarRef.current
      ?.querySelector<HTMLButtonElement>('button:not([disabled])')
      ?.focus();
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobile(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onEscape);
      previous?.focus();
    };
  }, [mobile]);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [initialOrder, setInitialOrder] = useState<string | null>(null);
  const navigate = useCallback((key: string) => {
    window.location.hash = '/' + key;
    setRoute(key);
    setMobile(false);
  }, []);
  const consumeInitial = useCallback(() => setInitialOrder(null), []);
  const refreshStatus = useCallback(async () => {
    const generation = sessionGeneration.current;
    setError(null);
    setBusy(true);
    try {
      const [status, details] = await Promise.all([
        api.request<Dashboard>('/restaurant/dashboard'),
        api.request<Profile>('/restaurant/profile'),
      ]);
      if (generation === sessionGeneration.current) {
        setDashboard(status.data);
        setProfile(details.data);
      }
    } catch (cause) {
      if (generation === sessionGeneration.current) setError(cause);
    } finally {
      if (generation === sessionGeneration.current) setBusy(false);
    }
  }, []);
  useEffect(() => {
    api.onSessionEnd = () => {
      sessionGeneration.current++;
      setUser(null);
      setDashboard(null);
      setProfile(null);
      setMobile(false);
    };
    api.onActivationDenied = () => {
      setDashboard((old) => (old ? { ...old, can_manage: false } : old));
      void refreshStatus();
    };
    return () => {
      api.onSessionEnd = undefined;
      api.onActivationDenied = undefined;
    };
  }, [refreshStatus]);
  const authenticated = !!user;
  useEffect(() => {
    if (!authenticated || !dashboard?.can_manage) return;
    return watchOrders({
      baseUrl: import.meta.env.VITE_API_BASE_URL || '/api/v1',
      getToken: () => api.tokenForRealtime(),
      changed: () => window.dispatchEvent(new Event('akeela:orders-changed')),
    });
  }, [authenticated, dashboard?.can_manage]);
  useEffect(() => {
    if (authenticated) void refreshStatus();
  }, [authenticated, route, refreshStatus]);
  useEffect(() => {
    if (!user) return;
    const onFocus = () => {
      void refreshStatus();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user, refreshStatus]);
  useEffect(() => {
    const onHash = () => {
      setRoute(currentRoute());
      setMobile(false);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    document.title = `AKEELA - المطعم - ${user ? (navigation.find((item) => item.key === route)?.label ?? 'لوحة المطعم') : 'تسجيل الدخول'}`;
  }, [route, user]);
  async function logout() {
    setLoggingOut(true);
    setError(null);
    try {
      await api.request('/auth/logout', { method: 'POST' });
      api.clearSession();
    } catch (cause) {
      setError(cause);
    } finally {
      setLoggingOut(false);
    }
  }
  if (!user)
    return (
      <Auth
        onLogin={(account) => {
          sessionGeneration.current++;
          setUser(account);
          navigate('home');
        }}
      />
    );
  const manageable = !!dashboard?.can_manage;
  const locked = !manageable && !['home', 'profile', 'account'].includes(route);
  const body =
    !dashboard || !profile ? (
      busy ? (
        <Loading />
      ) : (
        <Failure
          error={error || new Error('تعذّر تحميل بيانات المطعم.')}
          retry={refreshStatus}
        />
      )
    ) : locked ? (
      <Home
        dashboard={dashboard}
        profile={profile}
        navigate={navigate}
        openOrder={() => undefined}
        onProfileChanged={refreshStatus}
      />
    ) : route === 'home' ? (
      <Home
        dashboard={dashboard}
        profile={profile}
        navigate={navigate}
        openOrder={(id) => {
          setInitialOrder(id);
          navigate('orders');
        }}
        onProfileChanged={refreshStatus}
      />
    ) : route === 'orders' ? (
      <Orders initialId={initialOrder} onInitialConsumed={consumeInitial} />
    ) : route === 'profile' ? (
      <RestaurantProfile canManage={manageable} onSaved={refreshStatus} />
    ) : route === 'account' ? (
      <Account user={user} canManage={manageable} onSaved={setUser} />
    ) : (
      <Catalog key={route} kind={route as CatalogKind} />
    );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content" inert={mobile}>
        انتقل إلى المحتوى
      </a>
      <div className="mobile-top" inert={mobile}>
        <img src={logo} alt="أكيلة" />
        <button
          className="icon-button"
          aria-label="فتح القائمة"
          aria-expanded={mobile}
          onClick={() => setMobile(true)}
        >
          <Menu />
        </button>
      </div>
      <Presence>
        {mobile && (
          <button
            className="nav-backdrop"
            aria-label="إغلاق القائمة"
            onClick={() => setMobile(false)}
          />
        )}
      </Presence>
      <aside
        ref={sidebarRef}
        className={'sidebar ' + (mobile ? 'is-open' : '')}
        aria-label="التنقل الرئيسي"
        inert={compactNavigation && !mobile}
        aria-hidden={compactNavigation && !mobile ? true : undefined}
      >
        <div className="sidebar-brand">
          <img src={logo} alt="أكيلة — AKEELA" />
          <button
            className="icon-button mobile-close"
            aria-label="إغلاق القائمة"
            onClick={() => setMobile(false)}
          >
            <X />
          </button>
        </div>
        <nav>
          {navigation.map((item) => (
            <button
              key={item.key}
              aria-current={route === item.key ? 'page' : undefined}
              disabled={
                !manageable &&
                !['home', 'profile', 'account'].includes(item.key)
              }
              onClick={() => navigate(item.key)}
            >
              <item.icon size={25} strokeWidth={1.7} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <button className="logout" disabled={loggingOut} onClick={logout}>
          <LogOut size={23} strokeWidth={1.7} />
          <ButtonContent busy={loggingOut} pending="جارٍ الخروج…">
            تسجيل الخروج
          </ButtonContent>
        </button>
      </aside>
      <main id="main-content" className="workspace" inert={mobile}>
        <header className="topbar">
          <span>لوحة المطعم</span>
          <span>{today()}</span>
        </header>
        {!!error && dashboard && <Notice error={error} />}
        <div className="workspace-body" key={route} data-route={route}>
          {body}
        </div>
        {dashboard && !dashboard.can_manage && (
          <div className="status-refresh">
            <BellRing size={18} />
            <span>حالة التفعيل لا تتحدث تلقائيًا.</span>
            <button
              className="text-button"
              disabled={busy}
              onClick={refreshStatus}
            >
              <RefreshCw size={16} />
              تحديث الحالة
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
