import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useStore } from "../../state/store";

interface SamplePrompt {
  id: string;
  en: { title: string; user: string; ai: string };
  ar: { title: string; user: string; ai: string };
}

const SAMPLE_PROMPTS: SamplePrompt[] = [
  {
    id: "q1",
    en: {
      title: "Wheat → Chickpea in saline soil",
      user: "Why was chickpea recommended after wheat in Beheira with 2.8 dS/m canal water?",
      ai: "Agronomic rationale: In Beheira's clay-loam soil, back-to-back cereal crops heavily exhaust available root-zone nitrogen. Chickpea fixes atmospheric nitrogen (approx. 40–60 kg N/ha), revitalizing soil biology.\n\nSalinity buffer: Chickpea handles moderate root ECe thresholds up to 1.7 dS/m. With 2.8 dS/m irrigation water, our FAO-56 simulation mandates a 12% leaching fraction during winter rains to flush accumulated salts below the 45 cm root perimeter.",
    },
    ar: {
      title: "قمح ← حمص في تربة مالحة",
      user: "لماذا تم ترشيح محصول الحمص بعد القمح في البحيرة مع ملوحة مياه 2.8 ديسيمنز؟",
      ai: "الأساس الزراعي: في أراضي البحيرة الطميية، يؤدي تكرار زراعة الحبوب إلى استنزاف نيتروجين منطقة الجذور. يثبت الحمص النيتروجين الجوي بمعدل 40-60 كجم/هكتار مما يستعيد خصوبة التربة.\n\nمقاومة الملوحة: يتحمل الحمص ملوحة جذور حتى 1.7 ديسيمنز/م. ولمياه ري بملوحة 2.8، توصي محاكاة FAO-56 بنسبة غسيل 12% مع أمطار الشتاء لتصريف الأملاح تحت عمق 45 سم.",
    },
  },
  {
    id: "q2",
    en: {
      title: "Managing 2.8 dS/m irrigation water",
      user: "How do I manage high water salinity (2.8 dS/m) without burning sensitive crops?",
      ai: "Leaching fraction protocol: Calculate leaching requirement: LR = ECw / (5 * ECe_target - ECw). For moderate crops, apply an extra 15% water depth during pre-sowing irrigation.\n\nBed morphology: Plant seeds on the shoulder of double-row furrows rather than the top ridge, where evaporating salts concentrate heavily.",
    },
    ar: {
      title: "إدارة مياه ري بملوحة 2.8 ديسيمنز",
      user: "كيف أدير ملوحة مياه ري مرتفعة (2.8 ديسيمنز) لتجنب حرق المحاصيل الحساسة؟",
      ai: "معادلة نسبة الغسيل: يتم حساب احتياج الغسيل (LR = ECw / (5 * ECe - ECw)). للمحاصيل متوسطة التحمل، أضف 15% زيادة في عمق ريّة الزراعة.\n\nهندسة الخطوط: ازرع البذور على أكتاف المصاطب بدلاً من قمة الخط حيث تتجمع الأملاح المتبخرة بكثافة شديدة.",
    },
  },
  {
    id: "q3",
    en: {
      title: "NASA POWER evapotranspiration in irrigation",
      user: "How do NASA POWER daily streams improve my farm's irrigation scheduling?",
      ai: "Real-time evaporative demand: NASA POWER delivers daily solar irradiance (ALLSKY_SFC_SW_DWN), vapor pressure deficit, and wind speed. Our engine computes daily FAO-56 Penman-Monteith reference ET0.\n\nRoot-zone balance: Instead of fixed interval watering, irrigation intervals flex with actual atmospheric thirst, conserving 18–25% canal water across Egyptian summer cycles.",
    },
    ar: {
      title: "بيانات ناسا والتبخر-نتح في جدولة الري",
      user: "كيف تسهم بيانات NASA POWER اليومية في ضبط مواعيد ري حقلي بدقة؟",
      ai: "حساب الطلب التبخري الفعلي: توفر ناسا بيانات الإشعاع الشمسي اليومي، والرطوبة النسبية، وسرعة الرياح. يحسب محركنا التبخر-نتح المرجعي اليومي بدقة وفق معادلة بينمان-مونتيث.\n\nميزان منطقة الجذور: بدلاً من الري بمواعيد ثابتة، يتكيف جدول الري مع الاحتياج الجوي الفعلي، مما يوفر 18–25% من مياه الترع صيفاً.",
    },
  },
];

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  grounded?: boolean;
}

