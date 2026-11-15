import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AnalysisResult, Strategy } from "../../scene/types";
import { useStore } from "../../state/store";
import "./Timeline.css";

const W = 800;
const H = 200;
const PAD_T = 24;
const PAD_B = 22;

export function Timeline({ result, strategy }: { result: AnalysisResult; strategy: Strategy }) {
  const { t } = useTranslation();
  const { dayT, setDayT } = useStore();
  const ref = useRef<SVGSVGElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  const n = result.timeline.days;
  const x = (i: number) => (i / Math.max(n - 1, 1)) * W;
  const idxOf = (iso: string) => Math.round((Date.parse(iso) - Date.parse(result.timeline.start)) / 86400000);
  const plotH = H - PAD_T - PAD_B;
  const y01 = (v: number) => H - PAD_B - Math.max(0, Math.min(1, v)) * plotH;
  const maxRain = Math.max(1, ...result.climate.rain);
  const maxEt = Math.max(1, ...result.climate.et0);

  const line = (arr: number[], scale: number) =>
    arr.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y01(v / scale).toFixed(1)}`).join("");
  const canopyPath =
    `M0,${y01(0)}` + strategy.sim.canopy.map((v, i) => `L${x(i).toFixed(1)},${y01(v * 0.5).toFixed(1)}`).join("") + `L${W},${y01(0)}Z`;

  // Animation Playback Engine
  useEffect(() => {
    if (!isPlaying) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = null;
      lastTimeRef.current = null;
      return;
    }

    const durationMs = 12000; // 12s full rotation playback
    const onFrame = (now: number) => {
      if (lastTimeRef.current !== null) {
        const delta = now - lastTimeRef.current;
        const currentT = useStore.getState().dayT;
        const next = currentT + delta / durationMs;
        if (next >= 1) {
          setDayT(1);
          setIsPlaying(false);
          return;
        }
        setDayT(next);
      }
      lastTimeRef.current = now;
      animRef.current = requestAnimationFrame(onFrame);
    };

    animRef.current = requestAnimationFrame(onFrame);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, setDayT]);

  const scrub = (e: React.PointerEvent) => {
    if (!ref.current || (e.type === "pointermove" && e.buttons === 0)) return;
    const r = ref.current.getBoundingClientRect();
    setIsPlaying(false);
    setDayT(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (n <= 1) return;
    const step = 1 / (n - 1);
    if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      setIsPlaying((prev) => !prev);
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      setIsPlaying(false);
      setDayT(Math.min(1, dayT + step));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      setIsPlaying(false);
      setDayT(Math.max(0, dayT - step));
    } else if (e.key === "PageDown") {
      e.preventDefault();
      setIsPlaying(false);
      setDayT(Math.min(1, dayT + step * 10));
    } else if (e.key === "PageUp") {
      e.preventDefault();
      setIsPlaying(false);
      setDayT(Math.max(0, dayT - step * 10));
    } else if (e.key === "Home") {
      e.preventDefault();
      setIsPlaying(false);
      setDayT(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setIsPlaying(false);
      setDayT(1);
    }
  };

  const day = Math.round(dayT * (n - 1));
  const currentDate = result.climate.dates[day] || "";
  const currentTmax = result.climate.tmax[day] ?? 0;
  const currentRain = result.climate.rain[day] ?? 0;

  const jumpToCrop = (sowIso: string) => {
    if (!sowIso) return;
    setIsPlaying(false);
    const idx = idxOf(sowIso);
    const tVal = Math.max(0, Math.min(1, idx / Math.max(n - 1, 1)));
    setDayT(tVal);
  };

  return (
    <div className="timeline-console" dir="ltr">
      {/* 1. Header Toolbar with Playback Controls and Season Pills */}
      <div className="timeline-header-bar">
        {/* Playback Controls */}
        <div className="timeline-controls" role="toolbar" aria-label={t("ui.timeline_label")}>
          <button
            type="button"
            className="tl-ctrl-btn"
            onClick={() => {
              setIsPlaying(false);
              setDayT(0);
            }}
            title={t("ui.timeline_reset", "Reset to Start")}
            aria-label={t("ui.timeline_reset", "Reset to Start")}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="19 20 9 12 19 4 19 20" />
              <line x1="5" y1="4" x2="5" y2="20" />
            </svg>
          </button>

          <button
            type="button"
            className="tl-ctrl-btn"
            onClick={() => {
              setIsPlaying(false);
              setDayT(Math.max(0, dayT - 1 / Math.max(n - 1, 1)));
            }}
            title={t("ui.timeline_prev_day", "Previous Day")}
            aria-label={t("ui.timeline_prev_day", "Previous Day")}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <button
            type="button"
            className={`tl-ctrl-btn primary ${isPlaying ? "playing" : ""}`}
            onClick={() => {
              if (dayT >= 1) setDayT(0);
              setIsPlaying((prev) => !prev);
            }}
            title={isPlaying ? t("ui.timeline_pause", "Pause") : t("ui.timeline_play", "Play")}
            aria-label={isPlaying ? t("ui.timeline_pause", "Pause") : t("ui.timeline_play", "Play")}
          >
            {isPlaying ? (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                <polygon points="6 4 20 12 6 20 6 4" />
              </svg>
            )}
          </button>

          <button
            type="button"
            className="tl-ctrl-btn"
            onClick={() => {
              setIsPlaying(false);
              setDayT(Math.min(1, dayT + 1 / Math.max(n - 1, 1)));
            }}
            title={t("ui.timeline_next_day", "Next Day")}
            aria-label={t("ui.timeline_next_day", "Next Day")}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Crop Rotation Season Jump Pills */}
        <div className="timeline-season-pills" role="tablist" aria-label={t("ui.kpi_succession")}>
          {strategy.seasons.filter((s) => s.crop && s.sow_date && s.harvest_date).map((s) => {
            const startIdx = idxOf(s.sow_date as string);
            const endIdx = idxOf(s.harvest_date as string);
            const isActive = day >= startIdx && day <= endIdx;
            return (
              <button
                key={s.sow_date}
                type="button"
                className={`season-jump-pill ${isActive ? "active" : ""}`}
                onClick={() => jumpToCrop(s.sow_date as string)}
                title={`${t(`crop.${s.crop}`)} (${s.sow_date} – ${s.harvest_date})`}
              >
                <span className="season-pill-dot" />
                <span>{t(`crop.${s.crop}`)}</span>
              </button>
            );
          })}
        </div>

        {/* Current Day Telemetry Badge */}
        <div className="timeline-day-badge">
          <span className="badge-date">{currentDate}</span>
          <span className="badge-sep">·</span>
          <span className="badge-metrics">
            {currentTmax}°C · {currentRain} mm rain
            {strategy.sim.irrigation_mm[day] > 0 && ` · ${strategy.sim.irrigation_mm[day]} mm irr`}
          </span>
        </div>
      </div>

      {/* 2. Interactive SVG Timeline Canvas */}
      <div className="timeline-svg-wrap">
        <svg
          ref={ref}
          viewBox={`0 0 ${W} ${H}`}
          role="slider"
          tabIndex={0}
          aria-label={t("ui.timeline_label")}
          aria-valuenow={day + 1}
          aria-valuemin={1}
          aria-valuemax={n}
          aria-valuetext={`${currentDate}: ${t("ui.tmax")} ${currentTmax}°C, ${t("ui.rain")} ${currentRain} mm`}
          onKeyDown={handleKeyDown}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            scrub(e);
          }}
          onPointerMove={scrub}
        >
          <defs>
            <pattern id="bare-pattern" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="rgba(245, 158, 11, 0.08)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(245, 158, 11, 0.35)" strokeWidth="1.5" />
            </pattern>
          </defs>

          {/* Bare Field Periods */}
          {strategy.bare_periods.map((b) => (
            <rect
              key={b.start}
              x={x(idxOf(b.start))}
              width={Math.max(2, x(idxOf(b.end)) - x(idxOf(b.start)))}
              y={PAD_T}
              height={plotH}
              fill="url(#bare-pattern)"
            />
          ))}

          {/* Cropping Season Bands */}
          {strategy.seasons.filter((s) => s.crop && s.sow_date && s.harvest_date).map((s) => {
            const a = x(idxOf(s.sow_date as string));
            const b = x(idxOf(s.harvest_date as string));
            return (
              <g key={s.sow_date}>
                <rect x={a} width={b - a} y={PAD_T} height={plotH} fill="rgba(16, 185, 129, 0.12)" />
                <text x={(a + b) / 2} y={15} textAnchor="middle" className="tl-label">
                  {t(`crop.${s.crop}`)}
                </text>
              </g>
            );
          })}

          {/* Canopy Growth Envelope */}
          <path d={canopyPath} fill="rgba(16, 185, 129, 0.2)" />

          {/* Rainfall Spikes */}
          {result.climate.rain.map((v, i) => v > 0 && (
            <line
              key={i}
              x1={x(i)}
              x2={x(i)}
              y1={y01(0)}
              y2={y01((v / maxRain) * 0.4)}
              stroke="#38bdf8"
              strokeWidth="2"
            />
          ))}

          {/* ET0 Reference Evapotranspiration Line */}
          <path d={line(result.climate.et0, maxEt)} fill="none" stroke="#f59e0b" strokeWidth="1.4" opacity="0.8" />

          {/* Simulated Soil Moisture Horizons */}
          <path d={line(strategy.sim.moisture[0], 1.3)} fill="none" stroke="#10b981" strokeWidth="1.8" />
          <path d={line(strategy.sim.moisture[1], 1.3)} fill="none" stroke="#0ea5e9" strokeWidth="1.8" strokeDasharray="4 3" />

          {/* Active Day Scrubber Needle */}
          <line x1={x(day)} x2={x(day)} y1={PAD_T - 4} y2={H - PAD_B} stroke="#10b981" strokeWidth="2.5" />
          <circle cx={x(day)} cy={PAD_T - 4} r="5" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />

          {/* Start and End Date Labels */}
          <text x="4" y={H - 6} className="tl-axis">{result.timeline.start}</text>
          <text x={W - 4} y={H - 6} textAnchor="end" className="tl-axis">{result.timeline.end}</text>
        </svg>
      </div>

      {/* 3. Compact Legend */}
      <ul className="timeline-legend" aria-label={t("ui.data")}>
        <li>
          <span className="legend-chip" style={{ background: "#10b981" }} />
          <span>{t("ui.leg_moist0")}</span>
        </li>
        <li>
          <span className="legend-chip dashed" style={{ borderColor: "#0ea5e9" }} />
          <span>{t("ui.leg_moist1")}</span>
        </li>
        <li>
          <span className="legend-chip" style={{ background: "#f59e0b" }} />
          <span>{t("ui.leg_et0")}</span>
        </li>
        <li>
          <span className="legend-chip" style={{ background: "#38bdf8" }} />
          <span>{t("ui.leg_rain")}</span>
        </li>
        <li>
          <span className="legend-chip bare-hatch" />
          <span>{t("ui.leg_bare")}</span>
        </li>
      </ul>
    </div>
  );
}
