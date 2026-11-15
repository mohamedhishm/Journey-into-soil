import { useTranslation } from "react-i18next";
import { fmt, msgText } from "../../lib/msg";
import type { AnalysisResult, Strategy } from "../../scene/types";
import { useStore } from "../../state/store";

function Limitations({ keys }: { keys: string[] }) {
  const { t } = useTranslation();
  const { lang } = useStore();
  if (!keys.length) return null;
  return (
    <ul className="hint">
      {keys.map((k) => <li key={k}>{msgText(t, lang, { key: k, params: {} })}</li>)}
    </ul>
  );
}

/**
 * NASA vs Model: observed SMAP surface soil moisture against the simulated top-layer
 * moisture for the selected strategy. Always labelled Indicative.
 */
export function NasaVsModelPanel({ result, strategy }: { result: AnalysisResult; strategy: Strategy }) {
  const { t } = useTranslation();
  const { lang } = useStore();
  const smap = result.nasa_evidence?.smap;
  if (!smap) return null;
  const comparison = smap.comparison?.[strategy.id];

  return (
    <section className="panel">
      <h3>
        {t("ui.nasa_vs_model")} <span className="badge warn">{t("ui.indicative")}</span>
      </h3>
      {smap.status !== "pack" ? (
        <p className="hint">{msgText(t, lang, { key: "smap.missing_pack", params: {} })}</p>
      ) : (
        <>
          <p className="hint">
            <b>{smap.product}</b> v{smap.version} · {smap.depth} · {smap.resolution_km} km
            {smap.n_accepted != null && <> · {t("ui.pairs", { n: fmt(lang, smap.n_accepted) })}</>}
          </p>
          {comparison && comparison.n_pairs > 0 ? (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t("ui.data")}</th>
                      <th>{t("ui.observed")}</th>
                      <th>{t("ui.modeled")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(comparison.pairs ?? []).map((p) => (
                      <tr key={p.date}>
                        <td>{p.date}</td>
                        <td>{fmt(lang, p.observed_m3m3, 3)}</td>
                        <td>{fmt(lang, p.modeled_m3m3, 3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="kpis">
                {t("ui.bias")}: {fmt(lang, comparison.bias_m3m3 ?? 0, 3)} · {t("ui.rmse")}: {fmt(lang, comparison.rmse_m3m3 ?? 0, 3)}
                {comparison.pearson_r != null && <> · {t("ui.correlation")}: {fmt(lang, comparison.pearson_r, 2)}</>}
              </p>
            </>
          ) : (
            <p className="hint">{t("ui.no_overlap")}</p>
          )}
          <p className="hint">{t("ui.smap_depth")}</p>
          {smap.root_zone_available === false && <p className="hint">{t("ui.root_zone_na")}</p>}
          <Limitations keys={smap.limitations ?? []} />
        </>
      )}
    </section>
  );
}

/** NDVI timeline: observed composites against the expected crop calendar. */
export function NdviTimelinePanel({ result }: { result: AnalysisResult }) {
  const { t } = useTranslation();
  const { lang } = useStore();
  const ndvi = result.nasa_evidence?.ndvi;
  if (!ndvi) return null;
  const check = ndvi.timeline_check;
  const items = check?.items ?? [];

  return (
    <section className="panel">
      <h3>
        {t("ui.ndvi_timeline")} <span className="badge warn">{t("ui.indicative")}</span>
      </h3>
      {ndvi.status !== "pack" ? (
        <p className="hint">{msgText(t, lang, { key: "ndvi.missing_pack", params: {} })}</p>
      ) : (
        <>
          <p className="hint">
            <b>{ndvi.product}</b> v{ndvi.version} · {ndvi.resolution_km} km · {ndvi.observations.length} {t("ui.observed_ndvi")}
          </p>
          {check?.basis && (
            <p className="hint">
              {t("ui.ndvi_basis")}:{" "}
              {check.basis.includes("15 km") ? t("ui.ndvi_basis_regional") : t("ui.ndvi_basis_pixel")}
            </p>
          )}
          {!check?.classification_used && <p className="hint">{t("ui.ndvi_not_classified")}</p>}
          {check?.threshold_ndvi != null && (
            <p className="hint">{t("ui.ndvi_threshold")}: {fmt(lang, check.threshold_ndvi, 2)}</p>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("ui.data")}</th>
                  <th>{t("ui.observed_ndvi")}</th>
                  <th>{t("ui.ndvi_expected")}</th>
                  <th>{t("ui.timeline_check")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.start}>
                    <td>{item.start}</td>
                    <td>
                      <span
                        aria-hidden="true"
                        style={{ display: "inline-block", blockSize: 8, inlineSize: `${Math.max(2, Math.round((item.ndvi / 1) * 60))}px`, background: "var(--accent, #4a7)", borderRadius: 2, marginInlineEnd: 6 }}
                      />
                      {fmt(lang, item.ndvi, 2)}
                    </td>
                    <td>
                      {item.expected === "crop"
                        ? `${t("ui.ndvi_expected")}: ${item.expected_crop ? t(`crop.${item.expected_crop}`) : ""}`
                        : t("ui.fallow")}
                    </td>
                    <td>
                      {item.agreement === "ok" && t("ui.ndvi_ok")}
                      {item.agreement === "check" && t("ui.ndvi_check")}
                      {item.agreement === "uncertain" && t("ui.ndvi_uncertain")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Limitations keys={ndvi.limitations ?? []} />
        </>
      )}
    </section>
  );
}
