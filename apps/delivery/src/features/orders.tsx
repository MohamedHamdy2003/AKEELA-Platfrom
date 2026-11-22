import { useCallback, useEffect, useState, type FormEvent } from 'react';

import type { Order, Driver } from '@akeela/portal/models';
import { Confirm, Failure, Field, Loading } from '@akeela/portal/ui';
import { api } from '../lib/api';

function useAllActiveDrivers(enabled: boolean) {
  const [data, setData] = useState<Driver[] | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<unknown>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((v) => v + 1), []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    (async () => {
      const items: Driver[] = [];
      let page = 1;
      let lastPage: number;
      do {
        const res = await api.request<Driver[]>(
          `/delivery-company/drivers?is_active=true&per_page=100&page=${page}`,
          { signal: controller.signal },
        );
        items.push(...res.data);
        lastPage = res.meta?.last_page ?? 1;
        page += 1;
      } while (page <= lastPage);
      if (!controller.signal.aborted) {
        setData(items);
        setLoading(false);
      }
    })().catch((cause) => {
      if (!controller.signal.aborted) {
        setError(cause);
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, [enabled, tick]);

  return { data, loading, error, reload };
}

export function DeliveryActions({
  order,
  refresh,
}: {
  order: Order;
  refresh: () => void;
}) {
  const [driver, setDriver] = useState(order.driver_id ?? ''),
    [changingDriver, setChangingDriver] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);

  useEffect(() => {
    setDriver(order.driver_id ?? '');
  }, [order.driver_id]);

  useEffect(() => {
    if (order.status !== 'Picked_Up') setChangingDriver(false);
  }, [order.status]);

  const showDriverForm =
    order.status === 'Accepted' ||
    (order.status === 'Picked_Up' && changingDriver);
  const drivers = useAllActiveDrivers(showDriverForm);
  const activeDrivers = drivers.data ?? [];

  const assign = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !driver) return;
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
    } finally {
      setBusy(false);
    }
  };
  const driverForm =
    drivers.loading && !drivers.data ? (
      <Loading />
    ) : drivers.error && !drivers.data ? (
      <Failure error={drivers.error} retry={drivers.reload} />
    ) : (
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
                !activeDrivers.some(
                  (item) => item.driver_id === order.driver_id,
                ) && (
                  <option value={order.driver_id}>
                    السائق الحالي #{order.driver_id} (غير نشط أو محذوف)
                  </option>
                )}
              {activeDrivers.map((item) => (
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
