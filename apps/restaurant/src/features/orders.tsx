import { useEffect, useState, type FormEvent } from 'react';
import { Check, MapPin, X } from 'lucide-react';
import { ArabicDateFields } from '@akeela/portal/arabic-date-fields';
import { api, query } from '../lib/api';
import { dateTime, money, sumMoney } from '../lib/format';
import {
  statuses,
  statusDescriptions,
  type Order,
  type OrderSummary,
} from '../lib/models';
import { useResource } from '../lib/use-resource';
import { Presence } from '../components/presence';
import {
  Badge,
  ButtonContent,
  Dialog,
  Empty,
  Failure,
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
  initialStatus,
  onInitialStatusConsumed,
}: {
  initialId?: string | null;
  onInitialConsumed: () => void;
  initialStatus?: string;
  onInitialStatusConsumed?: () => void;
}) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    status: initialStatus ?? '',
    date_from: '',
    date_to: '',
  });
  const [draft, setDraft] = useState({
    status: initialStatus ?? '',
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
  useEffect(() => {
    if (initialStatus) {
      setFilters((current) => ({ ...current, status: initialStatus }));
      setDraft((current) => ({ ...current, status: initialStatus }));
      setPage(1);
      onInitialStatusConsumed?.();
    }
  }, [initialStatus, onInitialStatusConsumed]);
  const resource = useResource<OrderSummary[]>(
    '/restaurant/orders' + query({ page, per_page: 20, ...filters }),
  );
  useEffect(() => {
    const last = resource.result?.meta?.last_page;
    if (last && page > last) setPage(Math.max(1, last));
  }, [resource.result?.meta?.last_page, page]);
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.date_from && draft.date_to && draft.date_from > draft.date_to) {
      setFilterError('تاريخ البداية يجب أن يسبق تاريخ النهاية.');
      return;
    }
    setFilterError('');
    setPage(1);
    setFilters(draft);
  }
  const hasFilters = Boolean(
    filters.status ||
    filters.date_from ||
    filters.date_to ||
    draft.status ||
    draft.date_from ||
    draft.date_to,
  );
  return (
    <>
      <PageHeading
        title="الطلبات"
        subtitle="تابع الطلبات وتفاصيلها، خطوة بخطوة."
      />
      <form className="filter-bar" onSubmit={filter}>
        <Select
          label="الحالة"
          name="status"
          value={draft.status}
          onChange={(event) =>
            setDraft((current) => ({ ...current, status: event.target.value }))
          }
        >
          <option value="">كل الحالات</option>
          {Object.entries(statuses).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <ArabicDateFields
          value={{ date_from: draft.date_from, date_to: draft.date_to }}
          change={(dates) => setDraft((current) => ({ ...current, ...dates }))}
        />
        <div className="filter-bar-actions">
          <button className="button primary">تطبيق الفلاتر</button>
          {hasFilters && (
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                const empty = { status: '', date_from: '', date_to: '' };
                setDraft(empty);
                setFilters(empty);
                setFilterError('');
                setPage(1);
              }}
            >
              إعادة ضبط الفلاتر
            </button>
          )}
        </div>
      </form>
      {filterError && <Notice error={new Error(filterError)} />}
      <div className="panel table-panel">
        {!resource.result && resource.loading ? (
          <TableSkeleton />
        ) : !resource.result && resource.error ? (
          <Failure error={resource.error} retry={resource.reload} />
        ) : (
          <>
            {Boolean(resource.error) && <Notice error={resource.error} />}
            <OrdersTable
              orders={resource.result?.data ?? []}
              onSelect={setSelected}
            />
          </>
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
      {!order && resource.loading ? (
        <Loading />
      ) : !order && resource.error ? (
        <Failure error={resource.error} retry={resource.reload} />
      ) : (
        order && (
          <>
            <Badge status={order.status} />
            <p className="muted">{statusDescriptions[order.status]}</p>
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
              <p className="muted">تظهر تحديثات الطلب لحظيًا فور حدوثها.</p>
            )}
          </>
        )
      )}
    </Dialog>
  );
}
