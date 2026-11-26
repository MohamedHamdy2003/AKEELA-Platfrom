import { useEffect, useState } from 'react';
import {
  Check,
  Clock,
  MapPin,
  MessageSquareText,
  RefreshCw,
  ShoppingBag,
  X,
} from 'lucide-react';
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
  const [selected, setSelected] = useState<string | null>(initialId ?? null);
  const [resetSpin, setResetSpin] = useState(0);
  useEffect(() => {
    if (initialId) {
      setSelected(initialId);
      onInitialConsumed();
    }
  }, [initialId, onInitialConsumed]);
  useEffect(() => {
    if (initialStatus) {
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
  const resource = useResource<OrderSummary[]>(
    '/restaurant/orders' + query({ page, per_page: 20, ...requestFilters }),
  );
  useEffect(() => {
    const last = resource.result?.meta?.last_page;
    if (last && page > last) setPage(Math.max(1, last));
  }, [resource.result?.meta?.last_page, page]);
  return (
    <>
      <PageHeading
        title="الطلبات"
        subtitle="تابع الطلبات وتفاصيلها، خطوة بخطوة."
      />
      <div className="filter-bar">
        <Select
          label="الحالة"
          name="status"
          value={filters.status}
          onChange={(event) => {
            setFilters((current) => ({
              ...current,
              status: event.target.value,
            }));
            setPage(1);
          }}
        >
          <option value="">كل الحالات</option>
          {Object.entries(statuses).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <ArabicDateFields
          key={resetSpin}
          value={{ date_from: filters.date_from, date_to: filters.date_to }}
          change={(dates) => {
            setFilters((current) => ({ ...current, ...dates }));
            setPage(1);
          }}
        />
        <div className="filter-bar-actions">
          <button
            type="button"
            className="filters-reset-icon"
            aria-label="إعادة ضبط الفلاتر"
            title="إعادة ضبط الفلاتر"
            onClick={() => {
              setResetSpin((n) => n + 1);
              const empty = { status: '', date_from: '', date_to: '' };
              setFilters(empty);
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
      </div>
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
          <div className="order-drawer-stack">
            <section className="order-summary-card">
              <div className="order-summary-top">
                <Badge status={order.status} />
                <span className="order-summary-time">
                  <Clock size={14} aria-hidden="true" />
                  {dateTime(order.created_at)}
                </span>
              </div>
              <p className="order-summary-desc">
                {statusDescriptions[order.status]}
              </p>
            </section>

            {order.notes && (
              <section className="order-notes-card">
                <MessageSquareText size={18} aria-hidden="true" />
                <div>
                  <h3>ملاحظات العميل</h3>
                  <p>{order.notes}</p>
                </div>
              </section>
            )}

            <section className="order-card order-items-card">
              <div className="order-card-head">
                <h3>
                  <ShoppingBag size={17} aria-hidden="true" />
                  الأصناف المطلوبة
                </h3>
                <span className="order-count-pill">
                  {(() => {
                    const total = order.items.reduce(
                      (sum, item) => sum + item.quantity,
                      0,
                    );
                    if (total === 1) return 'صنف واحد';
                    if (total === 2) return 'صنفان';
                    return `${total.toLocaleString('ar-EG')} أصناف`;
                  })()}
                </span>
              </div>

              <div className="order-items-list">
                {order.items.map((item) => (
                  <div className="order-item" key={item.order_item_id}>
                    <div className="order-item-row">
                      <div className="order-item-info">
                        <span className="order-qty-pill">×{item.quantity}</span>
                        <div>
                          <strong>{item.item_name}</strong>
                          <small>
                            سعر الوحدة: <bdi>{money(item.unit_price)}</bdi>
                          </small>
                        </div>
                      </div>
                      <bdi className="order-item-subtotal">
                        {money(item.subtotal)}
                      </bdi>
                    </div>
                    {item.addons.length > 0 && (
                      <div className="order-addons-list">
                        {item.addons.map((addon) => (
                          <div
                            className="addon-line"
                            key={addon.order_item_addon_id}
                          >
                            <span>
                              + {addon.addon_name} × {addon.quantity}
                            </span>
                            <bdi>{money(addon.subtotal)}</bdi>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="order-card order-address-card">
              <div className="order-address-icon" aria-hidden="true">
                <MapPin size={17} />
              </div>
              <div>
                <h3>عنوان التوصيل</h3>
                <p>{order.customer_address}</p>
              </div>
            </section>

            <section className="totals">
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
                <span>رسوم التوصيل</span>
                <bdi>{money(order.delivery_fee)}</bdi>
              </div>
              <div className="grand-total">
                <strong>الإجمالي</strong>
                <strong>
                  <bdi>{money(order.total_price)}</bdi>
                </strong>
              </div>
            </section>

            {order.status === 'Pending' && !decision && (
              <div className="actions order-drawer-actions">
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
              <div className="order-live-pill">
                <i aria-hidden="true" />
                <span>تظهر تحديثات الطلب لحظيًا فور حدوثها.</span>
              </div>
            )}
          </div>
        )
      )}
    </Dialog>
  );
}
