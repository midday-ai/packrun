"use client";

interface SparklineProps {
  /** Array of numeric values to plot */
  data: number[];
  /** Width of the SVG */
  width?: number;
  /** Height of the SVG */
  height?: number;
  /** Stroke color */
  strokeColor?: string;
  /** Stroke width */
  strokeWidth?: number;
  /** Optional fill color (gradient from line to bottom) */
  fillColor?: string;
  /** Additional className for the SVG */
  className?: string;
}

/**
 * Pure SVG sparkline component - no external dependencies
 */
export function Sparkline({
  data,
  width = 120,
  height = 32,
  strokeColor = "#666",
  strokeWidth = 1.5,
  fillColor,
  className = "",
}: SparklineProps) {
  // Always render SVG with fixed dimensions to prevent layout shift
  if (!data || data.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={className}
        aria-hidden="true"
      />
    );
  }

  // Calculate min/max for scaling
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1; // Avoid division by zero

  // Add padding to prevent clipping at edges
  const paddingX = 2;
  const paddingY = 4;
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingY * 2;

  // Generate points for the polyline
  const points = data.map((value, index) => {
    const x = paddingX + (index / (data.length - 1)) * plotWidth;
    const y = paddingY + plotHeight - ((value - min) / range) * plotHeight;
    return `${x},${y}`;
  });

  const polylinePoints = points.join(" ");

  // Generate fill path (area under the curve)
  const fillPath = fillColor
    ? `M ${paddingX},${height - paddingY} L ${points.join(" L ")} L ${width - paddingX},${height - paddingY} Z`
    : null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
    >
      {/* Diagonal line pattern for fill */}
      {fillColor && (
        <defs>
          <pattern
            id="diagonalHatch"
            patternUnits="userSpaceOnUse"
            width="2"
            height="2"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="2" stroke="#fff" strokeWidth="0.5" opacity="0.5" />
          </pattern>
        </defs>
      )}

      {/* Hatched fill area */}
      {fillPath && <path d={fillPath} fill="url(#diagonalHatch)" />}

      {/* Main line */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
