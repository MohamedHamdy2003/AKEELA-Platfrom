import { useMemo, useState } from 'react';
import {
  statuses,
  type AdminAnalyticsHourPoint,
  type DeliveryAnalyticsDailyPoint,
  type DeliveryAnalyticsStatusBreakdown,
} from '@akeela/portal/models';
import { money } from '@akeela/portal/ui';

export type DeliveryStatusKey = keyof DeliveryAnalyticsStatusBreakdown;

export const DELIVERY_STATUS_ORDER: DeliveryStatusKey[] = [
  'Delivered',
  'Picked_Up',
  'Accepted',
  'Failed',
];

export const DELIVERY_STATUS_COLORS: Record<DeliveryStatusKey, string> = {
  Delivered: '#146c36',
  Picked_Up: '#2563eb',
  Accepted: '#087e91',
  Failed: '#b91c1c',
};

function shortCairoDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(dt);
}

function compactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  return String(Math.round(value));
}

export function formatHourAr(hour: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${hour < 12 ? 'ص' : 'م'}`;
}

export function DeliveryTrendChart({
  series,
}: {
  series: DeliveryAnalyticsDailyPoint[];
}) {
  const [metric, setMetric] = useState<'delivered' | 'fees'>('delivered');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const values = useMemo(
    () =>
      series.map((point) =>
        metric === 'fees' ? Number(point.delivery_fees) || 0 : point.delivered,
      ),
    [series, metric],
  );
  const maxVal = useMemo(() => Math.max(0, ...values), [values]);
  const hasData = maxVal > 0;

  const width = 640;
  const height = 228;
  const padTop = 18;
  const padRight = 22;
  const padBottom = 34;
  const padLeft = 58;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const yCeiling = hasData ? maxVal * 1.15 : 10;

  const points = useMemo(() => {
    if (!series.length) return [];
    return series.map((point, index) => {
      const x =
        series.length === 1
          ? padLeft + plotW / 2
          : padLeft + (index / (series.length - 1)) * plotW;
      const val = values[index] ?? 0;
      const y = padTop + plotH - (val / yCeiling) * plotH;
      return { x, y, val, point, index };
    });
  }, [series, values, plotW, plotH, yCeiling]);

  const linePath = useMemo(() => {
    if (points.length < 2) return '';
    return points
      .map(
        (p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
      )
      .join(' ');
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length < 2) return '';
    const first = points[0]!;
    const last = points[points.length - 1]!;
    const baseY = padTop + plotH;
    return `${linePath} L ${last.x.toFixed(1)} ${baseY} L ${first.x.toFixed(1)} ${baseY} Z`;
  }, [points, linePath, plotH]);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    ratio,
    value: yCeiling * ratio,
    y: padTop + plotH - ratio * plotH,
  }));

  const xLabelIndices = useMemo(() => {
    if (series.length <= 6) return series.map((_, i) => i);
    const last = series.length - 1;
    const step = Math.max(2, Math.round(last / 4));
    const minGap = Math.max(2, Math.floor(step * 0.65));
    const set = new Set<number>([0, last]);
    for (let i = step; i <= last - minGap; i += step) set.add(i);
    return [...set].sort((a, b) => a - b);
  }, [series]);

  const hovered =
    activeIndex !== null && points[activeIndex] ? points[activeIndex]! : null;

  return (
    <section className="panel del-card">
      <div className="del-card-head">
        <div>
          <h2>منحنى التوصيل اليومي</h2>
          <p className="del-card-sub">
            {metric === 'delivered'
              ? 'الطلبات المُسلّمة يومياً خلال الفترة المختارة'
              : 'إيرادات رسوم التوصيل اليومية (EGP)'}
          </p>
        </div>
        <div
          className="del-seg del-seg-sm"
          role="group"
          aria-label="معيار منحنى التوصيل"
        >
          <button
            type="button"
            className={metric === 'delivered' ? 'active' : ''}
            aria-pressed={metric === 'delivered'}
            onClick={() => setMetric('delivered')}
          >
            التسليمات
          </button>
          <button
            type="button"
            className={metric === 'fees' ? 'active' : ''}
            aria-pressed={metric === 'fees'}
            onClick={() => setMetric('fees')}
          >
            رسوم التوصيل
          </button>
        </div>
      </div>

      {!hasData ? (
        <div className="del-chart-empty">
          <p>لا توجد تسليمات مكتملة للرسم خلال الفترة المختارة.</p>
        </div>
      ) : (
        <div
          className="del-chart-stage"
          onMouseLeave={() => setActiveIndex(null)}
        >
          {hovered && (
            <div className="del-tooltip" role="status">
              <strong>{shortCairoDate(hovered.point.date)}</strong>
              <span className="numeric">
                تم التسليم: {hovered.point.delivered} من{' '}
                {hovered.point.assigned}
                {hovered.point.failed > 0
                  ? ` (تعثر ${hovered.point.failed})`
                  : ''}
              </span>
              <span className="numeric">
                رسوم التوصيل: <bdi>{money(hovered.point.delivery_fees)}</bdi>
              </span>
            </div>
          )}
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="del-svg"
            role="img"
            aria-label={
              metric === 'fees'
                ? 'رسم بياني لرسوم التوصيل اليومية'
                : 'رسم بياني لعدد التسليمات اليومية'
            }
          >
            <defs>
              <linearGradient id="delTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#087e91" stopOpacity="0.24" />
                <stop offset="100%" stopColor="#087e91" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {yTicks.map((tick) => (
              <g key={tick.ratio}>
                <line
                  x1={padLeft}
                  y1={tick.y}
                  x2={width - padRight}
                  y2={tick.y}
                  stroke="#e2e7eb"
                  strokeDasharray={tick.ratio === 0 ? undefined : '3 4'}
                />
                <text
                  x={padLeft - 10}
                  y={tick.y + 4}
                  textAnchor="end"
                  className="del-axis-text del-axis-num"
                >
                  {compactNumber(tick.value)}
                </text>
              </g>
            ))}

            {points.length === 1 ? (
              <rect
                x={points[0]!.x - 28}
                y={points[0]!.y}
                width={56}
                height={Math.max(4, padTop + plotH - points[0]!.y)}
                rx={8}
                fill="#087e91"
                onMouseEnter={() => setActiveIndex(0)}
              />
            ) : (
              <>
                <path d={areaPath} fill="url(#delTrendFill)" />
                <path
                  d={linePath}
                  fill="none"
                  stroke="#087e91"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}

            {hovered && (
              <line
                x1={hovered.x}
                y1={padTop}
                x2={hovered.x}
                y2={padTop + plotH}
                stroke="#12b0bd"
                strokeWidth="1.25"
                strokeDasharray="3 3"
              />
            )}

            {points.map((pt) => {
              const isActive = activeIndex === pt.index;
              const hitW =
                points.length > 1 ? Math.max(10, plotW / points.length) : plotW;
              return (
                <g key={pt.point.date}>
                  <rect
                    x={Math.max(padLeft, pt.x - hitW / 2)}
                    y={padTop}
                    width={hitW}
                    height={plotH}
                    fill="transparent"
                    className="del-hit"
                    onMouseEnter={() => setActiveIndex(pt.index)}
                  />
                  {(isActive || points.length <= 14) && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isActive ? 5.5 : 3}
                      fill={isActive ? '#12b0bd' : '#ffffff'}
                      stroke={isActive ? '#07384b' : '#087e91'}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                  )}
                </g>
              );
            })}

            {xLabelIndices.map((idx) => {
              const pt = points[idx];
              if (!pt) return null;
              return (
                <text
                  key={pt.point.date}
                  x={pt.x}
                  y={height - 10}
                  textAnchor="middle"
                  className="del-axis-text"
                >
                  {shortCairoDate(pt.point.date)}
                </text>
              );
            })}
          </svg>
        </div>
      )}
    </section>
  );
}

export function DeliveryStatusDonut({
  counts,
  onSelectOrders,
}: {
  counts: DeliveryAnalyticsStatusBreakdown;
  onSelectOrders: () => void;
}) {
  const [hoveredStatus, setHoveredStatus] = useState<DeliveryStatusKey | null>(
    null,
  );
  const total = DELIVERY_STATUS_ORDER.reduce(
    (sum, key) => sum + (counts[key] ?? 0),
    0,
  );

  const radius = 58;
  const circumference = 2 * Math.PI * radius;

  const segments = useMemo(() => {
    if (!total) return [];
    let offset = 0;
    return DELIVERY_STATUS_ORDER.filter((key) => counts[key] > 0).map((key) => {
      const value = counts[key];
      const share = value / total;
      const dash = share * circumference;
      const seg = {
        key,
        value,
        pct: Math.round(share * 1000) / 10,
        dash,
        offset,
        color: DELIVERY_STATUS_COLORS[key],
      };
      offset += dash;
      return seg;
    });
  }, [counts, total, circumference]);

  const activeSeg = hoveredStatus
    ? (segments.find((s) => s.key === hoveredStatus) ?? null)
    : null;

  return (
    <section className="panel del-card">
      <div className="del-card-head">
        <div>
          <h2>توزيع حالات التوصيل</h2>
          <p className="del-card-sub">
            حالة الطلبات المسندة للشركة خلال الفترة
          </p>
        </div>
      </div>

      <div className="del-donut-layout">
        <div className="del-donut-wrap">
          <svg
            viewBox="0 0 160 160"
            className="del-donut-svg"
            role="img"
            aria-label="توزيع حالات التوصيل"
          >
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="#eaf1f5"
              strokeWidth="18"
            />
            <g transform="rotate(-90 80 80)">
              {segments.map((seg) => {
                const isHovered = hoveredStatus === seg.key;
                return (
                  <circle
                    key={seg.key}
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={isHovered ? 22 : 18}
                    strokeDasharray={`${Math.max(1.5, seg.dash - 1.2)} ${circumference}`}
                    strokeDashoffset={-seg.offset}
                    className="del-donut-seg"
                    onMouseEnter={() => setHoveredStatus(seg.key)}
                    onMouseLeave={() => setHoveredStatus(null)}
                  />
                );
              })}
            </g>
          </svg>
          <div className="del-donut-center">
            <strong className="numeric">
              {activeSeg ? activeSeg.value : total}
            </strong>
            <span>
              {activeSeg
                ? `${statuses[activeSeg.key]} (${activeSeg.pct}%)`
                : 'طلب مسنَد'}
            </span>
          </div>
        </div>

        <ul className="del-legend">
          {DELIVERY_STATUS_ORDER.map((key) => {
            const count = counts[key] ?? 0;
            const pct = total ? Math.round((count / total) * 1000) / 10 : 0;
            const dimmed = hoveredStatus !== null && hoveredStatus !== key;
            return (
              <li key={key}>
                <button
                  type="button"
                  className={'del-legend-row' + (dimmed ? ' is-dimmed' : '')}
                  onMouseEnter={() => setHoveredStatus(key)}
                  onMouseLeave={() => setHoveredStatus(null)}
                  onClick={onSelectOrders}
                >
                  <span className="del-legend-label">
                    <span
                      className="del-dot"
                      style={{ background: DELIVERY_STATUS_COLORS[key] }}
                      aria-hidden="true"
                    />
                    {statuses[key]}
                  </span>
                  <span className="del-legend-vals numeric">
                    <strong>{count}</strong>
                    <small>{pct}%</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function DeliveryPeakHoursChart({
  hours,
}: {
  hours: AdminAnalyticsHourPoint[];
}) {
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const maxOrders = useMemo(
    () => Math.max(0, ...hours.map((h) => h.orders)),
    [hours],
  );
  const peak = useMemo(() => {
    if (!maxOrders) return null;
    return hours.find((h) => h.orders === maxOrders) ?? null;
  }, [hours, maxOrders]);

  const width = 560;
  const height = 186;
  const padTop = 14;
  const padBottom = 30;
  const padSide = 14;
  const plotW = width - padSide * 2;
  const plotH = height - padTop - padBottom;
  const slotW = plotW / 24;
  const barW = Math.max(8, slotW - 6);

  const activePoint =
    hoveredHour !== null
      ? (hours.find((h) => h.hour === hoveredHour) ?? null)
      : null;

  return (
    <section className="panel del-card">
      <div className="del-card-head">
        <div>
          <h2>ساعات ذروة التوصيل (تخطيط الورديات)</h2>
          <p className="del-card-sub">
            ضغط الطلبات المسندة للشركة على مدار 24 ساعة بتوقيت القاهرة
          </p>
        </div>
        {peak ? (
          <span className="del-peak-pill">
            ذروة الوردية: {formatHourAr(peak.hour)} ({peak.orders} طلب)
          </span>
        ) : (
          <span className="del-peak-pill is-muted">لا توجد ذروة بعد</span>
        )}
      </div>

      <div
        className="del-chart-stage"
        onMouseLeave={() => setHoveredHour(null)}
      >
        {activePoint && (
          <div className="del-tooltip" role="status">
            <strong>
              {formatHourAr(activePoint.hour)} –{' '}
              {formatHourAr((activePoint.hour + 1) % 24)}
            </strong>
            <span className="numeric">{activePoint.orders} طلب مسنَد</span>
          </div>
        )}
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="del-svg"
          role="img"
          aria-label="رسم بياني لساعات ذروة التوصيل على مدار 24 ساعة"
        >
          <line
            x1={padSide}
            y1={padTop + plotH}
            x2={width - padSide}
            y2={padTop + plotH}
            stroke="#e2e7eb"
          />
          {hours.map((point) => {
            const x = padSide + point.hour * slotW + (slotW - barW) / 2;
            const barH =
              maxOrders > 0
                ? Math.max(
                    point.orders > 0 ? 6 : 2,
                    (point.orders / maxOrders) * plotH,
                  )
                : 2;
            const y = padTop + plotH - barH;
            const isPeak = maxOrders > 0 && point.orders === maxOrders;
            const isHovered = hoveredHour === point.hour;
            const fill =
              point.orders === 0
                ? '#e2e7eb'
                : isPeak
                  ? '#12b0bd'
                  : isHovered
                    ? '#07384b'
                    : '#087e91';
            return (
              <g
                key={point.hour}
                onMouseEnter={() => setHoveredHour(point.hour)}
                className="del-hit"
              >
                <rect
                  x={padSide + point.hour * slotW}
                  y={padTop}
                  width={slotW}
                  height={plotH}
                  fill="transparent"
                />
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={barH}
                  rx={4}
                  fill={fill}
                  opacity={
                    hoveredHour !== null && !isHovered && point.orders > 0
                      ? 0.65
                      : 1
                  }
                />
                {point.hour % 4 === 0 && (
                  <text
                    x={x + barW / 2}
                    y={height - 10}
                    textAnchor="middle"
                    className="del-axis-text"
                  >
                    {formatHourAr(point.hour)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
