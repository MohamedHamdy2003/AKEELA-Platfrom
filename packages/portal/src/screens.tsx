import { DetailWorkspace } from './detail-workspace';
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCheck,
  CheckCircle,
  Clock,
  RefreshCw,
  Truck,
  XCircle,
} from 'lucide-react';
import { ApiClient, ApiError, query } from './api';
import {
  deliveryStatuses,
  statuses,
  type Driver,
  type Order,
  type OrderStatus,
  type OrderStatusCounts,
  type OrderSummary,
  type User,
} from './models';
import {
  Badge,
  dateTime,
  DetailSkeleton,
  Failure,
  Field,
  Metrics,
  money,
  Notice,
  OrderFacts,
  Pager,
  PageTitle,
  ResourceState,
  TableSkeleton,
  useResource,
} from './ui';
export type OrderDateFilters = { date_from: string; date_to: string };
const DELIVERY_STATUSES: OrderStatus[] = [
  'Accepted',
  'Picked_Up',
  'Delivered',
  'Failed',
];
export function OrdersBoard({
  api,
  prefix,
  revision,
  delivery = false,
  initialStatus,
  onInitialStatusConsumed,
  actions,
  dateFields,
}: {
  api: ApiClient;
  prefix: string;
  revision: number;
  delivery?: boolean;
  initialStatus?: string;
  onInitialStatusConsumed?: () => void;
  actions: (order: Order, refresh: () => void) => ReactNode;
  dateFields?: (
    value: OrderDateFilters,
    change: (value: OrderDateFilters) => void,
  ) => ReactNode;
}) {
  const [page, setPage] = useState(1),
    [filters, setFilters] = useState({
      status: initialStatus ?? '',
      date_from: '',
      date_to: '',
    }),
    [id, setId] = useState<string | null>(null),
    [tick, setTick] = useState(0),
    [resetSpin, setResetSpin] = useState(0);
  useEffect(() => {
    if (initialStatus !== undefined && initialStatus !== '') {
      setFilters((current) => ({ ...current, status: initialStatus }));
      setPage(1);
      onInitialStatusConsumed?.();
    }
  }, [initialStatus, onInitialStatusConsumed]);
  const hasCompleteDateRange = Boolean(filters.date_from && filters.date_to);
  const requestFilters = {
    status: filters.status,
    date_from: hasCompleteDateRange ? filters.date_from : '',
    date_to: hasCompleteDateRange ? filters.date_to : '',
  };
  const list = useResource<OrderSummary[]>(
    api,
    prefix + '/orders' + query({ page, per_page: 10, ...requestFilters }),
    revision + tick,
  );
  useEffect(() => {
    const last = list.result?.meta?.last_page;
    if (last && page > last) setPage(Math.max(1, last));
  }, [list.result?.meta?.last_page, page]);
  const detail = useResource<Order>(
    api,
    id ? prefix + '/orders/' + id : null,
    revision + tick,
  );
  const counts = useResource<OrderStatusCounts>(
      api,
      prefix + '/orders/counts',
      revision + tick,
    ),
    activeDrivers = useResource<unknown[]>(
      api,
      delivery ? '/delivery-company/drivers?per_page=1&is_active=true' : null,
      revision + tick,
    ),
    driversDirectory = useResource<Driver[]>(
      api,
      delivery ? '/delivery-company/drivers?per_page=100' : null,
      revision + tick,
    );
  const driverNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const driver of driversDirectory.result?.data ?? []) {
      map.set(driver.driver_id, driver.driver_name);
    }
    return map;
  }, [driversDirectory.result]);
  const statusCounts = counts.result?.data;
  const refresh = () => setTick((value) => value + 1);
  const toggleStatus = (target: string) => {
    setFilters((current) => ({
      ...current,
      status: current.status === target ? '' : target,
    }));
    setPage(1);
  };
  const availableStatuses = delivery
    ? DELIVERY_STATUSES
    : (Object.keys(statuses) as OrderStatus[]);
  const metricItems = delivery
    ? [
        {
          label: deliveryStatuses.Accepted,
          value: statusCounts?.Accepted ?? null,
          icon: <Clock size={20} />,
          status: 'Accepted' as OrderStatus,
          active: filters.status === 'Accepted',
          onClick: () => toggleStatus('Accepted'),
        },
        {
          label: 'قيد التوصيل',
          value: statusCounts?.Picked_Up ?? null,
          icon: <Truck size={20} />,
          status: 'Picked_Up' as OrderStatus,
          active: filters.status === 'Picked_Up',
          onClick: () => toggleStatus('Picked_Up'),
        },
        {
          label: 'تم التسليم',
          value: statusCounts?.Delivered ?? null,
          icon: <CheckCheck size={20} />,
          status: 'Delivered' as OrderStatus,
          active: filters.status === 'Delivered',
          onClick: () => toggleStatus('Delivered'),
        },
        {
          label: statuses.Failed,
          value: statusCounts?.Failed ?? null,
          icon: <AlertTriangle size={20} />,
          status: 'Failed' as OrderStatus,
          active: filters.status === 'Failed',
          onClick: () => toggleStatus('Failed'),
        },
        {
          label: 'السائقون النشطون',
          value: activeDrivers.result?.meta?.total ?? null,
          icon: <CheckCircle size={20} />,
        },
      ]
    : [
        {
          label: statuses.Pending,
          value: statusCounts?.Pending ?? null,
          icon: <Clock size={20} />,
          status: 'Pending' as OrderStatus,
          active: filters.status === 'Pending',
          onClick: () => toggleStatus('Pending'),
        },
        {
          label: statuses.Accepted,
          value: statusCounts?.Accepted ?? null,
          icon: <Check size={20} />,
          status: 'Accepted' as OrderStatus,
          active: filters.status === 'Accepted',
          onClick: () => toggleStatus('Accepted'),
        },
        {
          label: statuses.Picked_Up,
          value: statusCounts?.Picked_Up ?? null,
          icon: <Truck size={20} />,
          status: 'Picked_Up' as OrderStatus,
          active: filters.status === 'Picked_Up',
          onClick: () => toggleStatus('Picked_Up'),
        },
        {
          label: statuses.Delivered,
          value: statusCounts?.Delivered ?? null,
          icon: <CheckCheck size={20} />,
          status: 'Delivered' as OrderStatus,
          active: filters.status === 'Delivered',
          onClick: () => toggleStatus('Delivered'),
        },
        {
          label: statuses.Rejected,
          value: statusCounts?.Rejected ?? null,
          icon: <Ban size={20} />,
          status: 'Rejected' as OrderStatus,
          active: filters.status === 'Rejected',
          onClick: () => toggleStatus('Rejected'),
        },
        {
          label: statuses.Cancelled,
          value: statusCounts?.Cancelled ?? null,
          icon: <XCircle size={20} />,
          status: 'Cancelled' as OrderStatus,
          active: filters.status === 'Cancelled',
          onClick: () => toggleStatus('Cancelled'),
        },
        {
          label: statuses.Failed,
          value: statusCounts?.Failed ?? null,
          icon: <AlertTriangle size={20} />,
          status: 'Failed' as OrderStatus,
          active: filters.status === 'Failed',
          onClick: () => toggleStatus('Failed'),
        },
      ];
  return (
    <DetailWorkspace
      selectedKey={id}
      title="تفاصيل الطلب"
      titleBadge={id ?? undefined}
      onClose={() => setId(null)}
      details={
        <ResourceState resource={detail} skeleton={<DetailSkeleton />}>
          {detail.result && (
            <OrderFacts
              order={detail.result.data}
              delivery={delivery}
              driverName={
                detail.result.data.driver_id
                  ? driverNameById.get(detail.result.data.driver_id)
                  : undefined
              }
              actions={actions(detail.result.data, refresh)}
            />
          )}
        </ResourceState>
      }
    >
      <section>
        <PageTitle
          title={delivery ? 'طلبات الشركة' : 'إدارة الطلبات'}
          description={
            delivery
              ? 'عرض وإدارة الطلبات المسندة إلى شركتك فقط.'
              : 'متابعة طلبات المنصة حسب الحالة والفترة الزمنية.'
          }
        />
        <Metrics items={metricItems} />
        <div className="filters orders-filter-bar">
          <Field label="حالة الطلب">
            <select
              value={filters.status}
              onChange={(event) => {
                setFilters({ ...filters, status: event.target.value });
                setPage(1);
              }}
            >
              <option value="">جميع الحالات</option>
              {availableStatuses.map((value) => (
                <option value={value} key={value}>
                  {delivery ? deliveryStatuses[value] : statuses[value]}
                </option>
              ))}
            </select>
          </Field>
          {dateFields ? (
            <div key={resetSpin} style={{ display: 'contents' }}>
              {dateFields(
                { date_from: filters.date_from, date_to: filters.date_to },
                (dates) => {
                  setFilters((current) => ({ ...current, ...dates }));
                  setPage(1);
                },
              )}
            </div>
          ) : (
            <>
              <Field label="من تاريخ">
                <input
                  type="date"
                  value={filters.date_from}
                  onChange={(event) => {
                    setFilters({ ...filters, date_from: event.target.value });
                    setPage(1);
                  }}
                />
              </Field>
              <Field label="إلى تاريخ">
                <input
                  type="date"
                  min={filters.date_from}
                  value={filters.date_to}
                  onChange={(event) => {
                    setFilters({ ...filters, date_to: event.target.value });
                    setPage(1);
                  }}
                />
              </Field>
            </>
          )}
          <button
            type="button"
            className="filters-reset-icon"
            aria-label="إعادة ضبط الفلاتر"
            title="إعادة ضبط الفلاتر"
            onClick={() => {
              setResetSpin((n) => n + 1);
              setFilters({ status: '', date_from: '', date_to: '' });
              setPage(1);
            }}
          >
            <RefreshCw
              size={16}
              aria-hidden="true"
              style={{ transform: `rotate(${resetSpin * 180}deg)` }}
            />
          </button>
        </div>
        <ResourceState
          resource={list}
          empty={!!list.result && !list.result.data.length}
          skeleton={<TableSkeleton columns={delivery ? 6 : 5} />}
        >
          <div className="panel">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>رقم الطلب</th>
                    <th>التاريخ</th>
                    <th>الحالة</th>
                    {delivery && <th>السائق</th>}
                    <th>الإجمالي</th>
                    <th>التفاصيل</th>
                  </tr>
                </thead>
                <tbody>
                  {list.result?.data.map((order) => {
                    const driverName = order.driver_id
                      ? driverNameById.get(order.driver_id)
                      : undefined;
                    return (
                      <tr
                        key={order.order_id}
                        data-selected={id === order.order_id}
                      >
                        <td>
                          <strong>
                            <bdi>#{order.order_id}</bdi>
                          </strong>
                        </td>
                        <td>{dateTime(order.created_at)}</td>
                        <td>
                          <Badge status={order.status} delivery={delivery} />
                        </td>
                        {delivery && (
                          <td>
                            {order.driver_id ? (
                              driverName ? (
                                <strong>{driverName}</strong>
                              ) : (
                                <bdi>{order.driver_id}</bdi>
                              )
                            ) : (
                              'لم يُسند'
                            )}
                          </td>
                        )}
                        <td>
                          <bdi>{money(order.total_price)}</bdi>
                        </td>
                        <td>
                          <button
                            className="button compact"
                            aria-expanded={id === order.order_id}
                            data-detail-record={order.order_id}
                            onClick={() => setId(order.order_id)}
                          >
                            عرض التفاصيل
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pager meta={list.result?.meta} change={setPage} />
          </div>
        </ResourceState>
      </section>
    </DetailWorkspace>
  );
}
export function AccountScreen({
  api,
  user,
  updated,
  onPasswordChanged,
}: {
  api: ApiClient;
  user: User;
  updated: (user: User) => void;
  onPasswordChanged?: () => void;
}) {
  const [name, setName] = useState(user.full_name),
    [phone, setPhone] = useState(user.phone),
    [current, setCurrent] = useState(''),
    [password, setPassword] = useState(''),
    [profileBusy, setProfileBusy] = useState(false),
    [passwordBusy, setPasswordBusy] = useState(false),
    [profileError, setProfileError] = useState<unknown>(null),
    [passwordError, setPasswordError] = useState<unknown>(null),
    [profileNotice, setProfileNotice] = useState('');
  useEffect(() => {
    setName(user.full_name);
    setPhone(user.phone);
  }, [user.full_name, user.phone]);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (profileBusy) return;
    setProfileBusy(true);
    setProfileError(null);
    setProfileNotice('');
    try {
      const result = await api.request<User>('/me', {
        method: 'PATCH',
        body: { full_name: name.trim(), phone: phone.trim() },
      });
      updated(result.data);
      setProfileNotice('تم حفظ بيانات الحساب.');
    } catch (cause) {
      setProfileError(cause);
    } finally {
      setProfileBusy(false);
    }
  };
  const change = async (event: FormEvent) => {
    event.preventDefault();
    if (passwordBusy) return;
    setPasswordBusy(true);
    setPasswordError(null);
    try {
      await api.request('/me/password', {
        method: 'PATCH',
        body: { current_password: current, new_password: password },
      });
      onPasswordChanged?.();
      api.clearSession();
    } catch (cause) {
      setPasswordError(cause);
    } finally {
      setPasswordBusy(false);
    }
  };
  const profileFields =
    profileError instanceof ApiError ? profileError.fields : {};
  const passwordFields =
    passwordError instanceof ApiError ? passwordError.fields : {};
  return (
    <>
      <PageTitle
        title="حسابي"
        description="بيانات تسجيل الدخول وأمان الحساب."
      />
      <section className="panel panel-pad">
        <h2>بيانات الحساب</h2>
        {!!profileError && <Failure error={profileError} />}
        {profileNotice && <Notice>{profileNotice}</Notice>}
        <form onSubmit={(event) => void save(event)}>
          <fieldset disabled={profileBusy}>
            <div className="form-grid">
              <Field
                label="الاسم الكامل"
                name="full_name"
                errors={profileFields}
              >
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  maxLength={150}
                />
              </Field>
              <Field label="رقم الهاتف" name="phone" errors={profileFields}>
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  type="tel"
                  dir="ltr"
                  pattern={'\\+[1-9][0-9]{7,14}'}
                  required
                />
              </Field>
              <Field label="البريد الإلكتروني">
                <input value={user.email} readOnly dir="ltr" />
              </Field>
            </div>
            <div className="actions">
              <button className="button primary">
                {profileBusy ? 'جار الحفظ…' : 'حفظ البيانات'}
              </button>
            </div>
          </fieldset>
        </form>
      </section>
      <section className="panel panel-pad">
        <h2>تغيير كلمة المرور</h2>
        <p className="muted">سيتم إنهاء جميع الجلسات بعد التغيير.</p>
        {!!passwordError && <Failure error={passwordError} />}
        <form onSubmit={(event) => void change(event)}>
          <fieldset disabled={passwordBusy}>
            <div className="form-grid">
              <Field
                label="كلمة المرور الحالية"
                name="current_password"
                errors={passwordFields}
              >
                <input
                  type="password"
                  value={current}
                  onChange={(event) => setCurrent(event.target.value)}
                  required
                  autoComplete="current-password"
                  maxLength={128}
                />
              </Field>
              <Field
                label="كلمة المرور الجديدة"
                name="new_password"
                errors={passwordFields}
              >
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  maxLength={128}
                  required
                  autoComplete="new-password"
                />
                <small>8 أحرف على الأقل تتضمن حرفًا ورقمًا.</small>
              </Field>
            </div>
            <div className="actions">
              <button className="button primary">
                {passwordBusy ? 'جار التغيير…' : 'تغيير كلمة المرور'}
              </button>
            </div>
          </fieldset>
        </form>
      </section>
    </>
  );
}
export function StatusLabel({ status }: { status: OrderStatus }) {
  return <Badge status={status} />;
}
