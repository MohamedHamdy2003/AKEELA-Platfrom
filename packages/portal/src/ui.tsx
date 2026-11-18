import { LogoutConfirmation } from './logout-confirmation';
import {
  useEffect,
  useRef,
  useState,
  createContext,
  useContext,
  useId,
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type HTMLAttributes,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  ClipboardList,
  Building2,
  UserRound,
  Home,
  LogOut,
  Menu,
  RefreshCw,
  ShieldCheck,
  Truck,
  Users,
  Utensils,
  X,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import logo from '@akeela/brand/logo.png';
import logoWebp from '@akeela/brand/logo.webp';
import brandIcon from '@akeela/brand/icon.png';
import brandIconWebp from '@akeela/brand/icon.webp';
import { ApiClient, ApiError, errorMessage } from './api';
import {
  statuses,
  type Envelope,
  type Meta,
  type Order,
  type OrderStatus,
  type User,
} from './models';

export function money(value: string) {
  const [whole, fraction = '00'] = value.split('.');
  return (
    whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',') +
    '.' +
    fraction.padEnd(2, '0') +
    ' EGP'
  );
}
export function dateTime(value: string) {
  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Cairo',
  }).format(new Date(value));
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={'notice ' + (error ? 'error' : '')}
      role={error ? 'alert' : 'status'}
    >
      {children}
    </div>
  );
}
export function Failure({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  const messages = useContext(FieldMessagesContext);
  return (
    <Notice error>
      {messages('', [errorMessage(error)]).join(' ')}{' '}
      {retry && (
        <button className="text-button" onClick={retry}>
          إعادة المحاولة
        </button>
      )}
    </Notice>
  );
}
export const FieldMessagesContext = createContext<
  (name: string, messages: string[]) => string[]
>((_name, messages) => messages);
export function Field({
  label,
  name,
  errors,
  children,
}: {
  label: string;
  name?: string;
  errors?: Record<string, string[]>;
  children: ReactNode;
}) {
  const id = useId();
  const messages = useContext(FieldMessagesContext);
  return (
    <label className="field">
      <span id={id}>{label}</span>
      {Children.map(children, (child) =>
        isValidElement(child) &&
        ['input', 'select', 'textarea'].includes(String(child.type))
          ? cloneElement(child as ReactElement<HTMLAttributes<HTMLElement>>, {
              'aria-labelledby': id,
              'aria-invalid': name && errors?.[name] ? true : undefined,
            })
          : child,
      )}
      {name && errors?.[name] && (
        <small className="field-error">
          {messages(name, errors[name]!).join(' ')}
        </small>
      )}
    </label>
  );
}
export function Badge({ status }: { status: OrderStatus }) {
  return (
    <span className={'badge ' + status}>
      <Circle size={10} />
      {statuses[status]}
    </span>
  );
}
export function Pager({
  meta,
  change,
}: {
  meta?: Meta;
  change: (page: number) => void;
}) {
  if (!meta) return null;
  return (
    <div className="pager">
      <span>
        الصفحة {meta.page} من {meta.last_page || 1} · {meta.total} نتيجة
      </span>
      <div>
        <button
          aria-label="الصفحة السابقة"
          disabled={meta.page <= 1}
          onClick={() => change(meta.page - 1)}
        >
          <ArrowRight size={16} />
        </button>
        <strong>{meta.page}</strong>
        <button
          aria-label="الصفحة التالية"
          disabled={meta.page >= meta.last_page}
          onClick={() => change(meta.page + 1)}
        >
          <ArrowLeft size={16} />
        </button>
      </div>
    </div>
  );
}
export function Loading() {
  return (
    <div className="skeleton" aria-label="جار التحميل" role="status">
      <div />
      <div />
      <div />
    </div>
  );
}
export function useResource<T>(
  api: ApiClient,
  path: string | null,
  revision = 0,
) {
  const [result, setResult] = useState<Envelope<T> | null>(null),
    [error, setError] = useState<unknown>(null),
    [loading, setLoading] = useState(false),
    [tick, setTick] = useState(0);
  const previous = useRef<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    if (previous.current !== path) setResult(null);
    previous.current = path;
    setError(null);
    setLoading(!!path);
    if (path)
      void api
        .request<T>(path, { signal: controller.signal })
        .then((value) => {
          if (!controller.signal.aborted) setResult(value);
        })
        .catch((cause) => {
          if (!controller.signal.aborted) setError(cause);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    return () => controller.abort();
  }, [api, path, revision, tick]);
  return { result, error, loading, reload: () => setTick((n) => n + 1) };
}
export function ResourceState({
  resource,
  children,
  empty = false,
}: {
  resource: {
    result: unknown;
    error: unknown;
    loading: boolean;
    reload: () => void;
  };
  children: ReactNode;
  empty?: boolean;
}) {
  if (resource.error)
    return <Failure error={resource.error} retry={resource.reload} />;
  if (!resource.result && resource.loading) return <Loading />;
  if (empty)
    return (
      <div className="empty">
        <Circle size={26} />
        <h3>لا توجد نتائج بهذه الخيارات</h3>
        <p>ستظهر البيانات هنا عند توفرها.</p>
      </div>
    );
  return (
    <>
      {resource.loading && (
        <span className="updating" role="status">
          جار تحديث البيانات…
        </span>
      )}
      {children}
    </>
  );
}
export function PageTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-title">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  );
}
export function Confirm({
  label,
  description,
  run,
  danger = false,
  done,
}: {
  label: string;
  description: string;
  run: () => Promise<unknown>;
  danger?: boolean;
  done: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  return (
    <>
      <button
        className={'button ' + (danger ? 'danger' : 'primary')}
        onClick={() => {
          setError(null);
          dialog.current?.showModal();
        }}
      >
        {label}
      </button>
      <dialog
        ref={dialog}
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <div className="dialog-head">
          <h2>{label}</h2>
          <button
            aria-label="إغلاق"
            disabled={busy}
            onClick={() => dialog.current?.close()}
          >
            <X size={18} />
          </button>
        </div>
        <p>{description}</p>
        {!!error && <Failure error={error} />}
        <div className="actions">
          <button
            className={'button ' + (danger ? 'danger' : 'primary')}
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              void run()
                .then(() => {
                  dialog.current?.close();
                  done();
                })
                .catch((cause) => {
                  setError(cause);
                  done();
                })
                .finally(() => setBusy(false));
            }}
          >
            {busy ? 'جار التنفيذ…' : 'تأكيد'}
          </button>
          <button
            className="button"
            disabled={busy}
            onClick={() => dialog.current?.close()}
          >
            رجوع
          </button>
        </div>
      </dialog>
    </>
  );
}
const navIcons: Record<string, typeof Home> = {
  home: Home,
  restaurants: Utensils,
  users: Users,
  companies: Truck,
  orders: ClipboardList,
  drivers: Users,
  profile: Building2,
  account: UserRound,
};
export function Shell({
  user,
  appName,
  theme,
  navigation,
  route,
  navigate,
  status,
  logout,
  children,
}: {
  user: User;
  appName: string;
  theme: 'admin' | 'delivery';
  navigation: Array<[string, string]>;
  route: string;
  navigate: (key: string) => void;
  status: string;
  logout: () => Promise<void>;
  children: ReactNode;
}) {
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [compact, setCompact] = useState(
    () => window.matchMedia('(max-width: 960px)').matches,
  );
  useEffect(() => {
    const media = window.matchMedia('(max-width: 960px)');
    const update = () => {
      setCompact(media.matches);
      setDrawer(false);
    };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const drawerRef = useRef<HTMLElement>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const logoutTrigger = useRef<HTMLButtonElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!drawer) return;
    const old = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawerRef.current
      ?.querySelector<HTMLButtonElement>('.drawer-close')
      ?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawer(false);
      if (event.key === 'Tab') {
        const elements = [
          ...(drawerRef.current?.querySelectorAll<HTMLButtonElement>(
            'button:not([disabled])',
          ) ?? []),
        ].filter((element) => element.offsetParent !== null);
        const first = elements[0],
          last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('keydown', escape);
      document.body.style.overflow = overflow;
      old?.focus();
    };
  }, [drawer]);
  return (
    <div
      className="portal portal-shell"
      data-portal={theme}
      data-sidebar-collapsed={collapsed}
    >
      <button
        className="skip-link"
        onClick={() => document.getElementById('main-content')?.focus()}
      >
        انتقل للمحتوى
      </button>
      {drawer && (
        <button
          className="drawer-backdrop"
          aria-label="إغلاق القائمة"
          onClick={() => setDrawer(false)}
        />
      )}
      <aside
        ref={drawerRef}
        className={'sidebar ' + (drawer ? 'open' : '')}
        inert={compact && !drawer}
        aria-hidden={compact && !drawer ? true : undefined}
      >
        <div className="wordmark">
          <picture>
            <source srcSet={logoWebp} type="image/webp" />
            <img
              className="sidebar-wordmark"
              src={logo}
              alt="AKEELA"
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
          <small className="brand-label">{appName}</small>
        </div>
        <button
          className="drawer-close"
          aria-label="إغلاق القائمة"
          onClick={() => setDrawer(false)}
        >
          <X />
        </button>
        <button
          className="sidebar-toggle"
          aria-label={
            collapsed ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية'
          }
          aria-expanded={!collapsed}
          aria-controls="portal-navigation"
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
        <nav id="portal-navigation" aria-label="القائمة الرئيسية">
          {navigation.map(([key, label]) => {
            const Icon = navIcons[key] ?? Home;
            return (
              <button
                key={key}
                aria-current={route === key ? 'page' : undefined}
                className={route === key ? 'active' : ''}
                aria-label={label}
                title={collapsed && !compact ? label : undefined}
                onClick={() => {
                  navigate(key);
                  setDrawer(false);
                }}
              >
                <Icon size={19} aria-hidden="true" />
                <span className="nav-label">{label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <button
            className="sidebar-logout"
            ref={logoutTrigger}
            aria-label="تسجيل الخروج"
            aria-haspopup="dialog"
            title={collapsed ? 'تسجيل الخروج' : undefined}
            onClick={() => {
              setDrawer(false);
              setLogoutOpen(true);
            }}
          >
            <LogOut size={18} aria-hidden="true" />
            <span className="nav-label">تسجيل الخروج</span>
          </button>
        </div>
      </aside>
      {logoutOpen && (
        <LogoutConfirmation
          appName={appName}
          confirm={logout}
          closed={() => {
            setLogoutOpen(false);
            requestAnimationFrame(() => {
              (compact ? menuTrigger.current : logoutTrigger.current)?.focus();
            });
          }}
        />
      )}
      <div className="workspace" inert={compact && drawer}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              ref={menuTrigger}
              className="mobile-menu"
              aria-label="فتح القائمة"
              aria-expanded={drawer}
              aria-controls="portal-navigation"
              onClick={() => setDrawer(true)}
            >
              <Menu size={21} />
            </button>
            <span>{appName}</span>
            <span>/</span>
            <strong>{navigation.find(([key]) => key === route)?.[1]}</strong>
          </div>
          <div className="account-tools">
            <span className={'connection ' + status} role="status">
              <i />
              {status === 'connected'
                ? 'متصل لحظيًا'
                : status === 'connecting'
                  ? 'جار الاتصال'
                  : 'غير متصل لحظيًا'}
            </span>
            <span className="avatar">{user.full_name.slice(0, 1)}</span>
            <span className="account-name">
              {user.full_name}
              <small>{appName}</small>
            </span>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="portal-main">
          {status === 'offline' && (
            <Notice>
              التحديث اللحظي غير متصل. يمكنك تحديث البيانات يدويًا حتى يعود
              الاتصال.
            </Notice>
          )}
          {children}
        </main>
        <footer className="workspace-footer">
          AKEELA · التشغيل بتوقيت مصر · EGP
        </footer>
      </div>
    </div>
  );
}
export function AuthPage({
  api,
  title,
  theme,
  login,
}: {
  api: ApiClient;
  title: string;
  theme: 'admin' | 'delivery';
  login: (user: User) => void;
}) {
  const [mode, setMode] = useState<'login' | 'verify' | 'forgot' | 'reset'>(
      'login',
    ),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [otp, setOtp] = useState(''),
    [newPassword, setNewPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [notice, setNotice] = useState(''),
    [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      if (mode === 'login') {
        login(await api.login(email, password));
        return;
      }
      if (mode === 'verify') {
        await api.request('/auth/verify-email', {
          method: 'POST',
          public: true,
          body: { email, otp },
        });
        setMode('login');
        setOtp('');
        setNotice('تم تأكيد البريد. سجّل الدخول للمتابعة.');
      }
      if (mode === 'forgot') {
        await api.request('/auth/forgot-password', {
          method: 'POST',
          public: true,
          body: { email },
        });
        setMode('reset');
        setNotice('إذا كان الحساب مؤهلًا فقد أُرسل رمز إلى البريد الإلكتروني.');
      }
      if (mode === 'reset') {
        await api.request('/auth/reset-password', {
          method: 'POST',
          public: true,
          body: { email, otp, new_password: newPassword },
        });
        setMode('login');
        setPassword('');
        setNewPassword('');
        setOtp('');
        setNotice('تم تغيير كلمة المرور. سجّل الدخول من جديد.');
      }
    } catch (cause) {
      setError(cause);
      if (cause instanceof ApiError && cause.code === 'EMAIL_NOT_VERIFIED')
        setMode('verify');
    } finally {
      setBusy(false);
    }
  };
  const fields = error instanceof ApiError ? error.fields : {};
  return (
    <div className="portal auth-page" data-portal={theme}>
      <section className="auth-identity">
        <picture>
          <source srcSet={logoWebp} type="image/webp" />
          <img
            src={logo}
            alt="AKEELA"
            width="135"
            height="123"
            decoding="async"
          />
        </picture>
        <div>
          <span className="identity-line" />
          <h2>
            {theme === 'admin'
              ? 'رؤية واضحة.\nإدارة متكاملة.'
              : 'كل طلب،\nفي مساره الصحيح.'}
          </h2>
          <p>
            {theme === 'admin'
              ? 'مساحة التشغيل والإشراف على منصة AKEELA.'
              : 'مساحة إدارة الطلبات والسائقين لشركتك.'}
          </p>
        </div>
        <small>منصة AKEELA · {title}</small>
      </section>
      <main className="auth-content">
        <div className="auth-card">
          <span className="auth-icon">
            {theme === 'delivery' ? (
              <Truck size={26} aria-hidden="true" />
            ) : (
              <ShieldCheck size={25} aria-hidden="true" />
            )}
          </span>
          <h1>
            {mode === 'login'
              ? 'مرحبًا بعودتك'
              : mode === 'verify'
                ? 'تأكيد البريد الإلكتروني'
                : mode === 'forgot'
                  ? 'استعادة الحساب'
                  : 'كلمة مرور جديدة'}
          </h1>
          <p>
            {title} ·{' '}
            {mode === 'login'
              ? 'سجّل الدخول للوصول لمساحة العمل.'
              : 'رمز التأكيد يُرسل إلى البريد الإلكتروني فقط.'}
          </p>
          {notice && <Notice>{notice}</Notice>}
          {!!error && <Failure error={error} />}
          <form onSubmit={(event) => void submit(event)}>
            <fieldset disabled={busy}>
              <Field label="البريد الإلكتروني" name="email" errors={fields}>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  dir="ltr"
                  maxLength={254}
                />
              </Field>
              {mode === 'login' && (
                <Field label="كلمة المرور" name="password" errors={fields}>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    autoComplete="current-password"
                    maxLength={128}
                  />
                </Field>
              )}
              {(mode === 'verify' || mode === 'reset') && (
                <Field label="رمز التأكيد" name="otp" errors={fields}>
                  <input
                    value={otp}
                    onChange={(event) => setOtp(event.target.value)}
                    required
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    autoComplete="one-time-code"
                    dir="ltr"
                  />
                </Field>
              )}
              {mode === 'reset' && (
                <Field
                  label="كلمة المرور الجديدة"
                  name="new_password"
                  errors={fields}
                >
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                  />
                  <small>8 أحرف على الأقل، تتضمن حرفًا ورقمًا.</small>
                </Field>
              )}
              <button className="button primary full" type="submit">
                {busy
                  ? 'جار التنفيذ…'
                  : mode === 'login'
                    ? 'تسجيل الدخول'
                    : mode === 'forgot'
                      ? 'إرسال رمز الاستعادة'
                      : 'تأكيد ومتابعة'}
                <ArrowLeft size={17} />
              </button>
            </fieldset>
          </form>
          {mode === 'login' ? (
            <div className="auth-links">
              <button
                onClick={() => {
                  setMode('forgot');
                  setError(null);
                }}
              >
                نسيت كلمة المرور؟
              </button>
              <button
                onClick={() => {
                  setMode('verify');
                  setError(null);
                }}
              >
                تأكيد البريد
              </button>
            </div>
          ) : (
            <div className="auth-links">
              <button
                disabled={busy}
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
              >
                العودة لتسجيل الدخول
              </button>
              {mode === 'verify' && (
                <button
                  disabled={busy || cooldown > 0 || !email}
                  onClick={() => {
                    setBusy(true);
                    void api
                      .request('/auth/resend-verification', {
                        method: 'POST',
                        public: true,
                        body: { email },
                      })
                      .then(() => {
                        setCooldown(60);
                        setNotice('إذا كان الحساب مؤهلًا فقد أُرسل رمز جديد.');
                      })
                      .catch((cause) => {
                        setError(cause);
                        if (cause instanceof ApiError)
                          setCooldown(cause.retryAfter);
                      })
                      .finally(() => setBusy(false));
                  }}
                >
                  {cooldown
                    ? `إعادة الإرسال بعد ${cooldown} ث`
                    : 'إعادة إرسال الرمز'}
                </button>
              )}
            </div>
          )}
          <p className="auth-note">
            {theme === 'admin'
              ? 'حساب الإدارة يُجهّز مسبقًا من إعدادات المنصة.'
              : 'حساب الشركة تنشئه إدارة المنصة.'}{' '}
            لا يوجد تسجيل عام هنا.
          </p>
        </div>
      </main>
    </div>
  );
}
export function OrderFacts({
  order,
  actions,
}: {
  order: Order;
  actions?: ReactNode;
}) {
  return (
    <>
      <div className="detail-status">
        <bdi>#{order.order_id}</bdi>
        <Badge status={order.status} />
      </div>
      {order.pickup && (
        <section className="detail-section">
          <h3>نقطة الاستلام</h3>
          <strong>{order.pickup.rest_title}</strong>
          <p>{order.pickup.rest_address}</p>
          <bdi>
            {order.pickup.latitude}, {order.pickup.longitude}
          </bdi>
        </section>
      )}
      <section className="detail-section">
        <h3>الطلب</h3>
        {order.items.map((item) => (
          <div key={item.order_item_id} className="order-item">
            <div>
              <strong>
                {item.item_name} × {item.quantity}
              </strong>
              <bdi>{money(item.subtotal)}</bdi>
            </div>
            <small>
              سعر الوحدة: <bdi>{money(item.unit_price)}</bdi>
            </small>
            {item.addons.map((addon) => (
              <small key={addon.order_item_addon_id}>
                {addon.addon_name} × {addon.quantity} ·{' '}
                <bdi>{money(addon.subtotal)}</bdi> · سعر الوحدة:{' '}
                <bdi>{money(addon.unit_price)}</bdi>
              </small>
            ))}
          </div>
        ))}
      </section>
      <section className="detail-section">
        <h3>عنوان التوصيل</h3>
        <p>{order.customer_address}</p>
        <bdi>
          {order.delivery_latitude}, {order.delivery_longitude}
        </bdi>
        {order.notes && <p className="order-note">{order.notes}</p>}
      </section>
      {actions}
      <section className="detail-section">
        <div className="key-value">
          <span>رسوم التوصيل</span>
          <bdi>{money(order.delivery_fee)}</bdi>
        </div>
        <div className="order-total">
          <strong>الإجمالي</strong>
          <bdi>{money(order.total_price)}</bdi>
        </div>
        <small>تاريخ الطلب: {dateTime(order.created_at)}</small>
        <br />
        <small>آخر تحديث: {dateTime(order.updated_at)}</small>
      </section>
      <section className="detail-section">
        <h3>مراجع الطلب</h3>
        {(
          [
            ['معرّف العميل', order.customer_id],
            ['معرّف المطعم', order.rest_id],
            ['معرّف الشركة', order.company_id],
            ['معرّف السائق', order.driver_id],
          ] as const
        ).map(([label, id]) => (
          <div className="key-value" key={label}>
            <span>{label}</span>
            <bdi>{id ? '#' + id : 'لم يُسند'}</bdi>
          </div>
        ))}
      </section>
    </>
  );
}
export function Metrics({
  items,
}: {
  items: Array<{ label: string; value: number | null; icon?: ReactNode }>;
}) {
  return (
    <div className="metrics">
      {items.map((item) => (
        <div className="metric" key={item.label}>
          <span className="metric-icon">
            {item.icon ?? <Check size={23} />}
          </span>
          <div>
            <span>{item.label}</span>
            <strong>
              {item.value === null ? '—' : item.value.toLocaleString('ar-EG')}
            </strong>
          </div>
        </div>
      ))}
    </div>
  );
}
export { RefreshCw, X, statuses };
