import { useTranslation } from "react-i18next";
import { msgText } from "../../lib/msg";
import type { AnalysisResult, Msg, Strategy } from "../../scene/types";
import { useStore } from "../../state/store";

function Section({ title, items, tone }: { title: string; items: Msg[]; tone?: "warn" | "good" }) {
  const { t } = useTranslation();
  const { lang } = useStore();
  if (!items.length) return null;
  return (
    <section className={`block ${tone ?? ""}`}>
      <h4>{title}</h4>
      <ul>{items.map((m, i) => <li key={i}>{msgText(t, lang, m)}</li>)}</ul>
    </section>
  );
}

export function EvidencePanel({ result, strategy }: { result: AnalysisResult; strategy: Strategy }) {
  const { t } = useTranslation();
  const { lang } = useStore();
  return (
    <div className="evidence">
      <Section title={t("ui.why")} items={strategy.why} tone="good" />
      <Section title={t("ui.benefits")} items={strategy.benefits} tone="good" />
      <section className="block">
        <h4>{t("ui.evidence")}</h4>
        <ul>
          {strategy.evidence.map((e, i) => (
            <li key={i}>
              <span className="src">{t(`ui.src.${e.source}`)}</span> {msgText(t, lang, e)}
            </li>
          ))}
        </ul>
      </section>
      <Section title={t("ui.gaps")} items={strategy.gaps} tone="warn" />
      <Section title={t("ui.risks")} items={strategy.risks} tone="warn" />
      <section className="block">
        <h4>{t("ui.confidence_title", { level: t(`ui.level_${strategy.confidence.level}`) })}</h4>
        <ul>{strategy.confidence.factors.map((m, i) => <li key={i}>{msgText(t, lang, m)}</li>)}</ul>
      </section>
      <section className="block review">
        <h4>{t("ui.review_title")}</h4>
        <ul>{result.needs_local_review.map((k) => <li key={k}>{t(k)}</li>)}</ul>
      </section>
    </div>
  );
}
