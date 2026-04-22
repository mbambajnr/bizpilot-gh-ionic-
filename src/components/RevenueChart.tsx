import { formatCurrency } from '../utils/format';

type RevenuePoint = {
  label: string;
  shortLabel: string;
  value: number;
};

type RevenueChartProps = {
  points: RevenuePoint[];
  currency?: string;
};

const CHART_HEIGHT = 210;
const CHART_WIDTH = 360;
const CHART_TOP = 22;
const CHART_BOTTOM = 156;
const CHART_LEFT = 44;
const CHART_RIGHT = 18;
const CHART_INNER_HEIGHT = CHART_BOTTOM - CHART_TOP;

function formatCompactCurrency(value: number, currency: string) {
  if (value === 0) {
    return '';
  }

  const absValue = Math.abs(value);
  const symbol = currency === 'GHS' ? 'GH¢' : `${currency} `;

  if (absValue >= 1000) {
    return `${symbol}${(value / 1000).toFixed(absValue >= 100000 ? 0 : 1)}k`;
  }

  return `${symbol}${Math.round(value)}`;
}

const RevenueChart: React.FC<RevenueChartProps> = ({ points, currency = 'GHS' }) => {
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const barWidth = 28;
  const gap = 16;
  const bestPointValue = Math.max(...points.map((point) => point.value), 0);
  const averageValue = points.length ? points.reduce((sum, point) => sum + point.value, 0) / points.length : 0;
  const yAxisFractions = [1, 0.5];

  return (
    <div className="revenue-chart-wrap">
      <svg
        className="revenue-chart"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label="Revenue analytics for the last seven days"
      >
        <defs>
          <linearGradient id="revenue-bar-default" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#6dc7d8" />
            <stop offset="100%" stopColor="#2d92a5" />
          </linearGradient>
          <linearGradient id="revenue-bar-highlight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffc94d" />
            <stop offset="100%" stopColor="#ff8d2a" />
          </linearGradient>
          <filter id="revenue-bar-shadow" x="-20%" y="-10%" width="160%" height="160%">
            <feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="rgba(0,0,0,0.2)" />
          </filter>
        </defs>

        {yAxisFractions.map((fraction) => {
          const y = CHART_TOP + (1 - fraction) * CHART_INNER_HEIGHT;
          return (
            <g key={fraction}>
              <line
                x1={CHART_LEFT}
                y1={y}
                x2={CHART_WIDTH - CHART_RIGHT}
                y2={y}
                className="revenue-grid-line"
              />
              <text x={CHART_LEFT - 8} y={y + 4} textAnchor="end" className="revenue-y-axis-label">
                {formatCurrency(Math.round(maxValue * fraction), currency)}
              </text>
            </g>
          );
        })}

        {points.map((point, index) => {
          const height = point.value === 0 ? 4 : Math.max((point.value / maxValue) * CHART_INNER_HEIGHT, 12);
          const x = CHART_LEFT + 8 + index * (barWidth + gap);
          const y = CHART_BOTTOM - height;
          const isBestDay = point.value === bestPointValue && bestPointValue > 0;
          const compactValue = formatCompactCurrency(point.value, currency);

          return (
            <g key={point.label}>
              {isBestDay ? (
                <rect
                  x={x - 6}
                  y={y - 10}
                  width={barWidth + 12}
                  height={height + 18}
                  rx="16"
                  className="revenue-bar-highlight-shell"
                />
              ) : null}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={height}
                rx="12"
                className={point.value === 0 ? 'revenue-bar revenue-bar-zero' : isBestDay ? 'revenue-bar revenue-bar-best' : 'revenue-bar'}
                filter="url(#revenue-bar-shadow)"
              />
              {compactValue ? (
                <text x={x + barWidth / 2} y={y - 10} textAnchor="middle" className={`revenue-value-label${isBestDay ? ' is-best' : ''}`}>
                  {compactValue}
                </text>
              ) : null}
              <text x={x + barWidth / 2} y={CHART_BOTTOM + 18} textAnchor="middle" className="revenue-axis-label">
                {point.shortLabel}
              </text>
            </g>
          );
        })}

        <line
          x1={CHART_LEFT}
          y1={CHART_BOTTOM}
          x2={CHART_WIDTH - CHART_RIGHT}
          y2={CHART_BOTTOM}
          className="revenue-baseline"
        />
      </svg>

      <div className="revenue-legend">
        <div className="revenue-legend-summary">
          <span className="revenue-legend-caption">Average per day</span>
          <strong>{formatCurrency(averageValue, currency)}</strong>
        </div>
        {points.map((point) => (
          <div className={`revenue-legend-row${point.value === bestPointValue && bestPointValue > 0 ? ' is-best' : ''}`} key={point.label}>
            <div className="revenue-legend-day">
              <span className="revenue-legend-dot" />
              <span>{point.label}</span>
            </div>
            <strong>{formatCurrency(point.value, currency)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RevenueChart;
