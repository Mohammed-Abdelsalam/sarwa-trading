import { chartGeometry, nearestPointIndex } from '../src/chart';

describe('chartGeometry', () => {
  it('maps values across the full width with the highest value at the top', () => {
    const { line, points } = chartGeometry([1, 2, 3], 60, 26);
    expect(line).toBe('M0.0 24.0L30.0 13.0L60.0 2.0');
    expect(points.map((p) => p.value)).toEqual([1, 2, 3]);
  });

  it('closes the area path along the bottom edge', () => {
    expect(chartGeometry([1, 2], 10, 10).area.endsWith('L10 10L0 10Z')).toBe(true);
  });

  it('returns empty geometry when there are fewer than two values', () => {
    expect(chartGeometry([5], 60, 26)).toEqual({ line: '', area: '', points: [] });
  });

  it('draws a flat series in the middle instead of dividing by zero', () => {
    expect(chartGeometry([3, 3], 10, 10).points.every((p) => Number.isFinite(p.y))).toBe(true);
  });
});

describe('nearestPointIndex', () => {
  const { points } = chartGeometry([1, 2, 3, 4, 5], 100, 50);

  it('snaps a touch position to the closest point and clamps at the edges', () => {
    expect(nearestPointIndex(points, 48)).toBe(2);
    expect(nearestPointIndex(points, -20)).toBe(0);
    expect(nearestPointIndex(points, 500)).toBe(4);
  });
});
