import { useState, type FormEvent, type ReactNode } from 'react';
import { Clock, Truck, CheckCircle } from 'lucide-react';
import { ApiClient, ApiError, query } from './api';
import {
  statuses,
  type Order,
  type OrderStatus,
  type OrderSummary,
  type User,
} from './models';
import {
  Badge,
  dateTime,
  Failure,
  Field,
  Metrics,
  money,
  Notice,
  OrderFacts,
  Pager,
  PageTitle,
  RefreshCw,
  ResourceState,
  useResource,
  X,
} from './ui';
export type OrderDateFilters = { date_from: string; date_to: string };
export function OrdersBoard({
  api,
  prefix,
  revision,
  delivery = false,
  actions,
  dateFields,
}: {
  api: ApiClient;
  prefix: string;
  revision: number;
  delivery?: boolean;
  actions: (order: Order, refresh: () => void) => ReactNode;
  dateFields?: (
    value: OrderDateFilters,
    change: (value: OrderDateFilters) => void,
  ) => ReactNode;
}) {
  const [page, setPage] = useState(1),
    [filters, setFilters] = useState({
      status: '',
      date_from: '',
      date_to: '',
    }),
    [id, setId] = useState<string | null>(null),
    [tick, setTick] = useState(0);
  const list = useResource<OrderSummary[]>(
    api,
    prefix + '/orders' + query({ page, per_page: 10, ...filters }),
    revision + tick,
  );
  const detail = useResource<Order>(
    api,
    id ? prefix + '/orders/' + id : null,
    revision + tick,
  );
  const a = useResource<OrderSummary[]>(
      api,
      prefix +
        '/orders?per_page=1&status=' +
        (delivery ? 'Accepted' : 'Pending'),
      revision + tick,
    ),
    b = useResource<OrderSummary[]>(
      api,
      prefix + '/orders?per_page=1&status=Picked_Up',
      revision + tick,
    ),
    c = useResource<unknown[]>(
      api,
      delivery
        ? '/delivery-company/drivers?per_page=1&is_active=true'
        : prefix + '/orders?per_page=1&status=Accepted',
      revision + tick,
    );
  const refresh = () => setTick((value) => value + 1);
  return (
    <div className={id ? 'workspace-columns' : ''}>
      <section>
        <PageTitle
          title={delivery ? 'طلبات الشركة' : 'إدارة الطلبات'}
          description={
            delivery
              ? 'عرض وإدارة الطلبات المسندة إلى شركتك فقط.'
              : 'متابعة طلبات المنصة حسب الحالة والفترة الزمنية.'
          }
          action={
            <button className="button primary" onClick={refresh}>
              <RefreshCw size={15} />
              تحديث البيانات
            </button>
          }
        />
        <Metrics
          items={[
            {
              label: delivery ? 'الطلبات المقبولة' : 'الطلبات المعلقة',
              value: a.result?.meta?.total ?? null,
              icon: <Clock size={23} />,
            },
            {
              label: 'قيد التوصيل',
              value: b.result?.meta?.total ?? null,
              icon: <Truck size={23} />,
            },
            {
              label: delivery ? 'السائقون النشطون' : 'الطلبات المقبولة',
              value: c.result?.meta?.total ?? null,
              icon: <CheckCircle size={23} />,
            },
          ]}
        />
        <div className="filters">
          <Field label="حالة الطلب">
            <select
              value={filters.status}
              onChange={(event) => {
                setFilters({ ...filters, status: event.target.value });
                setPage(1);
              }}
            >
              <option value="">جميع الحالات</option>
              {Object.entries(statuses).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          {dateFields ? (
            dateFields(
              { date_from: filters.date_from, date_to: filters.date_to },
              (dates) => {
                setFilters((current) => ({ ...current, ...dates }));
                setPage(1);
              },
            )
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
        </div>
        <ResourceState
          resource={list}
          empty={!!list.result && !list.result.data.length}
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
                  {list.result?.data.map((order) => (
                    <tr key={order.order_id}>
                      <td>
                        <strong>
                          <bdi>#{order.order_id}</bdi>
                        </strong>
                      </td>
                      <td>{dateTime(order.created_at)}</td>
                      <td>
                        <Badge status={order.status} />
                      </td>
                      {delivery && (
                        <td>
                          <bdi>
                            {order.driver_id
                              ? '#' + order.driver_id
                              : 'لم يُسند'}
                          </bdi>
                        </td>
                      )}
                      <td>
                        <bdi>{money(order.total_price)}</bdi>
                      </td>
                      <td>
                        <button
                          className="button compact"
                          onClick={() => setId(order.order_id)}
                        >
                          عرض التفاصيل
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager meta={list.result?.meta} change={setPage} />
          </div>
        </ResourceState>
      </section>
      {id && (
        <aside className="detail-panel" aria-label="تفاصيل الطلب">
          <header className="detail-head">
            <h2>تفاصيل الطلب</h2>
            <button aria-label="إغلاق تفاصيل الطلب" onClick={() => setId(null)}>
              <X size={18} />
            </button>
          </header>
          <ResourceState resource={detail}>
            {detail.result && (
              <>
                <OrderFacts
                  order={detail.result.data}
                  actions={actions(detail.result.data, refresh)}
                />
              </>
            )}
          </ResourceState>
        </aside>
      )}
    </div>
  );
}
export function AccountScreen({
  api,
  user,
  updated,
}: {
  api: ApiClient;
  user: User;
  updated: (user: User) => void;
}) {
  const [name, setName] = useState(user.full_name),
    [phone, setPhone] = useState(user.phone),
    [current, setCurrent] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [notice, setNotice] = useState('');
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      const result = await api.request<User>('/me', {
        method: 'PATCH',
        body: { full_name: name, phone },
      });
      updated(result.data);
      setNotice('تم حفظ بيانات الحساب.');
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };
  const change = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.request('/me/password', {
        method: 'PATCH',
        body: { current_password: current, new_password: password },
      });
      api.clearSession();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };
  const fields = error instanceof ApiError ? error.fields : {};
  return (
    <>
      <PageTitle
        title="حسابي"
        description="بيانات تسجيل الدخول وأمان الحساب."
      />
      {!!error && <Failure error={error} />}
      {notice && <Notice>{notice}</Notice>}
      <section className="panel panel-pad">
        <h2>بيانات الحساب</h2>
        <form onSubmit={(event) => void save(event)}>
          <fieldset disabled={busy}>
            <div className="form-grid">
              <Field label="الاسم الكامل" name="full_name" errors={fields}>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  maxLength={150}
                />
              </Field>
              <Field label="رقم الهاتف" name="phone" errors={fields}>
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
                {busy ? 'جار الحفظ…' : 'حفظ البيانات'}
              </button>
            </div>
          </fieldset>
        </form>
      </section>
      <section className="panel panel-pad">
        <h2>تغيير كلمة المرور</h2>
        <p className="muted">سيتم إنهاء جميع الجلسات بعد التغيير.</p>
        <form onSubmit={(event) => void change(event)}>
          <fieldset disabled={busy}>
            <div className="form-grid">
              <Field
                label="كلمة المرور الحالية"
                name="current_password"
                errors={fields}
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
                errors={fields}
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
              <button className="button primary">تغيير كلمة المرور</button>
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
