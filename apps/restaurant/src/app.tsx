import { LogoutConfirmation } from '@akeela/portal/logout-confirmation';
import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  BarChart3,
  BellRing,
  SquarePlus,
  ConciergeBell,
  Layers,
  LogOut,
  Maximize2,
  Menu,
  Minimize2,
  Package,
  RefreshCw,
  Store,
  Tag,
  UserRound,
  X,
} from 'lucide-react';
import logo from '@akeela/brand/logo.png';
import logoWebp from '@akeela/brand/logo.webp';
import { watchOrders, type RealtimeStatus } from '@akeela/portal/realtime';
import { api } from './lib/api';
import type { CatalogKind, Dashboard, Profile, User } from './lib/models';
import { today } from './lib/format';
import { Auth } from './features/auth';
import { ActivationNotice } from './features/home';
import { RestaurantAnalyticsScreen } from './features/analytics';
import { Catalog } from './features/catalog';
import { Orders } from './features/orders';
import { Account, RestaurantProfile } from './features/settings';
import { Failure, Loading, Notice } from './components/ui';
import { Presence } from './components/presence';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import brandIcon from '@akeela/brand/icon.png';
import brandIconWebp from '@akeela/brand/icon.webp';
import { useSessionRestore } from '@akeela/portal/use-session-restore';

