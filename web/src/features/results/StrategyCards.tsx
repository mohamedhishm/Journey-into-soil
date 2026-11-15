import { useTranslation } from "react-i18next";
import { fmt } from "../../lib/msg";
import type { AnalysisResult, Priority } from "../../scene/types";
import { useStore } from "../../state/store";

const PRIOS: Priority[] = ["water", "soil_health", "income", "risk"];

export function StrategyCards({ result }: { result: AnalysisResult }) {
  const { t } = useTranslation();
  const { strategyId, setStrategy, lang } = useStore();

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = (idx + 1) % result.strategies.length;
      setStrategy(result.strategies[next].id);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = (idx - 1 + result.strategies.length) % result.strategies.length;
      setStrategy(result.strategies[prev].id);
    }
  };

  return (
    <div className="cards" role="tablist" aria-label={t("ui.strategies")}>
      {result.strategies.map((s, idx) => (
        <button
          key={s.id}
          role="tab"
          aria-selected={strategyId === s.id}
          tabIndex={strategyId === s.id ? 0 : -1}
          className={`card ${strategyId === s.id ? "on" : ""}`}
          onClick={() => setStrategy(s.id)}
          onKeyDown={(e) => handleKeyDown(e, idx)}
        >
          <h3>{t(s.label_key)}</h3>
          {s.archetype !== "existing" && <span className="badge">{t(`priority.${s.archetype}`)}</span>}
          <ol className="seq">
            {s.seasons.map((p, i) => (
              <li key={i}>
                <small>{t(`season.${p.season}`)}</small>
                <b>{p.crop ? t(`crop.${p.crop}`) : t("ui.fallow")}</b>
              </li>
            ))}
          </ol>
          <div className="sbars">
            {PRIOS.map((p) => (
              <div key={p} className="sbar" title={`${t(`ui.prio_${p}`)}: ${fmt(lang, s.scores[p] * 100)}%`}>
                <span>{t(`ui.prio_${p}`)}</span>
                <i><b style={{ inlineSize: `${Math.round(s.scores[p] * 100)}%` }} /></i>
              </div>
            ))}
          </div>
          <p className="kpis">
            {t("ui.kpi_water", { mm: fmt(lang, s.indicators.irrigation_mm) })} · {t("ui.kpi_bare", { days: fmt(lang, s.indicators.bare_days) })}
          </p>
          <span className={`badge conf-${s.confidence.level}`}>{t("ui.confidence", { level: t(`ui.level_${s.confidence.level}`) })}</span>
        </button>
      ))}
      {result.existing_rank && result.candidates_evaluated ? (
        <p className="rank">{t("ui.existing_rank", { rank: fmt(lang, result.existing_rank), n: fmt(lang, result.candidates_evaluated) })}</p>
      ) : null}
    </div>
  );
}
