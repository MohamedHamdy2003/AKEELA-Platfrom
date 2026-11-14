import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Check, MapPin, RefreshCw, X } from 'lucide-react';
import { api, query } from '../lib/api';
import { dateTime, money, sumMoney } from '../lib/format';
import { statuses, type Order, type OrderSummary } from '../lib/models';
import { useResource } from '../lib/use-resource';
import { Presence } from '../components/presence';
import {
  Badge,
  ButtonContent,
  Dialog,
  Empty,
  Failure,
  Field,
  Loading,
  Notice,
  PageHeading,
  Pager,
  Select,
  TableSkeleton,
} from '../components/ui';

export function OrdersTable({
  orders,
  onSelect,
}: {
  orders: OrderSummary[];
  onSelect: (id: string) => void;
}) {
  if (!orders.length) return <Empty>لا توجد طلبات بهذه الخيارات.</Empty>;
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>رقم الطلب</th>
            <th>الوقت</th>
            <th>الحالة</th>
            <th>الإجمالي</th>
            <th>التفاصيل</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
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
              <td>
                <bdi className="numeric">{money(order.total_price)}</bdi>
              </td>
              <td>
                <button
                  className="button compact secondary"
                  onClick={() => onSelect(order.order_id)}
                >
                  عرض التفاصيل
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Orders({
  initialId,
  onInitialConsumed,
}: {
  initialId?: string | null;
  onInitialConsumed: () => void;
}) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    status: '',
    date_from: '',
    date_to: '',
  });
  const [filterError, setFilterError] = useState('');
  const [selected, setSelected] = useState<string | null>(initialId ?? null);
  useEffect(() => {
    if (initialId) {
      setSelected(initialId);
      onInitialConsumed();
    }
  }, [initialId, onInitialConsumed]);
  const resource = useResource<OrderSummary[]>(
    '/restaurant/orders' + query({ page, per_page: 20, ...filters }),
  );
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = Object.fromEntries(
      new FormData(event.currentTarget),
    ) as typeof filters;
    if (form.date_from && form.date_to && form.date_from > form.date_to) {
      setFilterError('تاريخ البداية يجب أن يسبق تاريخ النهاية.');
      return;
    }
    setFilterError('');
    setPage(1);
    setFilters(form);
  }
  return (
    <>
      <PageHeading
        title="الطلبات"
        subtitle="تابع الطلبات وتفاصيلها، خطوة بخطوة."
        action={
          <button className="button secondary" onClick={resource.reload}>
            <RefreshCw
              size={18}
              className={resource.loading ? 'spin' : undefined}
            />
            تحديث
          </button>
        }
      />
      <form className="filter-bar" onSubmit={filter}>
        <Select label="الحالة" name="status">
          <option value="">كل الحالات</option>
          {Object.entries(statuses).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Field label="من تاريخ" name="date_from" type="date" />
        <Field label="إلى تاريخ" name="date_to" type="date" />
        <button className="button primary">تطبيق الفلاتر</button>
      </form>
      {filterError && <Notice error={new Error(filterError)} />}
      <div className="panel table-panel">
        {resource.loading ? (
          <TableSkeleton />
        ) : resource.error ? (
          <Failure error={resource.error} retry={resource.reload} />
        ) : (
          <OrdersTable
            orders={resource.result?.data ?? []}
            onSelect={setSelected}
          />
        )}
      </div>
      <Pager meta={resource.result?.meta} onPage={setPage} />
      <Presence>
        {selected && (
          <OrderDetails
            id={selected}
            onClose={() => setSelected(null)}
            onChanged={resource.reload}
          />
        )}
      </Presence>
    </>
  );
}
export function OrderDetails({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const resource = useResource<Order>('/restaurant/orders/' + id);
  const [decision, setDecision] = useState<'accept' | 'reject' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  const order = resource.result?.data;
  async function act() {
    if (!decision || busy) return;
    setBusy(true);
    setError(null);
    setMessage('');
    try {
      await api.request('/restaurant/orders/' + id + '/' + decision, {
        method: 'POST',
      });
      setMessage(
        decision === 'accept'
          ? 'تم قبول الطلب وإسناده لشركة التوصيل.'
          : 'تم رفض الطلب.',
      );
    } catch (cause) {
      setError(cause);
    } finally {
      setDecision(null);
      setBusy(false);
      resource.reload();
      onChanged();
    }
  }
  return (
    <Dialog
      title={'الطلب #' + id}
      onClose={() => {
        if (!busy) onClose();
      }}
      drawer
    >
      <Notice error={error} />
      <Notice>{message}</Notice>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <Failure error={resource.error} retry={resource.reload} />
      ) : (
        order && (
          <>
            <Badge status={order.status} />
            <p className="muted">{dateTime(order.created_at)}</p>
            <section className="detail-section">
              <h3>تفاصيل الطلب</h3>
              {order.items.map((item) => (
                <div className="order-item" key={item.order_item_id}>
                  <div>
                    <strong>{item.item_name}</strong>
                    <span>× {item.quantity}</span>
                    <bdi>{money(item.subtotal)}</bdi>
                  </div>
                  <small>
                    سعر الوحدة: <bdi>{money(item.unit_price)}</bdi>
                  </small>
                  {item.addons.map((addon) => (
                    <div className="addon-line" key={addon.order_item_addon_id}>
                      <span>
                        {addon.addon_name} × {addon.quantity}
                      </span>
                      <bdi>{money(addon.subtotal)}</bdi>
                    </div>
                  ))}
                </div>
              ))}
            </section>
            <section className="detail-section">
              <h3>
                <MapPin size={19} />
                عنوان التوصيل
              </h3>
              <p>{order.customer_address}</p>
            </section>
            {order.notes && (
              <section className="detail-section">
                <h3>ملاحظات</h3>
                <p>{order.notes}</p>
              </section>
            )}
            <div className="totals">
              <div>
                <span>المنتجات والإضافات</span>
                <bdi>
                  {money(
                    sumMoney(
                      order.items.flatMap((item) => [
                        item.subtotal,
                        ...item.addons.map((addon) => addon.subtotal),
                      ]),
                    ),
                  )}
                </bdi>
              </div>
              <div>
                <span>التوصيل</span>
                <bdi>{money(order.delivery_fee)}</bdi>
              </div>
              <div className="grand-total">
                <strong>الإجمالي</strong>
                <strong>
                  <bdi>{money(order.total_price)}</bdi>
                </strong>
              </div>
            </div>
            {order.status === 'Pending' && !decision && (
              <div className="actions">
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => setDecision('accept')}
                >
                  <Check size={18} />
                  قبول الطلب
                </button>
                <button
                  className="button danger-outline"
                  disabled={busy}
                  onClick={() => setDecision('reject')}
                >
                  <X size={18} />
                  رفض الطلب
                </button>
              </div>
            )}
            {decision && (
              <div className="confirm-box" role="alert">
                <h3>
                  {decision === 'accept'
                    ? 'تأكيد قبول الطلب؟'
                    : 'تأكيد رفض الطلب؟'}
                </h3>
                <p>
                  {decision === 'accept'
                    ? 'سيُسند الطلب تلقائيًا إلى شركة التوصيل.'
                    : 'الرفض نهائي ولا يمكن التراجع عنه.'}
                </p>
                <div className="actions">
                  <button
                    className={
                      'button ' + (decision === 'accept' ? 'primary' : 'danger')
                    }
                    disabled={busy}
                    onClick={act}
                  >
                    <ButtonContent busy={busy}>تأكيد</ButtonContent>
                  </button>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => setDecision(null)}
                  >
                    رجوع
                  </button>
                </div>
              </div>
            )}
            {order.status !== 'Pending' && (
              <p className="muted">تظهر تحديثات التوصيل هنا عند تحديث الطلب.</p>
            )}
            <button
              className="text-button"
              disabled={busy}
              onClick={resource.reload}
            >
              تحديث حالة الطلب <ArrowLeft size={16} />
            </button>
          </>
        )
      )}
    </Dialog>
  );
}
