export interface ChartPoint {
  x: number;
  y: number;
  value: number;
}

export interface ChartGeometry {
  line: string;
  area: string;
  points: ChartPoint[];
}

export function chartGeometry(
  values: readonly number[],
  width: number,
  height: number,
  padding = 2,
): ChartGeometry {
  if (values.length < 2) return { line: '', area: '', points: [] };
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  const points = values.map((value, i) => ({
    x: (i / (values.length - 1)) * width,
    y: padding + (1 - (value - min) / range) * (height - padding * 2),
    value,
  }));
  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join('');
  return { line, area: `${line}L${width} ${height}L0 ${height}Z`, points };
}

export function nearestPointIndex(points: readonly ChartPoint[], x: number): number {
  if (points.length === 0) return -1;
  const last = points.at(-1)?.x ?? 0;
  const ratio = Math.min(Math.max(x / (last || 1), 0), 1);
  return Math.round(ratio * (points.length - 1));
}