export function CropTalkSection() {
  const { t } = useTranslation();
  const { lang } = useStore();
  const isAr = lang === "ar";

  const initialPrompt = SAMPLE_PROMPTS[0][isAr ? "ar" : "en"];
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "init-u", sender: "user", text: initialPrompt.user },
    { id: "init-a", sender: "ai", text: initialPrompt.ai, grounded: true },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelectSample = (sample: SamplePrompt) => {
    const loc = isAr ? sample.ar : sample.en;
    setMessages([
      { id: `${sample.id}-u`, sender: "user", text: loc.user },
      { id: `${sample.id}-a`, sender: "ai", text: loc.ai, grounded: true },
    ]);
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = inputValue.trim();
    if (!q || isSubmitting) return;

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, sender: "user", text: q };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsSubmitting(true);

    try {
      const resp = await api.ask(q);
      const aiText = resp.answer?.text || (isAr ? "تم استلام استفسارك." : "Inquiry processed.");
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, sender: "ai", text: aiText, grounded: resp.grounded },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-err-${Date.now()}`,
          sender: "ai",
          text: isAr
            ? "تعذر الاتصال بمركز الاستشارات حالياً. يرجى مراجعة بيانات الحقل أو تجربة الاستفسارات التجريبية الجاهزة."
            : "Live advisory assistant currently offline. Please explore the calibrated prompt examples below or test with demo data.",
          grounded: false,
        },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="crop-talk" className="astryx-section-crop-talk">
      <div className="astryx-container">
        <h2 className="astryx-heading-2">
          {t("landing.crop_talk_title", "Crop Talk: Plant a Question, Grow an Answer")}
        </h2>

        <div className="astryx-crop-grid">
          {/* Spotlight Description & Prompt Chips */}
          <div className="astryx-crop-spotlight">
            <div className="astryx-crop-spotlight-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v4" />
                <line x1="8" y1="16" x2="8" y2="16" />
                <line x1="16" y1="16" x2="16" y2="16" />
              </svg>
            </div>
            <h3 className="astryx-heading-3 astryx-gradient-title">
              {t("landing.cropy_title", "What cropy the chatbot does:")}
            </h3>
            <p className="astryx-crop-desc">
              {t(
                "landing.cropy_summary",
                "Cropy can answer questions and talk about anything related to the simulation, root-zone hydrology, or rotation recommendations."
              )}
            </p>

            <div className="astryx-prompt-chips">
              <span className="astryx-chips-label">
                {t("landing.sample_questions", "Try Calibrated Agronomic Inquiries:")}
              </span>
              <div className="astryx-chips-list">
                {SAMPLE_PROMPTS.map((p) => {
                  const loc = isAr ? p.ar : p.en;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className="astryx-btn astryx-btn--secondary astryx-chip-btn"
                      onClick={() => handleSelectSample(p)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                        <path d="m21 15-3-3m0 0-3 3m3-3v8" />
                        <path d="M4 4h16c1.1 0 2 .9 2 2v7" />
                        <path d="M4 4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7" />
                      </svg>
                      <span>{loc.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Interactive Dialogue Box */}
          <div className="astryx-crop-chatbox">
            <div className="astryx-card astryx-chat-window">
              {/* Chat Header */}
              <div className="astryx-chat-header">
                <div className="astryx-chat-identity">
                  <div className="astryx-chat-avatar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                      <rect x="3" y="11" width="18" height="10" rx="2" />
                      <circle cx="12" cy="5" r="2" />
                      <path d="M12 7v4" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="astryx-chat-name">
                      {t("landing.cropy_name", "cropy the chatbot")}
                    </h4>
                    <p className="astryx-chat-meta">
                      {t("landing.cropy_meta", "Calibrated with Egypt SoilGrids & NASA Data")}
                    </p>
                  </div>
                </div>
                <span className="astryx-badge astryx-badge--matcha">
                  {t("landing.active_advisory", "● ACTIVE ADVISORY")}
                </span>
              </div>

              {/* Chat Messages Stream */}
              <div className="astryx-chat-stream" role="log" aria-live="polite">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`astryx-chat-row ${m.sender === "user" ? "astryx-chat-row--user" : "astryx-chat-row--ai"}`}
                  >
                    {m.sender === "ai" && (
                      <div className="astryx-avatar-chip astryx-avatar-chip--ai" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                          <path d="M12 2a10 10 0 0 1 10 10v1a8 8 0 0 1-8 8H7a5 5 0 0 1-5-5v-1a10 10 0 0 1 10-10z" />
                          <path d="M12 2v20" />
                        </svg>
                      </div>
                    )}
                    <div
                      className={
                        m.sender === "user" ? "astryx-chat-bubble-user" : "astryx-chat-bubble-ai"
                      }
                    >
                      <div className="astryx-bubble-text">{m.text}</div>
                      {m.sender === "ai" && (
                        <div className="astryx-bubble-footer">
                          {m.grounded
                            ? t("landing.grounded_note", "Grounded on FAO-56 and NASA POWER stream")
                            : t("landing.advisory_note", "Advisory note: Verify with local drainage conditions")}
                        </div>
                      )}
                    </div>
                    {m.sender === "user" && (
                      <div className="astryx-avatar-chip astryx-avatar-chip--user" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
                {isSubmitting && (
                  <div className="astryx-chat-row astryx-chat-row--ai">
                    <div className="astryx-avatar-chip astryx-avatar-chip--ai">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                        <circle cx="12" cy="12" r="10" />
                        <path d="m9 12 2 2 4-4" />
                      </svg>
                    </div>
                    <div className="astryx-chat-bubble-ai astryx-bubble-typing">
                      <span className="astryx-dot-flashing" />
                      <span>{t("landing.consulting_engine", "Consulting agronomic knowledge base...")}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleSend} className="astryx-chat-input-bar">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={
                    isAr
                      ? "اسأل كروبي عن تربتك أو محاصيلك أو الري..."
                      : "Ask cropy about your soil, crops, or irrigation..."
                  }
                  className="astryx-chat-input"
                  disabled={isSubmitting}
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isSubmitting}
                  className="astryx-btn astryx-btn--primary astryx-chat-send"
                  aria-label={t("ui.send", "Send")}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
