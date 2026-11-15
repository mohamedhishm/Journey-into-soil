import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import type { AgentAnswer, AnalysisResult } from "../../scene/types";
import { useStore } from "../../state/store";

/**
 * Ask the assistant about this result. Answers are grounded: the backend retrieves passages from
 * the bundled agricultural sources and, for questions about this field, reads the engine output.
 * The answer text is never used to produce or change a score.
 */
export function AgentPanel({ result }: { result: AnalysisResult }) {
  const { t } = useTranslation();
  const { lang } = useStore();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AgentAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const submit = async () => {
    const text = question.trim();
    if (!text || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      setAnswer(await api.ask(text, result.input, result.request_id));
    } catch {
      setAnswer(null);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel">
      <h3>{t("ui.agent_title")}</h3>
      <label className="field">
        <span>{t("ui.agent_ask")}</span>
        <input
          type="text"
          value={question}
          placeholder={t("ui.agent_placeholder")}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submit();
          }}
        />
      </label>
      <button className="primary" disabled={busy || !question.trim()} onClick={() => void submit()}>
        {t("ui.agent_ask")}
      </button>
      {failed && <p className="error" role="alert">{t("ui.agent_error")}</p>}
      {answer && (
        <div className="block">
          <h4>
            {t("ui.agent_answer")}{" "}
            <span className="badge">
              {answer.scope === "site_specific"
                ? t("ui.agent_scope_site")
                : answer.scope === "general"
                  ? t("ui.agent_scope_general")
                  : t("ui.agent_scope_insufficient")}
            </span>
          </h4>
          <p dir={lang === "ar" ? "rtl" : "ltr"}>{answer.answer.text}</p>
          {answer.citations.length > 0 && (
            <>
              <h4>{t("ui.agent_citations")}</h4>
              <ul>
                {answer.citations.map((citation, index) => (
                  <li key={`${citation.passage_id ?? citation.key ?? index}`}>
                    <span className="src">{citation.source}</span>
                    {citation.passage_id ? ` ${citation.passage_id}` : ""}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
