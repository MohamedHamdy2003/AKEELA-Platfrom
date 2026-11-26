import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Banknote,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Download,
  Receipt,
  RefreshCw,
  ShoppingBag,
  Store,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { query } from '@akeela/portal/api';
import {
  statuses,
  type AdminRestaurantAnalytics,
  type AnalyticsRange,
  type Order,
  type OrderStatus,
  type OrderSummary,
  type RestaurantReview,
} from '@akeela/portal/models';
import {
  ActivityBadge,
  Badge,
  DetailSkeleton,
  Failure,
  Field,
  OrderFacts,
  Pager,
  ResourceState,
  TableSkeleton,
  dateTime,
  money,
  useResource,
} from '@akeela/portal/ui';
import { ArabicDateFields } from '@akeela/portal/arabic-date-fields';
import { api } from '../lib/api';
import { downloadRestaurantEarningsExcel } from '../lib/excel-export';
import { DetailWorkspace } from '../components/detail-workspace';
import { EmailVerification } from '../components/email-verification';
import { AdminActions } from './orders';
import {
  PeakHoursChart,
  StatusDonutChart,
  TrendChart,
} from './analytics-charts';
import './home.css';
import './restaurant-workspace.css';

type WorkspaceTab = 'analytics' | 'orders' | 'profile';

const RANGE_OPTIONS: Array<{ key: AnalyticsRange; label: string }> = [
  { key: 'today', label: 'اليوم' },
  { key: '7d', label: '7 أيام' },
  { key: '30d', label: '30 يوماً' },
  { key: '90d', label: '90 يوماً' },
  { key: 'all', label: 'الكل' },
];

const ACTIVATION_LABELS: Record<'Pending' | 'Active' | 'Suspended', string> = {
  Pending: 'بانتظار التفعيل',
  Active: 'مفعّل',
  Suspended: 'معلّق',
};

function DeltaBadge({
  current,
  previous,
}: {
  current: number;
  previous: number | null;
}) {
  if (previous === null) return null;
  if (previous === 0) {
    if (current === 0) {
      return <span className="adm-delta is-flat numeric">0%</span>;
    }
    return <span className="adm-delta is-up">جديد</span>;
  }
  const pct = Math.round(((current - previous) / previous) * 1000) / 10;
  if (pct === 0) {
    return <span className="adm-delta is-flat numeric">0%</span>;
  }
  const up = pct > 0;
  return (
    <span className={'adm-delta numeric ' + (up ? 'is-up' : 'is-down')}>
      {up ? (
        <TrendingUp size={12} aria-hidden="true" />
      ) : (
        <TrendingDown size={12} aria-hidden="true" />
      )}
      <bdi>{`${up ? '+' : ''}${pct}%`}</bdi>
    </span>
  );
}

