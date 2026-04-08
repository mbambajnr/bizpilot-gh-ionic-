import { formatCurrency } from '../utils/format';

type RevenuePoint = {
  label: string;
  shortLabel: string;
  value: number;
};

type RevenueChartProps = {
  points: RevenuePoint[];
};

const CHART_HEIGHT = 180;
const CHART_WIDTH = 320;

const RevenueChart: React.FC<RevenueChartProps> = ({ points }) => {
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const barWidth = 30;
  const gap = 14;

  return (
    <div className="revenue-chart-wrap">
      <svg
        className="revenue-chart"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label="Revenue analytics for the last seven days"
      >
        {[0.25, 0.5, 0.75, 1].map((fraction) => {
          const y = 18 + (1 - fraction) * 112;
          return (
            <line
              key={fraction}
              x1="8"
              y1={y}
              x2={CHART_WIDTH - 8}
              y2={y}
              className="revenue-grid-line"
            />
          );
        })}

        {points.map((point, index) => {
          const height = Math.max((point.value / maxValue) * 112, point.value > 0 ? 10 : 4);
          const x = 18 + index * (barWidth + gap);
          const y = 130 - height;

          return (
            <g key={point.label}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={height}
                rx="12"
                className="revenue-bar"
              />
              <text x={x + barWidth / 2} y="156" textAnchor="middle" className="revenue-axis-label">
                {point.shortLabel}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="revenue-legend">
        {points.map((point) => (
          <div className="revenue-legend-row" key={point.label}>
            <div className="revenue-legend-day">
              <span className="revenue-legend-dot" />
              <span>{point.label}</span>
            </div>
            <strong>{formatCurrency(point.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RevenueChart;
