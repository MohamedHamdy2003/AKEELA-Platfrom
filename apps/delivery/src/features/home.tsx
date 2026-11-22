import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Building2,
  CheckCircle2,
  Clock,
  MapPin,
  PackageCheck,
  Phone,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Store,
  Timer,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import type {
  AnalyticsRange,
  Company,
  DeliveryAnalytics,
} from '@akeela/portal/models';
import { Failure, dateTime, money, useResource } from '@akeela/portal/ui';
import { api } from '../lib/api';
import {
  DeliveryPeakHoursChart,
  DeliveryStatusDonut,
  DeliveryTrendChart,
} from './analytics-charts';
import './home.css';

const RANGE_OPTIONS: Array<{ key: AnalyticsRange; label: string }> = [
  { key: 'today', label: 'اليوم' },
  { key: '7d', label: '7 أيام' },
  { key: '30d', label: '30 يوماً' },
  { key: '90d', label: '90 يوماً' },
  { key: 'all', label: 'الكل' },
];

function DeltaBadge({
  current,
  previous,
  lowerIsBetter = false,
}: {
  current: number | null;
  previous: number | null;
  lowerIsBetter?: boolean;
}) {
  if (current === null || previous === null) return null;
  if (previous === 0) {
    if (current === 0) {
      return <span className="del-delta is-flat numeric">0%</span>;
    }
    return (
      <span className={'del-delta ' + (lowerIsBetter ? 'is-bad' : 'is-good')}>
        جديد
      </span>
    );
  }
  const pct = Math.round(((current - previous) / previous) * 1000) / 10;
  if (pct === 0) {
    return <span className="del-delta is-flat numeric">0%</span>;
  }
  const up = pct > 0;
  const good = lowerIsBetter ? !up : up;
  return (
    <span className={'del-delta numeric ' + (good ? 'is-good' : 'is-bad')}>
      {up ? (
        <TrendingUp size={12} aria-hidden="true" />
      ) : (
        <TrendingDown size={12} aria-hidden="true" />
      )}
      <bdi>{`${up ? '+' : ''}${pct}%`}</bdi>
    </span>
  );
}

function DeliveryAnalyticsSkeleton() {
  return (
    <div
      className="del-home"
      aria-label="جارٍ تحميل تحليلات التوصيل"
      aria-busy="true"
      role="status"
    >
      <div className="del-sk-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="del-sk-card" />
        ))}
      </div>
      <div className="del-grid-primary">
        <div className="del-sk-chart" />
        <div className="del-sk-chart" />
      </div>
    </div>
  );
}

