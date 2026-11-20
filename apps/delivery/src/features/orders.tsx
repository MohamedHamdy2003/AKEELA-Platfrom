import { useState, type FormEvent } from 'react';

import type { Order, Driver } from '@akeela/portal/models';
import {
  Confirm,
  Failure,
  Field,
  Pager,
  ResourceState,
  useResource,
} from '@akeela/portal/ui';
import { api } from '../lib/api';
export function DeliveryActions({
  order,
  refresh,
}: {
  order: Order;
  refresh: () => void;
}) {
  const [page, setPage] = useState(1),
    [driver, setDriver] = useState(order.driver_id ?? ''),
    [changingDriver, setChangingDriver] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const showDriverForm =
    order.status === 'Accepted' ||
    (order.status === 'Picked_Up' && changingDriver);
  const drivers = useResource<Driver[]>(
    api,
    showDriverForm
      ? '/delivery-company/drivers?is_active=true&per_page=20&page=' + page
      : null,
  );
  const assign = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.request(
        '/delivery-company/orders/' + order.order_id + '/driver',
        { method: 'PUT', body: { driver_id: driver } },
      );
      setChangingDriver(false);
      refresh();
    } catch (cause) {
      setError(cause);
      refresh();
    } finally {
      setBusy(false);
    }
  };
  const driverForm = (
    <ResourceState resource={drivers}>
      <form onSubmit={(event) => void assign(event)}>
        <fieldset disabled={busy}>
          <Field label="السائق">
            <select
              value={driver}
              onChange={(event) => setDriver(event.target.value)}
              required
            >
              <option value="">اختر سائقًا نشطًا</option>
              {order.driver_id &&
                !drivers.result?.data.some(
                  (item) => item.driver_id === order.driver_id,
                ) && (
                  <option value={order.driver_id}>
                    السائق الحالي #{order.driver_id} (راجع نشاطه)
                  </option>
                )}
              {drivers.result?.data.map((item) => (
                <option key={item.driver_id} value={item.driver_id}>
                  {item.driver_name} · {item.driver_phone}
                </option>
              ))}
            </select>
          </Field>
          <div className="driver-form-actions">
            <button
              className="button primary full"
              disabled={!driver || driver === order.driver_id}
            >
              {busy
                ? 'جار الإسناد…'
                : order.driver_id
                  ? 'تغيير السائق'
                  : 'إسناد السائق'}
            </button>
            {changingDriver && (
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() => {
                  setChangingDriver(false);
                  setDriver(order.driver_id ?? '');
                }}
              >
                إلغاء
              </button>
            )}
          </div>
        </fieldset>
      </form>
      <Pager meta={drivers.result?.meta} change={setPage} />
    </ResourceState>
  );
  return (
    <section className="detail-section">
      <h3>إدارة التوصيل</h3>
      {!!error && <Failure error={error} />}
      {order.status === 'Accepted' && (
        <>
          {driverForm}
          <p className="muted">أَسند سائقًا للطلب لبدء التوصيل.</p>
        </>
      )}
      {order.status === 'Picked_Up' && (
        <>
          <p>
            السائق: <bdi>#{order.driver_id}</bdi>
          </p>
          <Confirm
            label="تأكيد تسليم الطلب"
            description="تأكّد أن الطلب تم تسليمه للعميل. هذا الإجراء ينهي الطلب."
            run={() =>
              api.request(
                '/delivery-company/orders/' + order.order_id + '/deliver',
                { method: 'POST' },
              )
            }
            done={refresh}
          />
          <div className="driver-reassign-wrap">
            {changingDriver ? (
              driverForm
            ) : (
              <button
                type="button"
                className="button full"
                onClick={() => {
                  setError(null);
                  setChangingDriver(true);
                }}
              >
                تغيير السائق
              </button>
            )}
          </div>
        </>
      )}
      {!['Accepted', 'Picked_Up'].includes(order.status) && (
        <p className="muted">لا توجد إجراءات متاحة لهذه الحالة.</p>
      )}
    </section>
  );
}
