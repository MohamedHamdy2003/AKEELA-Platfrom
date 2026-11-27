import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Check, Copy, MessageCircle } from 'lucide-react';

import type { Order, Driver } from '@akeela/portal/models';
import { Confirm, Failure, Field, Loading } from '@akeela/portal/ui';
import { api } from '../lib/api';
import {
  buildDriverOrderWhatsAppMessage,
  buildDriverOrderWhatsAppUrl,
} from '../lib/whatsapp';

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
  driver: assignedDriverProp,
  refresh,
}: {
  order: Order;
  driver?: Driver;
  refresh: () => void;
}) {
  const [driver, setDriver] = useState(order.driver_id ?? ''),
    [changingDriver, setChangingDriver] = useState(false),
    [justAssigned, setJustAssigned] = useState(false),
    [assignedDriverCache, setAssignedDriverCache] = useState<Driver | null>(
      null,
    ),
    [copied, setCopied] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);

  useEffect(() => {
    setDriver(order.driver_id ?? '');
  }, [order.driver_id]);

  useEffect(() => {
    if (order.status !== 'Picked_Up') {
      setChangingDriver(false);
      setJustAssigned(false);
    }
  }, [order.status]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const showDriverForm =
    order.status === 'Accepted' ||
    (order.status === 'Picked_Up' && changingDriver);
  const drivers = useAllActiveDrivers(showDriverForm);
  const activeDrivers = drivers.data ?? [];

  const resolvedDriver =
    assignedDriverProp ??
    (assignedDriverCache?.driver_id === order.driver_id
      ? assignedDriverCache
      : undefined) ??
    activeDrivers.find((item) => item.driver_id === order.driver_id);

  const whatsappUrl = buildDriverOrderWhatsAppUrl(order, resolvedDriver);
  const whatsappText = buildDriverOrderWhatsAppMessage(order, resolvedDriver);

  const assign = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !driver) return;
    setBusy(true);
    setError(null);
    try {
      const picked = activeDrivers.find((item) => item.driver_id === driver);
      await api.request(
        '/delivery-company/orders/' + order.order_id + '/driver',
        { method: 'PUT', body: { driver_id: driver } },
      );
      if (picked) setAssignedDriverCache(picked);
      setChangingDriver(false);
      setJustAssigned(true);
      refresh();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(whatsappText);
      setCopied(true);
    } catch {
      setCopied(false);
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
  if (!['Accepted', 'Picked_Up'].includes(order.status)) {
    return null;
  }

  return (
    <section className="order-card order-action-card">
      <div className="order-card-head">
        <h3>
          {order.status === 'Accepted'
            ? 'إسناد سائق للتوصيل'
            : 'متابعة التسليم'}
        </h3>
      </div>
      {!!error && <Failure error={error} />}
      {order.status === 'Accepted' && driverForm}
      {order.status === 'Picked_Up' && (
        <div className="order-action-stack">
          {justAssigned && (
            <p className="whatsapp-ready-hint" role="status">
              تم إسناد الطلب للسائق. أرسل تفاصيل التوصيل عبر واتساب الآن.
            </p>
          )}
          <div className="whatsapp-dispatch-row">
            {whatsappUrl ? (
              <a
                className="button whatsapp full"
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle size={16} aria-hidden="true" />
                إرسال التفاصيل للسائق عبر واتساب
              </a>
            ) : (
              <button type="button" className="button whatsapp full" disabled>
                <MessageCircle size={16} aria-hidden="true" />
                رقم واتساب السائق غير متاح
              </button>
            )}
            <button
              type="button"
              className="button icon-copy-btn"
              aria-label={copied ? 'تم نسخ تفاصيل الطلب' : 'نسخ تفاصيل الطلب'}
              title={copied ? 'تم النسخ' : 'نسخ نص الرسالة'}
              onClick={() => void copyMessage()}
            >
              {copied ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                <Copy size={15} aria-hidden="true" />
              )}
            </button>
          </div>
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
        </div>
      )}
    </section>
  );
}
