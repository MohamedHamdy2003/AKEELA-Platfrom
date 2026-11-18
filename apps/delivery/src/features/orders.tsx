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
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const drivers = useResource<Driver[]>(
    api,
    order.status === 'Accepted'
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
      refresh();
    } catch (cause) {
      setError(cause);
      refresh();
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="detail-section">
      <h3>إدارة التوصيل</h3>
      {!!error && <Failure error={error} />}
      {order.status === 'Accepted' && (
        <>
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
              </fieldset>
            </form>
            <Pager meta={drivers.result?.meta} change={setPage} />
          </ResourceState>
          {order.driver_id ? (
            <Confirm
              label="تأكيد الاستلام من المطعم"
              description="تأكّد أن السائق استلم الطلب بالفعل. بعد الاستلام لن يمكن تغيير السائق."
              run={() =>
                api.request(
                  '/delivery-company/orders/' + order.order_id + '/pickup',
                  { method: 'POST' },
                )
              }
              done={refresh}
            />
          ) : (
            <p className="muted">أَسند سائقًا قبل تأكيد الاستلام.</p>
          )}
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
        </>
      )}
      {!['Accepted', 'Picked_Up'].includes(order.status) && (
        <p className="muted">لا توجد إجراءات متاحة لهذه الحالة.</p>
      )}
    </section>
  );
}
