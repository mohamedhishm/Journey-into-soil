import { useTranslation } from "react-i18next";
import engineEn from "../../i18n/engine.en.json";
import { useStore } from "../../state/store";
import type { AnalysisRequest, Priority, Season } from "../../scene/types";

const CROP_IDS = Object.keys(engineEn)
  .filter((k) => k.startsWith("crop.") && k !== "crop.sugarcane")
  .map((k) => k.slice(5));
const PREV: Record<Season, Season> = { winter: "summer", summer: "winter", nili: "summer" };

export function historySeasons(next: Season): Season[] {
  const out: Season[] = [];
  let s: Season = next;
  for (let i = 0; i < 3; i++) {
    s = PREV[s];
    out.push(s);
  }
  return out;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function FieldForm() {
  const { t } = useTranslation();
  const { request: r, setRequest } = useStore();
  const num = (v: string): number | null => (v.trim() === "" ? null : Number(v));

  const setNext = (next: Season) => {
    const seasons = historySeasons(next);
    setRequest({ next_season: next, history: r.history.map((h, i) => ({ ...h, season: seasons[i] ?? h.season })) });
  };
  const setHistory = (i: number, crop: string) =>
    setRequest({ history: r.history.map((h, k) => (k === i ? { ...h, crop } : h)) });
  const seasons = historySeasons(r.next_season);
  const hist = [0, 1, 2].map((i) => r.history[i] ?? { crop: "", season: seasons[i] });

  return (
    <form className="form" onSubmit={(e) => e.preventDefault()}>
      <fieldset>
        <legend>{t("ui.sec_soil")}</legend>
        <Field label={t("ui.texture")} hint={t("ui.texture_hint")}>
          <select value={r.texture} onChange={(e) => setRequest({ texture: e.target.value as AnalysisRequest["texture"] })}>
            {["sand", "sandy_loam", "loam", "silt_loam", "clay_loam", "clay"].map((x) => (
              <option key={x} value={x}>{t(`texture.${x}`)}</option>
            ))}
          </select>
        </Field>
        <Field label={t("ui.drainage")}>
          <select value={r.drainage} onChange={(e) => setRequest({ drainage: e.target.value as AnalysisRequest["drainage"] })}>
            {["good", "moderate", "poor"].map((x) => <option key={x} value={x}>{t(`ui.drainage_${x}`)}</option>)}
          </select>
        </Field>
        <Field label={t("ui.soil_ec")} hint={t("ui.optional_measured")}>
          <input type="number" min={0} max={40} step={0.1} value={r.soil_ec ?? ""} onChange={(e) => setRequest({ soil_ec: num(e.target.value) })} />
        </Field>
        <Field label={t("ui.ph")} hint={t("ui.optional_measured")}>
          <input type="number" min={4} max={10} step={0.1} value={r.ph ?? ""} onChange={(e) => setRequest({ ph: num(e.target.value) })} />
        </Field>
        <Field label={t("ui.organic_input")}>
          <select value={r.organic_input} onChange={(e) => setRequest({ organic_input: e.target.value as AnalysisRequest["organic_input"] })}>
            {["none", "some", "regular"].map((x) => <option key={x} value={x}>{t(`ui.organic_${x}`)}</option>)}
          </select>
        </Field>
        <Field label={t("ui.residues")}>
          <select value={r.residues} onChange={(e) => setRequest({ residues: e.target.value as AnalysisRequest["residues"] })}>
            {["retained", "burned", "unknown"].map((x) => <option key={x} value={x}>{t(`ui.residues_${x}`)}</option>)}
          </select>
        </Field>
      </fieldset>

      <fieldset>
        <legend>{t("ui.sec_water")}</legend>
        <Field label={t("ui.irrigation")}>
          <select value={r.irrigation} onChange={(e) => setRequest({ irrigation: e.target.value as AnalysisRequest["irrigation"] })}>
            {["flood", "sprinkler", "drip", "none"].map((x) => <option key={x} value={x}>{t(`ui.irrigation_${x}`)}</option>)}
          </select>
        </Field>
        <Field label={t("ui.water_ec")} hint={t("ui.water_ec_hint")}>
          <input type="number" min={0} max={15} step={0.1} value={r.water_ec} onChange={(e) => setRequest({ water_ec: Number(e.target.value) })} />
        </Field>
        <Field label={t("ui.water_availability")}>
          <select value={r.water_availability} onChange={(e) => setRequest({ water_availability: e.target.value as AnalysisRequest["water_availability"] })}>
            {["ample", "limited", "scarce"].map((x) => <option key={x} value={x}>{t(`ui.water_${x}`)}</option>)}
          </select>
        </Field>
        <Field label={t("ui.pest")}>
          <select value={r.pest} onChange={(e) => setRequest({ pest: e.target.value as AnalysisRequest["pest"] })}>
            {["none", "nematodes", "soil_borne", "unknown"].map((x) => <option key={x} value={x}>{t(`ui.pest_${x}`)}</option>)}
          </select>
        </Field>
      </fieldset>

      <fieldset>
        <legend>{t("ui.sec_history")}</legend>
        <Field label={t("ui.next_season")}>
          <select value={r.next_season} onChange={(e) => setNext(e.target.value as Season)}>
            {["winter", "summer", "nili"].map((x) => <option key={x} value={x}>{t(`season.${x}`)}</option>)}
          </select>
        </Field>
        {hist.map((h, i) => (
          <Field key={i} label={`${t(`ui.history_${i}`)} (${t(`season.${seasons[i]}`)})`}>
            <select value={h.crop} onChange={(e) => setHistory(i, e.target.value)}>
              {CROP_IDS.map((id) => <option key={id} value={id}>{t(`crop.${id}`)}</option>)}
            </select>
          </Field>
        ))}
      </fieldset>

      <fieldset>
        <legend>{t("ui.sec_priorities")}</legend>
        {(["water", "soil_health", "income", "risk"] as Priority[]).map((p) => (
          <Field key={p} label={t(`ui.prio_${p}`)}>
            <input type="range" min={0} max={5} step={0.5} value={r.priorities[p]}
              onChange={(e) => setRequest({ priorities: { ...r.priorities, [p]: Number(e.target.value) } })} />
          </Field>
        ))}
      </fieldset>
    </form>
  );
}
