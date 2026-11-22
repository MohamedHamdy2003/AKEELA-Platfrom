import { useMemo, useState } from 'react';
import {
  statuses,
  type AdminAnalyticsDailyPoint,
  type AdminAnalyticsHourPoint,
  type OrderStatus,
  type OrderStatusCounts,
} from '@akeela/portal/models';
import { money } from '@akeela/portal/ui';

export const STATUS_ORDER: OrderStatus[] = [
  'Delivered',
  'Pending',
  'Accepted',
  'Picked_Up',
  'Rejected',
  'Cancelled',
  'Failed',
];

export const STATUS_COLORS: Record<OrderStatus, string> = {
  Delivered: '#146c36',
  Pending: '#d97706',
  Accepted: '#0a8991',
  Picked_Up: '#2563eb',
  Rejected: '#e11d48',
  Cancelled: '#64748b',
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

export function TrendChart({ series }: { series: AdminAnalyticsDailyPoint[] }) {
  const [metric, setMetric] = useState<'gmv' | 'orders'>('gmv');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const values = useMemo(
    () =>
      series.map((point) =>
        metric === 'gmv' ? Number(point.gmv) || 0 : point.orders,
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
    <section className="panel adm-card adm-trend-card">
      <div className="adm-card-head">
        <div>
          <h2>منحنى الأداء اليومي</h2>
          <p className="adm-card-sub">
            {metric === 'gmv'
              ? 'إجمالي المبيعات المُسلّمة يومياً (EGP)'
              : 'إجمالي الطلبات المستلمة يومياً'}
          </p>
        </div>
        <div
          className="adm-seg adm-seg-sm"
          role="group"
          aria-label="معيار منحنى الأداء"
        >
          <button
            type="button"
            className={metric === 'gmv' ? 'active' : ''}
            aria-pressed={metric === 'gmv'}
            onClick={() => setMetric('gmv')}
          >
            المبيعات
          </button>
          <button
            type="button"
            className={metric === 'orders' ? 'active' : ''}
            aria-pressed={metric === 'orders'}
            onClick={() => setMetric('orders')}
          >
            الطلبات
          </button>
        </div>
      </div>

      {!hasData ? (
        <div className="adm-chart-empty">
          <p>لا توجد بيانات كافية للرسم خلال الفترة المختارة.</p>
        </div>
      ) : (
        <div
          className="adm-chart-stage"
          onMouseLeave={() => setActiveIndex(null)}
        >
          {hovered && (
            <div className="adm-tooltip" role="status">
              <strong>{shortCairoDate(hovered.point.date)}</strong>
              <span className="numeric">
                المبيعات: <bdi>{money(hovered.point.gmv)}</bdi>
              </span>
              <span className="numeric">
                الطلبات: {hovered.point.orders} ({hovered.point.delivered} مُسلّم)
              </span>
            </div>
          )}
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="adm-svg"
            role="img"
            aria-label={
              metric === 'gmv'
                ? 'رسم بياني للمبيعات اليومية'
                : 'رسم بياني لعدد الطلبات اليومية'
            }
          >
            <defs>
              <linearGradient id="admTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#008657" stopOpacity="0.26" />
                <stop offset="100%" stopColor="#008657" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {yTicks.map((tick) => (
              <g key={tick.ratio}>
                <line
                  x1={padLeft}
                  y1={tick.y}
                  x2={width - padRight}
                  y2={tick.y}
                  stroke="#dfe9e3"
                  strokeDasharray={tick.ratio === 0 ? undefined : '3 4'}
                />
                <text
                  x={padLeft - 10}
                  y={tick.y + 4}
                  textAnchor="end"
                  className="adm-axis-text adm-axis-num"
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
                fill="#008657"
                onMouseEnter={() => setActiveIndex(0)}
              />
            ) : (
              <>
                <path d={areaPath} fill="url(#admTrendFill)" />
                <path
                  d={linePath}
                  fill="none"
                  stroke="#008657"
                  strokeWidth="2.6"
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
                stroke="#e5b84b"
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
                    className="adm-hit"
                    tabIndex={0}
                    role="button"
                    aria-label={`${shortCairoDate(pt.point.date)}: ${pt.point.orders} طلب`}
                    onMouseEnter={() => setActiveIndex(pt.index)}
                    onFocus={() => setActiveIndex(pt.index)}
                    onBlur={() => setActiveIndex(null)}
                    onClick={() =>
                      setActiveIndex((cur) =>
                        cur === pt.index ? null : pt.index,
                      )
                    }
                  />
                  {(isActive || points.length <= 14) && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isActive ? 5.5 : 3}
                      fill={isActive ? '#e5b84b' : '#ffffff'}
                      stroke={isActive ? '#0e352a' : '#008657'}
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
                  className="adm-axis-text"
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

export function StatusDonutChart({
  counts,
  onSelectOrders,
}: {
  counts: OrderStatusCounts;
  onSelectOrders: (status?: OrderStatus) => void;
}) {
  const [hoveredStatus, setHoveredStatus] = useState<OrderStatus | null>(null);
  const total = STATUS_ORDER.reduce((sum, key) => sum + (counts[key] ?? 0), 0);

  const radius = 58;
  const circumference = 2 * Math.PI * radius;

  const segments = useMemo(() => {
    if (!total) return [];
    let offset = 0;
    return STATUS_ORDER.filter((key) => counts[key] > 0).map((key) => {
      const value = counts[key];
      const share = value / total;
      const dash = share * circumference;
      const seg = {
        key,
        value,
        pct: Math.round(share * 1000) / 10,
        dash,
        offset,
        color: STATUS_COLORS[key],
      };
      offset += dash;
      return seg;
    });
  }, [counts, total, circumference]);

  const activeSeg = hoveredStatus
    ? (segments.find((s) => s.key === hoveredStatus) ?? null)
    : null;

  return (
    <section className="panel adm-card adm-donut-card">
      <div className="adm-card-head">
        <div>
          <h2>توزيع حالات الطلبات</h2>
          <p className="adm-card-sub">نسبة كل حالة خلال الفترة المختارة</p>
        </div>
      </div>

      <div className="adm-donut-layout">
        <div className="adm-donut-wrap">
          <svg
            viewBox="0 0 160 160"
            className="adm-donut-svg"
            role="img"
            aria-label="توزيع حالات الطلبات"
          >
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="#eef2f4"
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
                    className="adm-donut-seg"
                    tabIndex={0}
                    role="button"
                    aria-label={`${statuses[seg.key]}: ${seg.value}`}
                    onMouseEnter={() => setHoveredStatus(seg.key)}
                    onMouseLeave={() => setHoveredStatus(null)}
                    onFocus={() => setHoveredStatus(seg.key)}
                    onBlur={() => setHoveredStatus(null)}
                    onClick={() => onSelectOrders(seg.key)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectOrders(seg.key);
                      }
                    }}
                  />
                );
              })}
            </g>
          </svg>
          <div className="adm-donut-center">
            <strong className="numeric">
              {activeSeg ? activeSeg.value : total}
            </strong>
            <span>
              {activeSeg
                ? `${statuses[activeSeg.key]} (${activeSeg.pct}%)`
                : 'إجمالي الطلبات'}
            </span>
          </div>
        </div>

        <ul className="adm-legend">
          {STATUS_ORDER.map((key) => {
            const count = counts[key] ?? 0;
            const pct = total ? Math.round((count / total) * 1000) / 10 : 0;
            const dimmed = hoveredStatus !== null && hoveredStatus !== key;
            return (
              <li key={key}>
                <button
                  type="button"
                  className={'adm-legend-row' + (dimmed ? ' is-dimmed' : '')}
                  onMouseEnter={() => setHoveredStatus(key)}
                  onMouseLeave={() => setHoveredStatus(null)}
                  onFocus={() => setHoveredStatus(key)}
                  onBlur={() => setHoveredStatus(null)}
                  onClick={() => onSelectOrders(key)}
                >
                  <span className="adm-legend-label">
                    <span
                      className="adm-dot"
                      style={{ background: STATUS_COLORS[key] }}
                      aria-hidden="true"
                    />
                    {statuses[key]}
                  </span>
                  <span className="adm-legend-vals numeric">
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

export function PeakHoursChart({
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
    <section className="panel adm-card adm-hours-card">
      <div className="adm-card-head">
        <div>
          <h2>أوقات الذروة (بتوقيت القاهرة)</h2>
          <p className="adm-card-sub">توزيع حجم الطلبات على مدار 24 ساعة</p>
        </div>
        {peak ? (
          <span className="adm-peak-pill">
            الذروة: {formatHourAr(peak.hour)} ({peak.orders} طلب)
          </span>
        ) : (
          <span className="adm-peak-pill is-muted">لا توجد ذروة بعد</span>
        )}
      </div>

      <div
        className="adm-chart-stage"
        onMouseLeave={() => setHoveredHour(null)}
      >
        {activePoint && (
          <div className="adm-tooltip" role="status">
            <strong>
              {formatHourAr(activePoint.hour)} –{' '}
              {formatHourAr((activePoint.hour + 1) % 24)}
            </strong>
            <span className="numeric">{activePoint.orders} طلب</span>
          </div>
        )}
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="adm-svg"
          role="img"
          aria-label="رسم بياني لأوقات ذروة الطلبات على مدار 24 ساعة"
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
                ? '#dfe9e3'
                : isPeak
                  ? '#e5b84b'
                  : isHovered
                    ? '#0e352a'
                    : '#008657';
            return (
              <g
                key={point.hour}
                tabIndex={0}
                role="button"
                aria-label={`${formatHourAr(point.hour)}: ${point.orders} طلب`}
                onMouseEnter={() => setHoveredHour(point.hour)}
                onFocus={() => setHoveredHour(point.hour)}
                onBlur={() => setHoveredHour(null)}
                onClick={() =>
                  setHoveredHour((cur) =>
                    cur === point.hour ? null : point.hour,
                  )
                }
                className="adm-hit"
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
                    className="adm-axis-text"
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
