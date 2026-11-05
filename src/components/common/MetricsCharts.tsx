/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { HealthMetricRecord } from '../../types/health';
import {
  TrendingDown,
  TrendingUp,
  Minus,
  Calendar,
  Layers,
  Info,
} from 'lucide-react';

interface MetricsChartsProps {
  metrics: HealthMetricRecord[];
}

type TimeRange = '1M' | '3M' | '6M' | '1Y' | 'ALL';

interface MetricConfig {
  key: keyof HealthMetricRecord;
  label: string;
  unit: string;
  color: string;
  stroke: string;
  fill: string;
  decimals: number;
}

const AVAILABLE_METRICS: MetricConfig[] = [
  { key: 'weight', label: 'Cân nặng', unit: 'kg', color: 'text-indigo-600', stroke: '#4f46e5', fill: '#818cf8', decimals: 1 },
  { key: 'visceralFat', label: 'Mỡ nội tạng', unit: 'cấp', color: 'text-rose-600', stroke: '#e11d48', fill: '#f43f5e', decimals: 0 },
  { key: 'muscleMass', label: 'Trọng lượng cơ bắp', unit: 'kg', color: 'text-emerald-600', stroke: '#059669', fill: '#34d399', decimals: 1 },
  { key: 'waist', label: 'Vòng eo', unit: 'cm', color: 'text-amber-600', stroke: '#d97706', fill: '#fbbf24', decimals: 1 },
  { key: 'subcutaneousFat', label: 'Mỡ dưới da', unit: '%', color: 'text-purple-600', stroke: '#9333ea', fill: '#c084fc', decimals: 1 },
  { key: 'bodyWater', label: 'Lượng nước', unit: '%', color: 'text-cyan-600', stroke: '#0891b2', fill: '#22d3ee', decimals: 1 },
  { key: 'boneCalcium', label: 'Canxi xương', unit: 'chỉ số', color: 'text-teal-600', stroke: '#0d9488', fill: '#2dd4bf', decimals: 1 },
  { key: 'bmr', label: 'Năng lượng BMR', unit: 'Kcal', color: 'text-orange-600', stroke: '#ea580c', fill: '#fb923c', decimals: 0 },
  { key: 'biologicalAge', label: 'Tuổi sinh học', unit: 'tuổi', color: 'text-pink-600', stroke: '#db2777', fill: '#f472b6', decimals: 0 },
];