export function Home({
  revision,
  navigate,
  company,
}: {
  revision: number;
  navigate: (key: string) => void;
  company?: Partial<Company> | null;
}) {
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const [driverTab, setDriverTab] = useState<'delivered' | 'load'>('delivered');
  const analytics = useResource<DeliveryAnalytics>(
    api,
    `/delivery-company/analytics?range=${range}`,
    revision,
  );
  const [cached, setCached] = useState<DeliveryAnalytics | null>(null);

  useEffect(() => {
    if (analytics.result?.data) {
      setCached(analytics.result.data);
    }
  }, [analytics.result]);

  const data = analytics.result?.data ?? cached;
  const kpis = data?.kpis;
  const prev = data?.previous_kpis ?? null;
  const queue = data?.live_queue;
  const fleet = data?.fleet;

  const hasLiveItems =
    queue &&
    queue.stale_unassigned +
      queue.long_in_transit +
      queue.inactive_driver_orders +
      queue.unassigned_accepted +
      queue.in_transit >
      0;

  const sortedDrivers = useMemo(() => {
    const list = data?.driver_leaderboard ?? [];
    if (driverTab === 'load') {
      return [...list].sort(
        (a, b) =>
          b.current_load - a.current_load ||
          Number(b.is_active) - Number(a.is_active) ||
          b.delivered_orders - a.delivered_orders,
      );
    }
    return list;
  }, [data?.driver_leaderboard, driverTab]);

  const maxRestOrders = Math.max(
    1,
    ...(data?.top_pickup_restaurants ?? []).map((r) => r.assigned_orders),
  );
  const busyPct =
    fleet && fleet.active_drivers > 0
      ? Math.min(
          100,
          Math.round(
            ((fleet.active_drivers - fleet.idle_active_drivers) /
              fleet.active_drivers) *
              100,
          ),
        )
      : 0;

  const companyName =
    typeof company?.company_name === 'string' && company.company_name.trim()
      ? company.company_name.trim()
      : 'إدارة التوصيل';
  const isLatinCompany =
    /[A-Za-z]/.test(companyName) && !/[\u0600-\u06FF]/.test(companyName);

  return (
    <div
      className="del-home"
      data-refreshing={analytics.loading && Boolean(data)}
    >
      <header
        className="del-home-head"
        aria-label="هوية شركة التوصيل والفترة الزمنية"
      >
        <div className="del-home-title-wrap">
          <div className="del-hero-titles">
            <h1 className="del-hero-title">نظرة عامة</h1>
            <span
              className={
                'del-hero-company' + (isLatinCompany ? ' is-latin' : '')
              }
            >
              <bdi>{companyName}</bdi>
            </span>
          </div>
          <p className="del-hero-desc">
            مركز عمليات التوزيع والأسطول ومؤشرات كفاءة التسليم بتوقيت القاهرة.
          </p>
        </div>

        <div className="del-home-controls">
          <div
            className="del-seg"
            role="group"
            aria-label="الفترة الزمنية لتحليلات التوصيل"
          >
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={range === option.key ? 'active' : ''}
                aria-pressed={range === option.key}
                onClick={() => setRange(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={
              'del-refresh-btn' + (analytics.loading ? ' spinning' : '')
            }
            aria-label="تحديث التحليلات"
            title={
              data
                ? `آخر تحديث: ${dateTime(data.generated_at)}`
                : 'تحديث التحليلات'
            }
            onClick={analytics.reload}
            disabled={analytics.loading}
          >
            <RefreshCw size={16} aria-hidden="true" />
          </button>
        </div>
      </header>

      {(company?.company_id ||
        company?.company_address ||
        company?.company_phone) && (
        <section
          className="del-partner-strip"
          aria-label="بيانات شركة التوصيل الحالية"
        >
          <div className="del-partner-strip-meta">
            {company?.company_id && (
              <span className="del-partner-id numeric">
                <Building2 size={14} aria-hidden="true" />
                معرّف الشركة #{company.company_id}
              </span>
            )}
            {company?.company_address && (
              <span>
                <MapPin size={14} aria-hidden="true" />
                {company.company_address}
              </span>
            )}
            {company?.company_phone && (
              <span className="numeric">
                <Phone size={14} aria-hidden="true" />
                <bdi>{company.company_phone}</bdi>
              </span>
            )}
          </div>
          <button
            type="button"
            className="del-partner-strip-link"
            onClick={() => navigate('profile')}
          >
            إدارة بيانات الشركة
          </button>
        </section>
      )}

      {Boolean(analytics.error) && (
        <Failure error={analytics.error} retry={analytics.reload} />
      )}

      {!data && analytics.loading && <DeliveryAnalyticsSkeleton />}

      {data && kpis && queue && fleet && (
        <>
          <section className="del-radar" aria-label="رادار التوزيع اللحظي">
            {hasLiveItems ? (
              <>
                {queue.stale_unassigned > 0 && (
                  <button
                    type="button"
                    className="del-radar-pill is-danger"
                    onClick={() => navigate('orders')}
                  >
                    <AlertTriangle size={15} aria-hidden="true" />
                    <span className="numeric">
                      {queue.stale_unassigned} طلب بانتظار سائق لأكثر من 15
                      دقيقة
                    </span>
                  </button>
                )}
                {queue.long_in_transit > 0 && (
                  <button
                    type="button"
                    className="del-radar-pill is-warning"
                    onClick={() => navigate('orders')}
                  >
                    <Clock size={15} aria-hidden="true" />
                    <span className="numeric">
                      {queue.long_in_transit} طلب قيد التوصيل لأكثر من 60 دقيقة
                    </span>
                  </button>
                )}
                {queue.inactive_driver_orders > 0 && (
                  <button
                    type="button"
                    className="del-radar-pill is-danger"
                    onClick={() => navigate('orders')}
                  >
                    <ShieldAlert size={15} aria-hidden="true" />
                    <span className="numeric">
                      {queue.inactive_driver_orders} طلب مسنَد لسائق متوقف
                    </span>
                  </button>
                )}
                {queue.unassigned_accepted > 0 && (
                  <button
                    type="button"
                    className="del-radar-pill is-teal"
                    onClick={() => navigate('orders')}
                  >
                    <Truck size={15} aria-hidden="true" />
                    <span className="numeric">
                      {queue.unassigned_accepted} طلب جاهز لإسناد سائق الآن
                    </span>
                  </button>
                )}
                {queue.in_transit > 0 && (
                  <button
                    type="button"
                    className="del-radar-pill is-blue"
                    onClick={() => navigate('orders')}
                  >
                    <PackageCheck size={15} aria-hidden="true" />
                    <span className="numeric">
                      {queue.in_transit} طلب قيد التوصيل حالياً
                    </span>
                  </button>
                )}
              </>
            ) : (
              <div className="del-radar-pill is-ok" role="status">
                <CheckCircle2 size={15} aria-hidden="true" />
                <span>
                  قائمة التوزيع صافية — لا توجد طلبات متأخرة أو اختناقات تشغيلية
                  الآن.
                </span>
              </div>
            )}
          </section>

          <section
            className="del-kpi-grid"
            aria-label="مؤشرات أداء شركة التوصيل"
          >
            <article className="del-kpi">
              <div className="del-kpi-top">
                <span className="del-kpi-label">
                  <span className="del-kpi-ico is-teal" aria-hidden="true">
                    <Banknote size={17} />
                  </span>
                  إيرادات رسوم التوصيل
                </span>
                <DeltaBadge
                  current={Number(kpis.delivery_fees_earned)}
                  previous={prev ? Number(prev.delivery_fees_earned) : null}
                />
              </div>
              <div className="del-kpi-val numeric">
                <bdi>{money(kpis.delivery_fees_earned)}</bdi>
              </div>
              <div className="del-kpi-foot numeric">
                <span>
                  متوسط رسوم الرحلة: <bdi>{money(kpis.avg_delivery_fee)}</bdi>
                </span>
              </div>
            </article>

            <button
              type="button"
              className="del-kpi"
              onClick={() => navigate('orders')}
            >
              <div className="del-kpi-top">
                <span className="del-kpi-label">
                  <span className="del-kpi-ico is-emerald" aria-hidden="true">
                    <PackageCheck size={17} />
                  </span>
                  الطلبات المُسلّمة
                </span>
                <DeltaBadge
                  current={kpis.delivered_orders}
                  previous={prev ? prev.delivered_orders : null}
                />
              </div>
              <div className="del-kpi-val numeric">{kpis.delivered_orders}</div>
              <div className="del-kpi-foot numeric">
                <span>
                  من أصل {kpis.assigned_orders} طلب مسنَد · عرض الطلبات ←
                </span>
              </div>
            </button>

            <article className="del-kpi">
              <div className="del-kpi-top">
                <span className="del-kpi-label">
                  <span className="del-kpi-ico is-cyan" aria-hidden="true">
                    <Timer size={17} />
                  </span>
                  متوسط زمن التوصيل
                </span>
                <DeltaBadge
                  current={kpis.avg_fulfillment_minutes}
                  previous={prev ? prev.avg_fulfillment_minutes : null}
                  lowerIsBetter
                />
              </div>
              <div className="del-kpi-val numeric">
                {kpis.avg_fulfillment_minutes !== null ? (
                  <bdi>{kpis.avg_fulfillment_minutes} دقيقة</bdi>
                ) : (
                  '—'
                )}
              </div>
              <div className="del-kpi-foot">
                <span>من إنشاء الطلب حتى تأكيد التسليم</span>
              </div>
            </article>

            <article className="del-kpi">
              <div className="del-kpi-top">
                <span className="del-kpi-label">
                  <span className="del-kpi-ico is-emerald" aria-hidden="true">
                    <ShieldCheck size={17} />
                  </span>
                  نسبة نجاح التسليم (SLA)
                </span>
              </div>
              <div className="del-kpi-val numeric">
                <bdi>{kpis.delivery_success_rate}%</bdi>
              </div>
              <div className="del-bar" aria-hidden="true">
                <span
                  style={{
                    width: `${kpis.delivery_success_rate}%`,
                    background: '#146c36',
                  }}
                />
                <span
                  style={{
                    width: `${kpis.failure_rate}%`,
                    background: '#b91c1c',
                  }}
                />
              </div>
              <div className="del-kpi-foot numeric">
                <span>
                  مكتمل {kpis.delivered_orders} · متعثر {kpis.failed_orders} (
                  {kpis.failure_rate}%)
                </span>
              </div>
            </article>

            <article className="del-kpi">
              <div className="del-kpi-top">
                <span className="del-kpi-label">
                  <span className="del-kpi-ico is-navy" aria-hidden="true">
                    <Wallet size={17} />
                  </span>
                  التحصيل النقدي (COD)
                </span>
                <DeltaBadge
                  current={Number(kpis.cod_collected_value)}
                  previous={prev ? Number(prev.cod_collected_value) : null}
                />
              </div>
              <div className="del-kpi-val numeric">
                <bdi>{money(kpis.cod_collected_value)}</bdi>
              </div>
              <div className="del-kpi-foot">
                <span>إجمالي قيمة الطلبات المُسلّمة للتسوية</span>
              </div>
            </article>

            <button
              type="button"
              className="del-kpi"
              onClick={() => navigate('drivers')}
            >
              <div className="del-kpi-top">
                <span className="del-kpi-label">
                  <span className="del-kpi-ico is-blue" aria-hidden="true">
                    <Users size={17} />
                  </span>
                  جاهزية الأسطول الآن
                </span>
                <span className="del-mini-pill is-teal numeric">
                  إشغال {busyPct}%
                </span>
              </div>
              <div className="del-kpi-val numeric">
                {fleet.active_drivers} سائق نشط
              </div>
              <div className="del-bar" aria-hidden="true">
                <span
                  style={{
                    width: `${busyPct}%`,
                    background: '#1b5ca8',
                  }}
                />
                <span
                  style={{
                    width: `${100 - busyPct}%`,
                    background: '#dbe8f9',
                  }}
                />
              </div>
              <div className="del-kpi-foot numeric">
                <span>
                  {fleet.busy_drivers} في رحلة · {fleet.idle_active_drivers}{' '}
                  بدون طلب مفتوح ←
                </span>
              </div>
            </button>
          </section>

          <div className="del-grid-primary">
            <DeliveryTrendChart series={data.daily_series} />
            <DeliveryStatusDonut
              counts={data.status_breakdown}
              onSelectOrders={() => navigate('orders')}
            />
          </div>

          <div className="del-grid-secondary">
            <DeliveryPeakHoursChart hours={data.peak_hours} />

            <section className="panel del-card">
              <div className="del-card-head">
                <div>
                  <h2>غرفة التوزيع والأسطول</h2>
                  <p className="del-card-sub">
                    صورة لحظية للطلبات الجارية وتوزيع السائقين
                  </p>
                </div>
              </div>
              <div className="del-ops-list">
                <button
                  type="button"
                  className="del-ops-row"
                  onClick={() => navigate('orders')}
                >
                  <span className="del-ops-title">
                    <Truck size={16} aria-hidden="true" />
                    الطلبات الجارية الآن
                  </span>
                  <span className="del-ops-pills numeric">
                    <span className="del-mini-pill is-teal">
                      {queue.unassigned_accepted} بانتظار سائق
                    </span>
                    <span className="del-mini-pill is-blue">
                      {queue.in_transit} قيد التوصيل
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  className="del-ops-row"
                  onClick={() => navigate('drivers')}
                >
                  <span className="del-ops-title">
                    <Users size={16} aria-hidden="true" />
                    أسطول السائقين ({fleet.total_drivers})
                  </span>
                  <span className="del-ops-pills numeric">
                    <span className="del-mini-pill is-green">
                      {fleet.active_drivers} نشط
                    </span>
                    <span className="del-mini-pill is-teal">
                      {fleet.busy_drivers} لديه طلبات
                    </span>
                    {fleet.inactive_drivers > 0 && (
                      <span className="del-mini-pill is-rose">
                        {fleet.inactive_drivers} متوقف
                      </span>
                    )}
                  </span>
                </button>
              </div>

              <p className="del-note">
                السائق النشط مؤهل لإسناد الطلبات. حالة «بدون طلب مفتوح» تعكس
                الطلبات المسندة له داخل النظام حالياً ولا تغني عن متابعته
                ميدانياً.
              </p>

              <div className="del-quick-strip">
                <button
                  type="button"
                  className="button primary"
                  onClick={() => navigate('orders')}
                >
                  فتح طلبات الشركة ←
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => navigate('drivers')}
                >
                  إدارة السائقين
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => navigate('profile')}
                >
                  بيانات الشركة
                </button>
              </div>
            </section>
          </div>

          <div className="del-grid-tables">
            <section className="panel del-card">
              <div className="del-card-head">
                <div>
                  <h2>أداء وحمل السائقين</h2>
                  <p className="del-card-sub">
                    {driverTab === 'delivered'
                      ? 'ترتيب السائقين حسب التسليمات وسرعة الإنجاز خلال الفترة'
                      : 'ترتيب السائقين حسب عدد الطلبات المفتوحة عليهم الآن'}
                  </p>
                </div>
                <div
                  className="del-seg del-seg-sm"
                  role="group"
                  aria-label="ترتيب قائمة السائقين"
                >
                  <button
                    type="button"
                    className={driverTab === 'delivered' ? 'active' : ''}
                    aria-pressed={driverTab === 'delivered'}
                    onClick={() => setDriverTab('delivered')}
                  >
                    الأكثر تسليماً
                  </button>
                  <button
                    type="button"
                    className={driverTab === 'load' ? 'active' : ''}
                    aria-pressed={driverTab === 'load'}
                    onClick={() => setDriverTab('load')}
                  >
                    الحمل الحالي
                  </button>
                </div>
              </div>

              {sortedDrivers.length === 0 ? (
                <div className="del-chart-empty">
                  <p>
                    لا يوجد سائقون مسجلون بعد. أضف أول سائق من صفحة «السائقون»
                    لبدء التوزيع.
                  </p>
                </div>
              ) : (
                <ol className="del-rank-list">
                  {sortedDrivers.map((driver, idx) => (
                    <li key={driver.driver_id} className="del-rank-row">
                      <span
                        className={
                          'del-rank-num numeric' + (idx === 0 ? ' is-top' : '')
                        }
                      >
                        {idx + 1}
                      </span>
                      <div className="del-rank-main">
                        <span className="del-rank-title">
                          <span
                            className={
                              'del-status-dot ' +
                              (driver.is_active ? 'is-active' : 'is-inactive')
                            }
                            title={driver.is_active ? 'سائق نشط' : 'سائق متوقف'}
                            aria-hidden="true"
                          />
                          <span className="del-rank-name">
                            {driver.driver_name}
                          </span>
                          {!driver.is_active && (
                            <span className="del-mini-pill is-rose">متوقف</span>
                          )}
                        </span>
                        <span className="del-rank-sub numeric">
                          <span
                            className={
                              'del-mini-pill ' +
                              (driver.current_load > 0
                                ? 'is-blue'
                                : driver.is_active
                                  ? 'is-green'
                                  : '')
                            }
                          >
                            {driver.current_load > 0
                              ? `${driver.current_load} مفتوح الآن`
                              : 'بدون طلب مفتوح'}
                          </span>
                          <span>{driver.delivered_orders} مُسلّم</span>
                          {driver.avg_fulfillment_minutes !== null && (
                            <span>
                              متوسط {driver.avg_fulfillment_minutes} د
                            </span>
                          )}
                          {driver.failed_orders > 0 && (
                            <span className="del-mini-pill is-amber">
                              تعثر {driver.failed_orders}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="del-rank-end numeric">
                        <strong>
                          <bdi>{money(driver.delivery_fees)}</bdi>
                        </strong>
                        <small>نجاح {driver.success_rate}%</small>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="panel del-card">
              <div className="del-card-head">
                <div>
                  <h2>أكثر المطاعم استلاماً</h2>
                  <p className="del-card-sub">
                    نقاط الاستلام الأعلى طلباً لتمركز السائقين خلال الفترة
                  </p>
                </div>
              </div>

              {data.top_pickup_restaurants.length === 0 ? (
                <div className="del-chart-empty">
                  <p>لا توجد طلبات مسندة من المطاعم خلال الفترة المختارة.</p>
                </div>
              ) : (
                <ol className="del-rank-list">
                  {data.top_pickup_restaurants.map((rest, idx) => {
                    const widthPct = Math.max(
                      8,
                      Math.round((rest.assigned_orders / maxRestOrders) * 100),
                    );
                    return (
                      <li key={rest.rest_id} className="del-rank-row">
                        <span
                          className={
                            'del-rank-num numeric' +
                            (idx === 0 ? ' is-top' : '')
                          }
                        >
                          {idx + 1}
                        </span>
                        <div className="del-rank-main">
                          <span className="del-rank-title">
                            <Store size={14} aria-hidden="true" />
                            <span className="del-rank-name">
                              {rest.rest_title}
                            </span>
                          </span>
                          <span className="del-rank-sub numeric">
                            <span>
                              {rest.delivered_orders} مُسلّم من{' '}
                              {rest.assigned_orders} رحلة
                            </span>
                            {rest.failed_orders > 0 && (
                              <span className="del-mini-pill is-rose">
                                تعثر {rest.failed_orders}
                              </span>
                            )}
                          </span>
                          <div className="del-item-bar" aria-hidden="true">
                            <span style={{ width: `${widthPct}%` }} />
                          </div>
                        </div>
                        <div className="del-rank-end numeric">
                          <strong>
                            <bdi>{money(rest.delivery_fees)}</bdi>
                          </strong>
                          <small>#{rest.rest_id}</small>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