export function RestaurantWorkspace({
  restaurant,
  revision,
  onBack,
  onRequestActivation,
}: {
  restaurant: RestaurantReview;
  revision: number;
  onBack: () => void;
  onRequestActivation: (action: 'Active' | 'Suspended') => void;
}) {
  const [tab, setTab] = useState<WorkspaceTab>('analytics');
  const [ordersStatusFilter, setOrdersStatusFilter] = useState('');
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [appliedCustom, setAppliedCustom] = useState<{
    date_from: string;
    date_to: string;
  } | null>(null);
  const [dateWarning, setDateWarning] = useState('');

  const restId = restaurant.profile.rest_id;

  const analyticsPath = appliedCustom
    ? `/admin/restaurants/${restId}/analytics` +
      query({
        date_from: appliedCustom.date_from,
        date_to: appliedCustom.date_to,
      })
    : `/admin/restaurants/${restId}/analytics?range=${range}`;

  const analytics = useResource<AdminRestaurantAnalytics>(
    api,
    analyticsPath,
    revision,
  );

  const [cachedAnalytics, setCachedAnalytics] =
    useState<AdminRestaurantAnalytics | null>(null);

  useEffect(() => {
    setCachedAnalytics(null);
  }, [restId]);

  useEffect(() => {
    if (analytics.result?.data) {
      setCachedAnalytics(analytics.result.data);
    }
  }, [analytics.result]);

  const data = analytics.result?.data ?? cachedAnalytics;

  const periodLabel = appliedCustom
    ? `من ${appliedCustom.date_from} إلى ${appliedCustom.date_to}`
    : (RANGE_OPTIONS.find((r) => r.key === range)?.label ?? range);

  const periodSlug = appliedCustom
    ? `${appliedCustom.date_from}_to_${appliedCustom.date_to}`
    : range;

  const applyCustomPeriod = () => {
    if (!customFrom || !customTo) {
      setDateWarning('يرجى إدخال تاريخ البداية وتاريخ النهاية معاً.');
      return;
    }
    if (customFrom > customTo) {
      setDateWarning('تاريخ البداية لا يمكن أن يكون بعد تاريخ النهاية.');
      return;
    }
    setDateWarning('');
    setAppliedCustom({ date_from: customFrom, date_to: customTo });
  };

  const clearCustomPeriod = () => {
    setCustomFrom('');
    setCustomTo('');
    setDateWarning('');
    setAppliedCustom(null);
  };

  const handleExportExcel = () => {
    if (!data) return;
    downloadRestaurantEarningsExcel({
      restId,
      restTitle: restaurant.profile.rest_title,
      ownerName: restaurant.owner?.full_name ?? 'غير متاح',
      periodLabel,
      periodSlug,
      analytics: data,
    });
  };

  const trendSeries = useMemo(
    () =>
      (data?.daily_series ?? []).map((point) => ({
        date: point.date,
        orders: point.orders,
        delivered: point.delivered,
        gmv: point.food_revenue,
      })),
    [data?.daily_series],
  );

  return (
    <div className="adm-rest-ws">
      <div className="adm-rest-ws-top">
        <div className="adm-rest-ws-head">
          <button
            type="button"
            className="button adm-rest-back"
            onClick={onBack}
          >
            <ArrowRight size={16} aria-hidden="true" />
            العودة إلى المطاعم
          </button>
          <div className="adm-rest-title-row">
            <h1>{restaurant.profile.rest_title}</h1>
            <span className="adm-rest-id">
              <bdi>#{restId}</bdi>
            </span>
            <span
              className={`status-pill activation-${restaurant.profile.activation_status.toLowerCase()}`}
            >
              <i className="status-dot" aria-hidden="true" />
              {ACTIVATION_LABELS[restaurant.profile.activation_status]}
            </span>
            <ActivityBadge
              active={restaurant.profile.is_active}
              activeLabel="مفتوح للطلبات"
              inactiveLabel="متوقف"
            />
          </div>
          <p className="adm-rest-sub">
            المالك: <strong>{restaurant.owner?.full_name ?? 'غير متاح'}</strong>
            {' · '}
            <bdi>{restaurant.owner?.phone ?? ''}</bdi>
          </p>
        </div>

        <div className="adm-rest-ws-actions">
          <button
            type="button"
            className="button primary adm-excel-btn"
            disabled={!data}
            onClick={handleExportExcel}
          >
            <Download size={16} aria-hidden="true" />
            تصدير تقرير المكاسب (Excel)
          </button>
          {restaurant.profile.activation_status !== 'Active' && (
            <button
              type="button"
              className="button"
              onClick={() => onRequestActivation('Active')}
            >
              تفعيل المطعم
            </button>
          )}
          {restaurant.profile.activation_status !== 'Suspended' && (
            <button
              type="button"
              className="button danger"
              onClick={() => onRequestActivation('Suspended')}
            >
              تعليق المطعم
            </button>
          )}
        </div>
      </div>

      <div
        className="adm-rest-tabs"
        role="tablist"
        aria-label="أقسام صفحة المطعم"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'analytics'}
          className={tab === 'analytics' ? 'is-active' : ''}
          onClick={() => setTab('analytics')}
        >
          <Banknote size={16} aria-hidden="true" />
          التحليلات والمكاسب
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'orders'}
          className={tab === 'orders' ? 'is-active' : ''}
          onClick={() => setTab('orders')}
        >
          <ClipboardList size={16} aria-hidden="true" />
          طلبات المطعم
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'profile'}
          className={tab === 'profile' ? 'is-active' : ''}
          onClick={() => setTab('profile')}
        >
          <Store size={16} aria-hidden="true" />
          بيانات المطعم والمنيو
        </button>
      </div>

      {tab === 'analytics' && (
        <div className="adm-rest-tab-panel" role="tabpanel">
          <section
            className="panel adm-period-bar"
            aria-label="تحديد فترة المكاسب"
          >
            <div className="adm-period-row">
              <div
                className="adm-seg"
                role="group"
                aria-label="الفترات الجاهزة"
              >
                {RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={
                      !appliedCustom && range === option.key ? 'active' : ''
                    }
                    aria-pressed={!appliedCustom && range === option.key}
                    onClick={() => {
                      setAppliedCustom(null);
                      setDateWarning('');
                      setRange(option.key);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="adm-custom-range">
                <label className="adm-date-mini">
                  <span>من تاريخ</span>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => {
                      setCustomFrom(e.target.value);
                      setDateWarning('');
                    }}
                  />
                </label>
                <label className="adm-date-mini">
                  <span>إلى تاريخ</span>
                  <input
                    type="date"
                    min={customFrom || undefined}
                    value={customTo}
                    onChange={(e) => {
                      setCustomTo(e.target.value);
                      setDateWarning('');
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="button primary compact"
                  onClick={applyCustomPeriod}
                >
                  <Calendar size={15} aria-hidden="true" />
                  عرض الفترة
                </button>
                {(appliedCustom || customFrom || customTo) && (
                  <button
                    type="button"
                    className="button compact"
                    onClick={clearCustomPeriod}
                  >
                    إلغاء الفترة
                  </button>
                )}
              </div>
            </div>
            {dateWarning && (
              <p className="adm-period-warning" role="alert">
                {dateWarning}
              </p>
            )}
            <div className="adm-period-summary">
              <span>
                الفترة المعروضة حالياً: <strong>{periodLabel}</strong>
              </span>
              <button
                type="button"
                className="button compact adm-excel-inline"
                disabled={!data}
                onClick={handleExportExcel}
              >
                <Download size={14} aria-hidden="true" />
                تنزيل جدول المكاسب كـ Excel (.xlsx)
              </button>
            </div>
          </section>

          {Boolean(analytics.error) && (
            <Failure error={analytics.error} retry={analytics.reload} />
          )}

          {!data && analytics.loading && (
            <div className="adm-sk-grid" aria-busy="true">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="adm-sk-card" />
              ))}
            </div>
          )}

          {data && (
            <>
              <section
                className="adm-kpi-grid"
                aria-label="مؤشرات مكاسب المطعم"
              >
                <article className="adm-kpi">
                  <div className="adm-kpi-top">
                    <span className="adm-kpi-label">
                      <span
                        className="adm-kpi-ico is-emerald"
                        aria-hidden="true"
                      >
                        <Banknote size={17} />
                      </span>
                      صافي مبيعات الطعام
                    </span>
                    <DeltaBadge
                      current={Number(data.kpis.food_revenue)}
                      previous={
                        data.previous_kpis
                          ? Number(data.previous_kpis.food_revenue)
                          : null
                      }
                    />
                  </div>
                  <div className="adm-kpi-val numeric">
                    <bdi>{money(data.kpis.food_revenue)}</bdi>
                  </div>
                  <div className="adm-kpi-foot">
                    <span className="numeric">
                      مكاسب المطعم من {data.kpis.delivered_orders} طلب مُسلّم
                    </span>
                  </div>
                </article>

                <article className="adm-kpi">
                  <div className="adm-kpi-top">
                    <span className="adm-kpi-label">
                      <span className="adm-kpi-ico is-teal" aria-hidden="true">
                        <Receipt size={17} />
                      </span>
                      إجمالي المبيعات (GMV)
                    </span>
                  </div>
                  <div className="adm-kpi-val numeric">
                    <bdi>{money(data.kpis.gross_gmv)}</bdi>
                  </div>
                  <div className="adm-kpi-foot">
                    <span>شامل الطعام + رسوم التوصيل</span>
                  </div>
                </article>

                <article className="adm-kpi">
                  <div className="adm-kpi-top">
                    <span className="adm-kpi-label">
                      <span className="adm-kpi-ico is-gold" aria-hidden="true">
                        <Truck size={17} />
                      </span>
                      إجمالي رسوم التوصيل
                    </span>
                  </div>
                  <div className="adm-kpi-val numeric">
                    <bdi>{money(data.kpis.delivery_fees_total)}</bdi>
                  </div>
                  <div className="adm-kpi-foot">
                    <span>
                      متوسط الطلب: <bdi>{money(data.kpis.avg_order_value)}</bdi>
                    </span>
                  </div>
                </article>

                <article className="adm-kpi">
                  <div className="adm-kpi-top">
                    <span className="adm-kpi-label">
                      <span className="adm-kpi-ico is-dark" aria-hidden="true">
                        <ShoppingBag size={17} />
                      </span>
                      إجمالي الطلبات
                    </span>
                    <DeltaBadge
                      current={data.kpis.total_orders}
                      previous={data.previous_kpis?.total_orders ?? null}
                    />
                  </div>
                  <div className="adm-kpi-val numeric">
                    {data.kpis.total_orders}
                  </div>
                  <div className="adm-kpi-foot">
                    <span className="numeric">
                      {data.kpis.delivered_orders} مُسلّم ·{' '}
                      {data.kpis.rejected_orders} مرفوض ·{' '}
                      {data.kpis.cancelled_orders} ملغي
                    </span>
                  </div>
                </article>

                <article className="adm-kpi">
                  <div className="adm-kpi-top">
                    <span className="adm-kpi-label">
                      <span
                        className="adm-kpi-ico is-emerald"
                        aria-hidden="true"
                      >
                        <CheckCircle2 size={17} />
                      </span>
                      نسبة الإتمام والقبول
                    </span>
                  </div>
                  <div className="adm-kpi-val numeric">
                    <bdi>{data.kpis.completion_rate}%</bdi>
                  </div>
                  <div className="adm-kpi-foot">
                    <span className="numeric">
                      قبول {data.kpis.acceptance_rate}% · رفض{' '}
                      {data.kpis.rejection_rate}%
                    </span>
                  </div>
                </article>

                <article className="adm-kpi">
                  <div className="adm-kpi-top">
                    <span className="adm-kpi-label">
                      <span className="adm-kpi-ico is-teal" aria-hidden="true">
                        <Users size={17} />
                      </span>
                      العملاء والإضافات
                    </span>
                  </div>
                  <div className="adm-kpi-val numeric">
                    {data.kpis.unique_customers}
                  </div>
                  <div className="adm-kpi-foot">
                    <span className="numeric">
                      {data.kpis.repeat_customers} متكرر (
                      {data.kpis.repeat_customer_rate}%) · إضافات{' '}
                      <bdi>{money(data.kpis.addons_revenue)}</bdi>
                    </span>
                  </div>
                </article>
              </section>

              <div className="adm-grid-primary">
                <TrendChart series={trendSeries} />
                <StatusDonutChart
                  counts={data.status_breakdown}
                  onSelectOrders={(status) => {
                    setOrdersStatusFilter(status ?? '');
                    setTab('orders');
                  }}
                />
              </div>

              <div className="adm-grid-secondary">
                <PeakHoursChart hours={data.peak_hours} />
                <section className="panel adm-card">
                  <div className="adm-card-head">
                    <div>
                      <h2>أكثر الأصناف مبيعاً</h2>
                      <p className="adm-card-sub">
                        الأصناف والعروض الأعلى إيراداً خلال الفترة المحددة
                      </p>
                    </div>
                  </div>
                  {data.top_items.length === 0 ? (
                    <p className="muted">
                      لا توجد مبيعات مسلّمة مسجلة خلال هذه الفترة.
                    </p>
                  ) : (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>الصنف</th>
                            <th>الكمية</th>
                            <th>الإيرادات</th>
                            <th>الحصة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.top_items.map((item) => (
                            <tr key={`${item.item_type}:${item.item_name}`}>
                              <td>
                                <strong>{item.item_name}</strong>
                              </td>
                              <td className="numeric">{item.units_sold}</td>
                              <td className="numeric">
                                <bdi>{money(item.revenue)}</bdi>
                              </td>
                              <td className="numeric">
                                <bdi>{item.share_pct}%</bdi>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>

              <section className="panel adm-card adm-earnings-table-card">
                <div className="adm-card-head">
                  <div>
                    <h2>جدول المكاسب اليومية</h2>
                    <p className="adm-card-sub">
                      نفس البيانات التي يتم تصديرها في ملف Excel للفترة:{' '}
                      {periodLabel}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="button primary compact"
                    onClick={handleExportExcel}
                  >
                    <Download size={15} aria-hidden="true" />
                    تحميل Excel (.xlsx)
                  </button>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>التاريخ</th>
                        <th>إجمالي الطلبات</th>
                        <th>الطلبات المسلّمة</th>
                        <th>صافي مبيعات الطعام</th>
                        <th>رسوم التوصيل</th>
                        <th>إجمالي المبيعات (GMV)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.daily_series.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="muted">
                            لا توجد بيانات يومية في هذه الفترة.
                          </td>
                        </tr>
                      ) : (
                        data.daily_series.map((day) => (
                          <tr key={day.date}>
                            <td>
                              <bdi>{day.date}</bdi>
                            </td>
                            <td className="numeric">{day.orders}</td>
                            <td className="numeric">{day.delivered}</td>
                            <td className="numeric">
                              <strong>
                                <bdi>{money(day.food_revenue)}</bdi>
                              </strong>
                            </td>
                            <td className="numeric">
                              <bdi>{money(day.delivery_fees)}</bdi>
                            </td>
                            <td className="numeric">
                              <bdi>{money(day.gross_gmv)}</bdi>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      )}

      {tab === 'orders' && (
        <RestaurantOrdersTab
          restId={restId}
          revision={revision}
          initialStatus={ordersStatusFilter}
        />
      )}

      {tab === 'profile' && (
        <div className="adm-rest-tab-panel" role="tabpanel">
          <div className="adm-rest-profile-grid">
            <section className="panel adm-card">
              <h2>بيانات المطعم</h2>
              <dl className="adm-facts-list">
                <div>
                  <dt>اسم المطعم</dt>
                  <dd>{restaurant.profile.rest_title}</dd>
                </div>
                <div>
                  <dt>الوصف</dt>
                  <dd>
                    {restaurant.profile.rest_description || 'لا يوجد وصف'}
                  </dd>
                </div>
                <div>
                  <dt>العنوان</dt>
                  <dd>{restaurant.profile.rest_address}</dd>
                </div>
                <div>
                  <dt>الإحداثيات</dt>
                  <dd>
                    <bdi>
                      {restaurant.profile.latitude},{' '}
                      {restaurant.profile.longitude}
                    </bdi>
                  </dd>
                </div>
                <div>
                  <dt>مواعيد العمل (القاهرة)</dt>
                  <dd>
                    <bdi>
                      {restaurant.profile.opens_at} –{' '}
                      {restaurant.profile.closes_at}
                    </bdi>
                  </dd>
                </div>
              </dl>
              {restaurant.profile.rest_image_url_mobile && (
                <img
                  className="restaurant-thumbnail"
                  src={restaurant.profile.rest_image_url_mobile}
                  alt={restaurant.profile.rest_title}
                  loading="lazy"
                  decoding="async"
                />
              )}
            </section>

            <section className="panel adm-card">
              <h2>بيانات المالك والحساب</h2>
              <dl className="adm-facts-list">
                <div>
                  <dt>الاسم الكامل</dt>
                  <dd>{restaurant.owner?.full_name ?? 'غير متاح'}</dd>
                </div>
                <div>
                  <dt>البريد الإلكتروني</dt>
                  <dd className="email-cell">
                    <bdi>{restaurant.owner?.email ?? 'غير متاح'}</bdi>
                    {restaurant.owner && (
                      <EmailVerification
                        verified={!!restaurant.owner.email_verified_at}
                      />
                    )}
                  </dd>
                </div>
                <div>
                  <dt>رقم الهاتف</dt>
                  <dd>
                    <bdi>{restaurant.owner?.phone ?? 'غير متاح'}</bdi>
                  </dd>
                </div>
                <div>
                  <dt>حالة حساب المالك</dt>
                  <dd>
                    <ActivityBadge active={!!restaurant.owner?.is_active} />
                  </dd>
                </div>
              </dl>
            </section>
          </div>

          {data && (
            <section className="panel adm-card adm-menu-summary-card">
              <div className="adm-card-head">
                <div>
                  <h2>
                    <UtensilsCrossed size={18} aria-hidden="true" /> ملخص قائمة
                    الطعام والتشغيل الحي
                  </h2>
                  <p className="adm-card-sub">
                    حالة التصنيفات والمنتجات والعروض والطلبات الجارية للمطعم
                  </p>
                </div>
              </div>
              <div className="adm-menu-stat-grid">
                <div className="adm-menu-stat">
                  <span>التصنيفات المفعّلة</span>
                  <strong className="numeric">
                    {data.menu_totals.active_categories}
                  </strong>
                </div>
                <div className="adm-menu-stat">
                  <span>المنتجات المفعّلة</span>
                  <strong className="numeric">
                    {data.menu_totals.active_products}
                  </strong>
                </div>
                <div className="adm-menu-stat">
                  <span>المنتجات غير المفعّلة</span>
                  <strong className="numeric">
                    {data.menu_totals.inactive_products}
                  </strong>
                </div>
                <div className="adm-menu-stat">
                  <span>الإضافات المفعّلة</span>
                  <strong className="numeric">
                    {data.menu_totals.active_addons}
                  </strong>
                </div>
                <div className="adm-menu-stat">
                  <span>العروض المفعّلة</span>
                  <strong className="numeric">
                    {data.menu_totals.active_offers}
                  </strong>
                </div>
                <div className="adm-menu-stat">
                  <span>طلبات قيد الانتظار الآن</span>
                  <strong className="numeric">
                    {data.live_alerts.pending_orders}
                  </strong>
                </div>
                <div className="adm-menu-stat">
                  <span>طلبات قيد التحضير/التوصيل</span>
                  <strong className="numeric">
                    {data.live_alerts.active_in_progress}
                  </strong>
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function RestaurantOrdersTab({
  restId,
  revision,
  initialStatus = '',
}: {
  restId: string;
  revision: number;
  initialStatus?: string;
}) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    status: initialStatus,
    date_from: '',
    date_to: '',
  });
  useEffect(() => {
    setFilters((current) => ({ ...current, status: initialStatus }));
    setPage(1);
  }, [initialStatus]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [resetSpin, setResetSpin] = useState(0);

  const hasCompleteDateRange = Boolean(filters.date_from && filters.date_to);
  const list = useResource<OrderSummary[]>(
    api,
    '/admin/orders' +
      query({
        rest_id: restId,
        page,
        per_page: 10,
        status: filters.status,
        date_from: hasCompleteDateRange ? filters.date_from : '',
        date_to: hasCompleteDateRange ? filters.date_to : '',
      }),
    revision + tick,
  );

  const detail = useResource<Order>(
    api,
    selectedOrderId ? '/admin/orders/' + selectedOrderId : null,
    revision + tick,
  );

  useEffect(() => {
    const last = list.result?.meta?.last_page;
    if (last && page > last) setPage(Math.max(1, last));
  }, [list.result?.meta?.last_page, page]);

  const refresh = () => setTick((v) => v + 1);

  return (
    <div className="adm-rest-tab-panel" role="tabpanel">
      <DetailWorkspace
        selectedKey={selectedOrderId}
        title="تفاصيل الطلب"
        titleBadge={selectedOrderId ?? undefined}
        onClose={() => setSelectedOrderId(null)}
        details={
          <ResourceState resource={detail} skeleton={<DetailSkeleton />}>
            {detail.result && (
              <OrderFacts
                order={detail.result.data}
                actions={
                  <AdminActions order={detail.result.data} refresh={refresh} />
                }
              />
            )}
          </ResourceState>
        }
      >
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
              {(Object.keys(statuses) as OrderStatus[]).map((key) => (
                <option key={key} value={key}>
                  {statuses[key]}
                </option>
              ))}
            </select>
          </Field>
          <div key={resetSpin} style={{ display: 'contents' }}>
            <ArabicDateFields
              value={{ date_from: filters.date_from, date_to: filters.date_to }}
              change={(dates) => {
                setFilters((current) => ({ ...current, ...dates }));
                setPage(1);
              }}
            />
          </div>
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
          skeleton={<TableSkeleton columns={5} />}
        >
          <div className="panel">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>رقم الطلب</th>
                    <th>الحالة</th>
                    <th>الإجمالي</th>
                    <th>التوقيت</th>
                    <th>التفاصيل</th>
                  </tr>
                </thead>
                <tbody>
                  {list.result?.data.map((order) => (
                    <tr
                      key={order.order_id}
                      data-selected={selectedOrderId === order.order_id}
                    >
                      <td>
                        <bdi>#{order.order_id}</bdi>
                      </td>
                      <td>
                        <Badge status={order.status} />
                      </td>
                      <td className="numeric">
                        <bdi>{money(order.total_price)}</bdi>
                      </td>
                      <td>
                        <bdi>{dateTime(order.created_at)}</bdi>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="button compact"
                          onClick={() => setSelectedOrderId(order.order_id)}
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
      </DetailWorkspace>
    </div>
  );
}