export const MetricsCharts: React.FC<MetricsChartsProps> = ({ metrics }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('ALL');
  const [activeMetricKeys, setActiveMetricKeys] = useState<(keyof HealthMetricRecord)[]>([
    'weight',
    'visceralFat',
    'muscleMass',
    'waist',
  ]);
  const [hoveredPoint, setHoveredPoint] = useState<{
    date: string;
    values: Record<string, number>;
  } | null>(null);

  // Filter metrics according to selected time range
  const filteredMetrics = useMemo(() => {
    if (!metrics || metrics.length === 0) return [];
    const sorted = [...metrics].sort((a, b) => a.timestamp - b.timestamp);
    if (timeRange === 'ALL') return sorted;

    const latestTime = sorted[sorted.length - 1].timestamp;
    let daysToSubtract = 30;
    if (timeRange === '1M') daysToSubtract = 30;
    if (timeRange === '3M') daysToSubtract = 90;
    if (timeRange === '6M') daysToSubtract = 180;
    if (timeRange === '1Y') daysToSubtract = 365;

    const cutoff = latestTime - daysToSubtract * 24 * 60 * 60 * 1000;
    const result = sorted.filter((m) => m.timestamp >= cutoff);
    return result.length > 0 ? result : sorted;
  }, [metrics, timeRange]);

  const toggleMetric = (key: keyof HealthMetricRecord) => {
    if (activeMetricKeys.includes(key)) {
      if (activeMetricKeys.length > 1) {
        setActiveMetricKeys(activeMetricKeys.filter((k) => k !== key));
      }
    } else {
      setActiveMetricKeys([...activeMetricKeys, key]);
    }
  };

  // SVG Chart bounds
  const width = 800;
  const height = 300;
  const padding = { top: 25, right: 30, bottom: 40, left: 45 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Selected primary metric for chart scale
  const primaryMetricKey = activeMetricKeys[0] || 'weight';
  const primaryConfig = AVAILABLE_METRICS.find((m) => m.key === primaryMetricKey) || AVAILABLE_METRICS[0];

  // Min and Max calculation for primary metric
  const { minVal, maxVal } = useMemo(() => {
    if (filteredMetrics.length === 0) return { minVal: 0, maxVal: 100 };
    const vals = filteredMetrics.map((m) => Number(m[primaryMetricKey] || 0));
    const rawMin = Math.min(...vals);
    const rawMax = Math.max(...vals);
    const buffer = (rawMax - rawMin) * 0.15 || 5;
    return {
      minVal: Math.max(0, Math.floor(rawMin - buffer)),
      maxVal: Math.ceil(rawMax + buffer),
    };
  }, [filteredMetrics, primaryMetricKey]);

  // Points mapping
  const points = useMemo(() => {
    if (filteredMetrics.length === 0) return [];
    const count = filteredMetrics.length;
    return filteredMetrics.map((m, i) => {
      const x = count === 1 ? chartW / 2 : (i / (count - 1)) * chartW + padding.left;
      const val = Number(m[primaryMetricKey] || 0);
      const ratio = maxVal > minVal ? (val - minVal) / (maxVal - minVal) : 0.5;
      const y = height - padding.bottom - ratio * chartH;
      return { x, y, val, record: m };
    });
  }, [filteredMetrics, primaryMetricKey, minVal, maxVal, chartW, chartH, height, padding]);

  // SVG Path generator
  const pathD = useMemo(() => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    return points.reduce((acc, pt, i) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
      const prev = points[i - 1];
      const cx = (prev.x + pt.x) / 2;
      return `${acc} C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`;
    }, '');
  }, [points]);

  const areaD = useMemo(() => {
    if (points.length < 2) return '';
    const baseY = height - padding.bottom;
    return `${pathD} L ${points[points.length - 1].x} ${baseY} L ${points[0].x} ${baseY} Z`;
  }, [pathD, points, height, padding]);

  // Delta calculation for primary metric
  const delta = useMemo(() => {
    if (filteredMetrics.length < 2) return null;
    const first = Number(filteredMetrics[0][primaryMetricKey]);
    const last = Number(filteredMetrics[filteredMetrics.length - 1][primaryMetricKey]);
    const diff = Number((last - first).toFixed(1));
    const percent = Number(((diff / (first || 1)) * 100).toFixed(1));
    return { diff, percent };
  }, [filteredMetrics, primaryMetricKey]);

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs">
      {/* Chart Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="font-bold text-slate-900 text-base">
              Biểu Đồ Xu Hướng Chuỗi Thời Gian
            </h3>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              SRS 2.3 Analytics
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Trực quan hóa 4 chỉ số cốt lõi và xu hướng biến động thể trạng qua các kỳ đo
          </p>
        </div>

        {/* Time Filters */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">
          {(['1M', '3M', '6M', '1Y', 'ALL'] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                timeRange === r
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {r === '1M' ? '1 Tháng' : r === '3M' ? '3 Tháng' : r === '6M' ? '6 Tháng' : r === '1Y' ? '1 Năm' : 'Tất Cả'}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Selector Pills */}
      <div className="pt-3 pb-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-400 font-medium mr-1 flex items-center">
          <Layers className="w-3.5 h-3.5 mr-1" />
          Chỉ số:
        </span>
        {AVAILABLE_METRICS.map((m) => {
          const isActive = activeMetricKeys.includes(m.key);
          const isPrimary = activeMetricKeys[0] === m.key;
          return (
            <button
              key={m.key}
              onClick={() => {
                // If clicked, bring to first spot or toggle
                if (isPrimary) return;
                setActiveMetricKeys([m.key, ...activeMetricKeys.filter((k) => k !== m.key)]);
              }}
              className={`text-xs px-2.5 py-1 rounded-lg font-semibold border transition-all flex items-center space-x-1.5 ${
                isPrimary
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : isActive
                  ? 'bg-slate-100 text-slate-800 border-slate-300'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: m.stroke }}
              ></span>
              <span>{m.label}</span>
              {isPrimary && (
                <span className="text-[10px] bg-white/20 px-1 py-0.2 rounded font-normal">
                  Chính
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Stat Summary Bar for Primary Metric */}
      {filteredMetrics.length > 0 && (
        <div className="my-2 p-3 rounded-xl bg-slate-50/80 border border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-500">Chỉ số đang vẽ:</span>
            <span className="font-bold text-slate-900">{primaryConfig.label}</span>
            <span className="text-slate-400">({primaryConfig.unit})</span>
          </div>

          <div className="flex items-center space-x-4">
            <div>
              <span className="text-slate-400 mr-1.5">Khởi điểm:</span>
              <span className="font-semibold text-slate-800">
                {filteredMetrics[0][primaryMetricKey]} {primaryConfig.unit}
              </span>
            </div>
            <div>
              <span className="text-slate-400 mr-1.5">Mới nhất:</span>
              <span className="font-bold text-emerald-700">
                {filteredMetrics[filteredMetrics.length - 1][primaryMetricKey]} {primaryConfig.unit}
              </span>
            </div>
            {delta && (
              <div className="flex items-center space-x-1">
                <span className="text-slate-400 mr-1">Chênh lệch:</span>
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold ${
                    delta.diff < 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : delta.diff > 0
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {delta.diff < 0 ? (
                    <TrendingDown className="w-3 h-3 mr-0.5" />
                  ) : delta.diff > 0 ? (
                    <TrendingUp className="w-3 h-3 mr-0.5" />
                  ) : (
                    <Minus className="w-3 h-3 mr-0.5" />
                  )}
                  {delta.diff > 0 ? `+${delta.diff}` : delta.diff} {primaryConfig.unit} ({delta.percent}%)
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SVG Chart Container */}
      <div className="relative mt-2 w-full overflow-hidden rounded-xl bg-slate-50/50 border border-slate-100">
        {filteredMetrics.length === 0 ? (
          <div className="py-20 text-center text-xs text-slate-400">
            Chưa có dữ liệu cân đo để dựng biểu đồ
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-64 md:h-72 transition-all select-none"
          >
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={primaryConfig.stroke} stopOpacity="0.25" />
                <stop offset="100%" stopColor={primaryConfig.stroke} stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
              const y = padding.top + pct * chartH;
              const val = Math.round(maxVal - pct * (maxVal - minVal));
              return (
                <g key={i}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke="#e2e8f0"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 3}
                    textAnchor="end"
                    fill="#94a3b8"
                    fontSize="10"
                    fontWeight="500"
                    fontFamily="monospace"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Area Fill */}
            {areaD && <path d={areaD} fill="url(#chartGradient)" />}

            {/* Curve Line */}
            {pathD && (
              <path
                d={pathD}
                fill="none"
                stroke={primaryConfig.stroke}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Data Points */}
            {points.map((pt, i) => (
              <g
                key={i}
                className="cursor-pointer transition-transform duration-150 hover:scale-125"
                onMouseEnter={() =>
                  setHoveredPoint({
                    date: pt.record.date,
                    values: {
                      [primaryConfig.label]: pt.val,
                      'Mỡ nội tạng': pt.record.visceralFat,
                      'Cơ bắp': pt.record.muscleMass,
                      'Vòng eo': pt.record.waist,
                    },
                  })
                }
                onMouseLeave={() => setHoveredPoint(null)}
              >
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="5"
                  fill="white"
                  stroke={primaryConfig.stroke}
                  strokeWidth="2.5"
                />
                <circle cx={pt.x} cy={pt.y} r="2" fill={primaryConfig.stroke} />

                {/* Point Value Badge */}
                <text
                  x={pt.x}
                  y={pt.y - 10}
                  textAnchor="middle"
                  fill="#1e293b"
                  fontSize="10"
                  fontWeight="bold"
                >
                  {pt.val}
                </text>

                {/* Date Label on X Axis */}
                <text
                  x={pt.x}
                  y={height - padding.bottom + 18}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="9.5"
                  fontWeight="500"
                >
                  {pt.record.date.slice(5)}
                </text>
              </g>
            ))}
          </svg>
        )}

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && (
          <div className="absolute top-3 right-4 bg-slate-900/95 text-white p-2.5 rounded-xl text-xs shadow-lg backdrop-blur-xs border border-slate-700 animate-in fade-in duration-100 z-10">
            <div className="flex items-center space-x-1.5 text-slate-300 border-b border-slate-700 pb-1 mb-1 font-semibold">
              <Calendar className="w-3 h-3 text-emerald-400" />
              <span>Ngày đo: {hoveredPoint.date}</span>
            </div>
            <div className="space-y-0.5">
              {Object.entries(hoveredPoint.values).map(([k, v]) => (
                <div key={k} className="flex justify-between space-x-3 text-[11px]">
                  <span className="text-slate-400">{k}:</span>
                  <span className="font-bold text-white">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Grid of 4 Core Metrics Mini Status */}
      {filteredMetrics.length > 0 && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            {
              title: 'Cân nặng',
              val: `${filteredMetrics[filteredMetrics.length - 1].weight} kg`,
              desc: 'Tổng thể trọng',
              color: 'border-l-indigo-500',
            },
            {
              title: 'Mỡ nội tạng',
              val: `Cấp ${filteredMetrics[filteredMetrics.length - 1].visceralFat}`,
              desc: filteredMetrics[filteredMetrics.length - 1].visceralFat >= 10 ? 'Nguy cơ cao ⚠️' : 'Mức an toàn ✅',
              color: filteredMetrics[filteredMetrics.length - 1].visceralFat >= 10 ? 'border-l-rose-500' : 'border-l-emerald-500',
            },
            {
              title: 'Trọng lượng cơ',
              val: `${filteredMetrics[filteredMetrics.length - 1].muscleMass} kg`,
              desc: 'Khối cơ xương & trơn',
              color: 'border-l-emerald-500',
            },
            {
              title: 'Vòng eo',
              val: `${filteredMetrics[filteredMetrics.length - 1].waist} cm`,
              desc: 'Mốc đo chuẩn',
              color: 'border-l-amber-500',
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className={`p-2.5 bg-slate-50/70 rounded-xl border border-slate-200/80 border-l-4 ${item.color}`}
            >
              <div className="text-[11px] text-slate-500 font-medium">{item.title}</div>
              <div className="text-sm font-extrabold text-slate-900 mt-0.5">{item.val}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{item.desc}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
