import { useRef, useEffect, useCallback } from "react";
import { useUIStore } from "../stores";

const RULER_SIZE = 24;
const RULER_BG = "#2a2a2a";
const RULER_TEXT = "#888888";
const RULER_TICK = "#555555";
const RULER_FONT = "9px Inter, system-ui, sans-serif";

interface RulerProps {
  orientation: "horizontal" | "vertical";
}

function getTickInterval(zoom: number): number {
  const base = 100;
  const scaled = base / zoom;
  const magnitude = Math.pow(10, Math.floor(Math.log10(scaled)));
  const normalized = scaled / magnitude;
  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

export function Ruler({ orientation }: RulerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zoom = useUIStore((s) => s.zoom);
  const panOffset = useUIStore((s) => s.panOffset);

  const draw = useCallback(
    (canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      // Background
      ctx.fillStyle = RULER_BG;
      ctx.fillRect(0, 0, width, height);

      const tickInterval = getTickInterval(zoom);
      const subDivisions = 5;
      const subTickInterval = tickInterval / subDivisions;

      ctx.fillStyle = RULER_TEXT;
      ctx.font = RULER_FONT;
      ctx.strokeStyle = RULER_TICK;
      ctx.lineWidth = 0.5;

      const isHorizontal = orientation === "horizontal";
      const length = isHorizontal ? width : height;
      const offset = isHorizontal ? panOffset.x : panOffset.y;
      // Calculate start position in canvas coordinates
      const startCanvas = -offset / zoom;
      const startTick =
        Math.floor(startCanvas / subTickInterval) * subTickInterval;
      const endCanvas = (length - offset) / zoom;

      for (let pos = startTick; pos <= endCanvas; pos += subTickInterval) {
        const screenPos = pos * zoom + offset;
        if (screenPos < 0 || screenPos > length) continue;

        const isMajor = Math.abs(pos % tickInterval) < 0.001;
        const tickLength = isMajor ? RULER_SIZE * 0.7 : RULER_SIZE * 0.35;

        ctx.beginPath();
        if (isHorizontal) {
          ctx.moveTo(screenPos, RULER_SIZE);
          ctx.lineTo(screenPos, RULER_SIZE - tickLength);
        } else {
          ctx.moveTo(RULER_SIZE, screenPos);
          ctx.lineTo(RULER_SIZE - tickLength, screenPos);
        }
        ctx.stroke();

        if (isMajor) {
          const label = Math.round(pos).toString();
          if (isHorizontal) {
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.fillText(label, screenPos + 2, 2);
          } else {
            ctx.save();
            ctx.translate(2, screenPos + 2);
            ctx.rotate(-Math.PI / 2);
            ctx.textAlign = "right";
            ctx.textBaseline = "top";
            ctx.fillText(label, 0, 0);
            ctx.restore();
          }
        }
      }

      // Bottom/right border line
      ctx.strokeStyle = RULER_TICK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (isHorizontal) {
        ctx.moveTo(0, RULER_SIZE - 0.5);
        ctx.lineTo(width, RULER_SIZE - 0.5);
      } else {
        ctx.moveTo(RULER_SIZE - 0.5, 0);
        ctx.lineTo(RULER_SIZE - 0.5, height);
      }
      ctx.stroke();
    },
    [zoom, panOffset, orientation],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    draw(canvas);

    const resizeObserver = new ResizeObserver(() => {
      draw(canvas);
    });
    resizeObserver.observe(canvas);

    return () => resizeObserver.disconnect();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={
        orientation === "horizontal"
          ? `h-[${RULER_SIZE}px] w-full`
          : `w-[${RULER_SIZE}px] h-full`
      }
      style={
        orientation === "horizontal"
          ? { height: RULER_SIZE, width: "100%" }
          : { width: RULER_SIZE, height: "100%" }
      }
      data-testid={`ruler-${orientation}`}
    />
  );
}

export function RulerCorner() {
  return (
    <div
      className="flex-shrink-0"
      style={{
        width: RULER_SIZE,
        height: RULER_SIZE,
        backgroundColor: RULER_BG,
      }}
      data-testid="ruler-corner"
    />
  );
}
