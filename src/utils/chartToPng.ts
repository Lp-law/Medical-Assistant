/**
 * Renders a simple bar chart to PNG (Word-friendly size).
 * Uses Canvas 2D only; no Chart.js.
 */

import type { ExportLang } from './exportForWordI18n';
import { getLabels, formatNumber } from './exportForWordI18n';

export type ChartData = {
  /** Scenario labels: e.g. Claimant, Defendant, Average */
  labels: [string, string, string];
  /** Values "before" reductions (net) – optional; if present, show Before vs After */
  seriesBefore: [number, number, number];
  /** Values "after" reductions */
  seriesAfter: [number, number, number];
};

const WIDTH = 900;
const HEIGHT = 500;
const PADDING = { top: 50, right: 50, bottom: 80, left: 60 };
const BAR_GAP = 12;
const GROUP_WIDTH = 120;

function drawBarChart(
  ctx: CanvasRenderingContext2D,
  data: ChartData,
  lang: ExportLang
): void {
  const L = getLabels(lang);
  const hasBefore = data.seriesBefore.some((v) => v > 0);
  const seriesCount = hasBefore ? 2 : 1;
  const maxVal = Math.max(
    ...data.seriesAfter,
    ...(hasBefore ? data.seriesBefore : [0]),
    1
  );
  const chartWidth = WIDTH - PADDING.left - PADDING.right;
  const chartHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const scale = maxVal > 0 ? chartHeight / maxVal : 0;

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.font = '14px Calibri, Arial, sans-serif';
  ctx.fillStyle = '#333';
  ctx.textAlign = 'center';
  ctx.fillText(L.chartTitle, WIDTH / 2, PADDING.top - 20);

  // Y-axis labels (values)
  ctx.textAlign = 'right';
  ctx.fillStyle = '#555';
  const steps = 5;
  for (let i = 0; i <= steps; i++) {
    const val = (maxVal * (steps - i)) / steps;
    const y = PADDING.top + (chartHeight * i) / steps;
    ctx.fillText(formatNumber(lang, val), PADDING.left - 8, y + 4);
  }

  // Bars
  const colorsBefore = ['#5b7c99', '#94a3b8', '#c4b896'];
  const colorsAfter = ['#0f172a', '#64748b', '#b45309'];
  const groupCenter = (i: number) =>
    PADDING.left + (i + 0.5) * (chartWidth / 3);
  const barWidth = (seriesCount === 2 ? GROUP_WIDTH - BAR_GAP : 80) / 2;

  for (let i = 0; i < 3; i++) {
    const cx = groupCenter(i);
    const label = data.labels[i];
    const beforeVal = data.seriesBefore[i];
    const afterVal = data.seriesAfter[i];

    let x0 = cx - (seriesCount === 2 ? barWidth : 40);
    if (seriesCount === 2 && hasBefore) {
      const hBefore = beforeVal * scale;
      ctx.fillStyle = colorsBefore[i];
      ctx.fillRect(
        x0,
        PADDING.top + chartHeight - hBefore,
        barWidth - 2,
        hBefore
      );
      x0 += barWidth + BAR_GAP;
    }
    const hAfter = afterVal * scale;
    ctx.fillStyle = colorsAfter[i];
    ctx.fillRect(
      x0,
      PADDING.top + chartHeight - hAfter,
      seriesCount === 2 ? barWidth - 2 : 80,
      hAfter
    );

    // X-axis label
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.font = '12px Calibri, Arial, sans-serif';
    ctx.fillText(label, cx, HEIGHT - PADDING.bottom + 20);
  }

  // Legend
  const legendY = HEIGHT - 28;
  ctx.font = '11px Calibri, Arial, sans-serif';
  if (hasBefore) {
    ctx.fillStyle = colorsBefore[0];
    ctx.fillRect(PADDING.left, legendY - 8, 14, 10);
    ctx.fillStyle = '#333';
    ctx.textAlign = 'left';
    ctx.fillText(lang === 'he' ? 'לפני הפחתות' : 'Before reductions', PADDING.left + 20, legendY);
  }
  ctx.fillStyle = colorsAfter[0];
  ctx.fillRect(hasBefore ? PADDING.left + 160 : PADDING.left, legendY - 8, 14, 10);
  ctx.fillStyle = '#333';
  ctx.fillText(lang === 'he' ? 'לאחר הפחתות' : 'After reductions', hasBefore ? PADDING.left + 180 : PADDING.left + 20, legendY);
}

/**
 * Returns a PNG Blob of the bar chart. Uses the same data as the calculator (after/totals).
 */
export function barChartToPngBlob(
  data: ChartData,
  lang: ExportLang
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas 2D not available'));
      return;
    }
    drawBarChart(ctx, data, lang);
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      },
      'image/png',
      1
    );
  });
}