const navigation = [
  { key: 'analytics', label: 'التحليلات', icon: BarChart3 },
  { key: 'orders', label: 'الطلبات', icon: ConciergeBell },
  { key: 'categories', label: 'التصنيفات', icon: Layers },
  { key: 'products', label: 'المنتجات', icon: Package },
  { key: 'addons', label: 'الإضافات', icon: SquarePlus },
  { key: 'offers', label: 'العروض', icon: Tag },
  { key: 'profile', label: 'ملف المطعم', icon: Store },
  { key: 'account', label: 'حسابي', icon: UserRound },
];
function currentRoute() {
  if (typeof window === 'undefined') return 'analytics';
  if (window.location.hash.startsWith('#/')) {
    const hashKey = window.location.hash.slice(2);
    if (hashKey) {
      const normalized = hashKey === 'home' ? 'analytics' : hashKey;
      window.history.replaceState(null, '', '/' + normalized);
      return navigation.some((item) => item.key === normalized)
        ? normalized
        : 'analytics';
    }
  }
  const key = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
  return navigation.some((item) => item.key === key) ? key : 'analytics';
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
  const { restoring, restoreError, retryRestore } = useSessionRestore(
    api,
    setUser,
  );
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [route, setRoute] = useState(currentRoute);
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const onFullscreenChange = () => {
      setFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement
        .requestFullscreen?.()
        .catch(() => undefined);
    } else {
      void document.exitFullscreen?.().catch(() => undefined);
    }
  };
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
  const [logoutOpen, setLogoutOpen] = useState(false);
  const logoutTrigger = useRef<HTMLButtonElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const [initialOrder, setInitialOrder] = useState<string | null>(null);
  const [ordersStatus, setOrdersStatus] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeStatus>('connecting');
  const lastStatusRefreshAt = useRef(0);
  const hasDashboardRef = useRef(false);
  hasDashboardRef.current = Boolean(dashboard && profile);
  const navigate = useCallback((key: string, filter?: string) => {
    const target = '/' + key;
    if (window.location.pathname !== target) {
      window.history.pushState(null, '', target);
    }
    if (key === 'orders' && filter !== undefined) {
      setOrdersStatus(filter);
    }
    setRoute(key);
    setMobile(false);
  }, []);
  const consumeInitial = useCallback(() => setInitialOrder(null), []);
  const consumeOrdersStatus = useCallback(() => setOrdersStatus(''), []);
  const refreshStatus = useCallback(async (force = false) => {
    const now = Date.now();
    if (
      !force &&
      hasDashboardRef.current &&
      now - lastStatusRefreshAt.current < 60_000
    ) {
      return;
    }
    const generation = sessionGeneration.current;
    setError(null);
    setBusy(true);
    try {
      const [status, details] = await Promise.all([
        api.request<Dashboard>('/restaurant/dashboard'),
        api.request<Profile>('/restaurant/profile'),
      ]);
      if (generation === sessionGeneration.current) {
        lastStatusRefreshAt.current = Date.now();
        setDashboard(status.data);
        setProfile(details.data);
      }
    } catch (cause) {
      if (generation === sessionGeneration.current) setError(cause);
    } finally {
      if (generation === sessionGeneration.current) setBusy(false);
    }
  }, []);
  const forceRefreshStatus = useCallback(
    () => void refreshStatus(true),
    [refreshStatus],
  );
  useEffect(() => {
    api.onSessionEnd = () => {
      sessionGeneration.current++;
      lastStatusRefreshAt.current = 0;
      setUser(null);
      setDashboard(null);
      setProfile(null);
      setMobile(false);
    };
    api.onActivationDenied = () => {
      setDashboard((old) => (old ? { ...old, can_manage: false } : old));
      void refreshStatus(true);
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
      status: setRealtimeStatus,
    });
  }, [authenticated, dashboard?.can_manage]);
  useEffect(() => {
    if (authenticated) void refreshStatus(false);
  }, [authenticated, route, refreshStatus]);
  useEffect(() => {
    if (!user) return;
    const onFocus = () => {
      void refreshStatus(false);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user, refreshStatus]);
  useEffect(() => {
    const onLocationChange = () => {
      setRoute(currentRoute());
      setMobile(false);
    };
    window.addEventListener('popstate', onLocationChange);
    window.addEventListener('hashchange', onLocationChange);
    return () => {
      window.removeEventListener('popstate', onLocationChange);
      window.removeEventListener('hashchange', onLocationChange);
    };
  }, []);
  useEffect(() => {
    document.title = `AKEELA - المطعم - ${user ? (navigation.find((item) => item.key === route)?.label ?? 'لوحة المطعم') : 'تسجيل الدخول'}`;
  }, [route, user]);
  async function logout() {
    await api.request('/auth/logout', { method: 'POST' });
    api.clearSession();
    window.history.replaceState(null, '', '/');
    setRoute('analytics');
  }
  function forceLocalLogout() {
    api.clearSession();
    window.history.replaceState(null, '', '/');
    setRoute('analytics');
  }
  if (restoring || restoreError)
    return (
      <main className="state" aria-label="استعادة الجلسة">
        {restoring ? (
          <Loading />
        ) : (
          <Failure error={restoreError} retry={retryRestore} />
        )}
      </main>
    );
  if (!user)
    return (
      <Auth
        initialNotice={authNotice}
        onLogin={(account) => {
          sessionGeneration.current++;
          lastStatusRefreshAt.current = 0;
          setAuthNotice('');
          setUser(account);
          navigate('analytics');
        }}
      />
    );
  const manageable = !!dashboard?.can_manage;
  const locked = !manageable && !['profile', 'account'].includes(route);
  const body =
    !dashboard || !profile ? (
      busy ? (
        <Loading />
      ) : (
        <Failure
          error={error || new Error('تعذّر تحميل بيانات المطعم.')}
          retry={forceRefreshStatus}
        />
      )
    ) : locked ? (
      <ActivationNotice
        dashboard={dashboard}
        profile={profile}
        navigate={navigate}
      />
    ) : route === 'analytics' ? (
      <RestaurantAnalyticsScreen
        profile={profile}
        navigate={navigate}
        onProfileChanged={forceRefreshStatus}
      />
    ) : route === 'orders' ? (
      <Orders
        initialId={initialOrder}
        onInitialConsumed={consumeInitial}
        initialStatus={ordersStatus}
        onInitialStatusConsumed={consumeOrdersStatus}
      />
    ) : route === 'profile' ? (
      <RestaurantProfile canManage={manageable} onSaved={forceRefreshStatus} />
    ) : route === 'account' ? (
      <Account
        user={user}
        canManage={manageable}
        onSaved={setUser}
        onPasswordChanged={() =>
          setAuthNotice(
            'تم تغيير كلمة المرور بنجاح. سجّل الدخول بكلمة المرور الجديدة.',
          )
        }
      />
    ) : (
      <Catalog key={route} kind={route as CatalogKind} />
    );
  return (
    <div
      className="app-shell"
      data-sidebar-collapsed={collapsed}
      data-fullscreen={fullscreen || undefined}
    >
      <a className="skip-link" href="#main-content" inert={mobile}>
        انتقل إلى المحتوى
      </a>
      <div className="mobile-top" inert={mobile}>
        <picture>
          <source srcSet={logoWebp} type="image/webp" />
          <img src={logo} alt="أكيلة" width="70" height="64" decoding="async" />
        </picture>
        <button
          ref={menuTrigger}
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
          <picture>
            <source srcSet={logoWebp} type="image/webp" />
            <img
              className="sidebar-wordmark"
              src={logo}
              alt="أكيلة — AKEELA"
              width="92"
              height="92"
              decoding="async"
            />
          </picture>
          <picture>
            <source srcSet={brandIconWebp} type="image/webp" />
            <img
              className="sidebar-mark"
              src={brandIcon}
              alt=""
              aria-hidden="true"
              width="38"
              height="38"
              decoding="async"
            />
          </picture>
          <button
            className="icon-button mobile-close"
            aria-label="إغلاق القائمة"
            onClick={() => setMobile(false)}
          >
            <X />
          </button>
        </div>
        <button
          className="sidebar-toggle"
          aria-label={
            collapsed ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية'
          }
          aria-expanded={!collapsed}
          aria-controls="restaurant-navigation"
          title={collapsed ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية'}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? (
            <PanelRightOpen size={19} aria-hidden="true" />
          ) : (
            <PanelRightClose size={19} aria-hidden="true" />
          )}
          <span className="nav-label">طي القائمة</span>
        </button>
        <nav id="restaurant-navigation">
          {navigation.map((item) => (
            <button
              key={item.key}
              aria-current={route === item.key ? 'page' : undefined}
              aria-label={item.label}
              title={collapsed && !compactNavigation ? item.label : undefined}
              disabled={
                !manageable &&
                !['analytics', 'profile', 'account'].includes(item.key)
              }
              onClick={() => navigate(item.key)}
            >
              <item.icon size={25} strokeWidth={1.7} aria-hidden="true" />
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <button
          className="logout"
          ref={logoutTrigger}
          onClick={() => {
            setMobile(false);
            setLogoutOpen(true);
          }}
          aria-label="تسجيل الخروج"
          aria-haspopup="dialog"
          title={collapsed ? 'تسجيل الخروج' : undefined}
        >
          <LogOut size={23} strokeWidth={1.7} aria-hidden="true" />
          <span className="nav-label">تسجيل الخروج</span>
        </button>
      </aside>
      {logoutOpen && (
        <LogoutConfirmation
          appName="لوحة المطعم"
          confirm={logout}
          forceLocal={forceLocalLogout}
          closed={() => {
            setLogoutOpen(false);
            requestAnimationFrame(() => {
              (compactNavigation
                ? menuTrigger.current
                : logoutTrigger.current
              )?.focus();
            });
          }}
        />
      )}
      <main
        id="main-content"
        tabIndex={-1}
        className="workspace"
        inert={mobile}
      >
        <header className="topbar">
          <div className="topbar-start">
            <button
              type="button"
              className="fullscreen-toggle"
              aria-label={fullscreen ? 'إنهاء ملء الشاشة' : 'ملء الشاشة'}
              aria-pressed={fullscreen}
              title={
                fullscreen
                  ? 'إنهاء ملء الشاشة (Esc)'
                  : 'عرض الصفحة بارتفاع كامل'
              }
              onClick={toggleFullscreen}
            >
              {fullscreen ? (
                <Minimize2 size={15} aria-hidden="true" />
              ) : (
                <Maximize2 size={15} aria-hidden="true" />
              )}
            </button>
            <span>لوحة المطعم</span>
          </div>
          <div className="topbar-meta">
            {manageable && (
              <span className={'rt-pill is-' + realtimeStatus}>
                <span className="rt-dot" aria-hidden="true" />
                {realtimeStatus === 'connected'
                  ? 'تحديث لحظي متصل'
                  : realtimeStatus === 'offline'
                    ? 'الاتصال اللحظي منقطع'
                    : 'جارٍ الاتصال اللحظي…'}
              </span>
            )}
            <span>{today()}</span>
          </div>
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
              onClick={forceRefreshStatus}
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
