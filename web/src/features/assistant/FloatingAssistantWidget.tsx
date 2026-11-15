import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useStore } from "../../state/store";
import "./FloatingAssistantWidget.css";

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  citations?: { source: string; passage_id?: string; title?: string }[];
  scope?: "general" | "site_specific" | "insufficient";
}

export function FloatingAssistantWidget() {
  const { t } = useTranslation();
  const {
    lang,
    result,
    request,
    assistantOpen,
    setAssistantOpen,
    assistantInitialQuery,
    assistantNotification,
    dismissAssistantNotification,
  } = useStore();
  const isAr = lang === "ar";
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initial welcome message tailored to whether a scenario is active
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "welcome",
      sender: "ai",
      text: isAr
        ? "أهلاً بك! أنا المساعد الزراعي الذكي. يمكنك سؤالي عن التعاقب المحصولي، ملوحة التربة والمياه، وحسابات الري المدعومة ببيانات أقمار ناسا (POWER & SMAP)."
        : "Hello! I am your AI Agronomist assistant. You can ask me about crop succession, root-zone salinity, leaching protocols, and NASA POWER / SMAP calibrated irrigation.",
      scope: "general",
    },
  ]);

  // Auto-scroll on new message
  useEffect(() => {
    if (assistantOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, assistantOpen]);

  // Handle escape key to close
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && assistantOpen) {
        setAssistantOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [assistantOpen, setAssistantOpen]);

  // Auto-dismiss proactive notification after 15s
  useEffect(() => {
    if (assistantNotification) {
      const timer = setTimeout(() => {
        dismissAssistantNotification();
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [assistantNotification, dismissAssistantNotification]);

  const handleSend = async (questionText?: string) => {
    const text = (questionText || input).trim();
    if (!text || loading) return;

    const userMsgId = `u-${Date.now()}`;
    const userMsg: ChatMessage = { id: userMsgId, sender: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Connect to the exact scenario data if result exists, or draft request
      const farmerContext = result ? result.input : request;
      const analysisId = result?.request_id;

      const res = await api.ask(text, farmerContext, analysisId);
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: res.answer?.text || (isAr ? "لم نتمكن من العثور على إجابة دقيقة." : "Could not retrieve a precise answer."),
        citations: res.citations || [],
        scope: res.scope,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "ai",
          text: isAr
            ? "تعذر الاتصال بخادم الاستشارات حالياً. يرجى المحاولة مرة أخرى."
            : "The assistant could not connect right now. Please try again in a moment.",
          scope: "insufficient",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Consume and execute initial query passed from Results tab
  useEffect(() => {
    if (assistantInitialQuery && assistantInitialQuery.trim()) {
      void handleSend(assistantInitialQuery.trim());
      setAssistantOpen(true, undefined);
    }
  }, [assistantInitialQuery]);

  // Scenario-specific quick prompt chips
  const scenarioChips = result
    ? [
        {
          en: "Why is this rotation recommended?",
          ar: "لماذا تم ترشيح هذه الدورة الزراعية؟",
        },
        {
          en: "How to reduce seasonal water demand?",
          ar: "كيف أخفض الاحتياج المائي الموسمي؟",
        },
        {
          en: "Is salt accumulating in root zone?",
          ar: "هل تتراكم الأملاح في منطقة الجذور؟",
        },
        {
          en: "What is my recommended leaching fraction?",
          ar: "ما هي نسبة غسيل الأملاح الموصى بها؟",
        },
      ]
    : [
        {
          en: "Why rotate chickpea after wheat?",
          ar: "لماذا نزرع الحمص بعد القمح؟",
        },
        {
          en: "Managing 2.8 dS/m salinity water",
          ar: "إدارة مياه ري بملوحة 2.8 ديسيمنز",
        },
        {
          en: "How does NASA POWER calculate ET0?",
          ar: "كيف تحسب ناسا التبخر-نتح (ET0)؟",
        },
      ];

  return (
    <aside className="floating-ai-container" aria-label="AI Agronomist Assistant">
      {/* Proactive Popup Balloon when Simulation Ends */}
      {assistantNotification && !assistantOpen && (
        <div
          className="fab-proactive-balloon"
          role="status"
          onClick={() => {
            setAssistantOpen(true);
            dismissAssistantNotification();
          }}
          aria-label={t("ui.assistant_popup_title", "Simulation Complete!")}
        >
          <div className="balloon-arrow" aria-hidden="true" />
          <div className="balloon-icon-wrap" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div className="balloon-body">
            <h4>{t("ui.assistant_popup_title", "Simulation Complete!")}</h4>
            <p>{t("ui.assistant_popup_sub", "Ask me anything about your scenario")}</p>
          </div>
          <button
            type="button"
            className="balloon-dismiss-btn"
            onClick={(e) => {
              e.stopPropagation();
              dismissAssistantNotification();
            }}
            title={isAr ? "إغلاق" : "Dismiss"}
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Floating Action Button (FAB) */}
      <button
        type="button"
        className="floating-ai-fab"
        onClick={() => {
          if (assistantNotification) dismissAssistantNotification();
          setAssistantOpen(!assistantOpen);
        }}
        aria-expanded={assistantOpen}
        aria-label={t("ui.agent_title", "Ask AI Agronomist")}
        title={t("ui.agent_title", "Ask AI Agronomist")}
      >
        <span className="fab-beacon" />
        {assistantOpen ? (
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
        <span className="fab-tooltip">{isAr ? "اسأل المساعد الذكي" : "Ask AI Agronomist"}</span>
      </button>

      {/* Interactive Chat Window */}
      {assistantOpen && (
        <section className="floating-chat-window" role="dialog" aria-modal="false" aria-label="AI Agronomist Chat">
          {/* Header */}
          <div className="chat-window-header">
            <div className="header-brand-wrap">
              <div className="assistant-avatar" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className="header-text-block">
                <h3>{isAr ? "المستشار الزراعي الذكي" : "AI Agronomist"}</h3>
                <p>{isAr ? "مدعوم ببيانات ناسا و FAO-56" : "NASA POWER & FAO-56 Grounded"}</p>
              </div>
            </div>

            <div className="header-actions">
              <button
                type="button"
                className="close-btn"
                onClick={() =>
                  setMessages([
                    {
                      id: "welcome",
                      sender: "ai",
                      text: isAr
                        ? "تم مسح المحادثة. يمكنك طرح سؤال جديد حول مزرعتك."
                        : "Conversation cleared. Feel free to ask a new question about your field scenario.",
                      scope: "general",
                    },
                  ])
                }
                title={isAr ? "مسح المحادثة" : "Clear conversation"}
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
              <button type="button" className="close-btn" onClick={() => setAssistantOpen(false)} title={isAr ? "إغلاق" : "Close"}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Scenario Context Banner */}
          <div className="scenario-banner">
            <span className="scenario-badge">
              <span className="status-dot-green" />
              <span>
                {result
                  ? isAr
                    ? `سيناريو الحقل: ${result.field.region || "الدلتا"} · ${result.field.area_feddan ?? 1} فدان`
                    : `Active Field: ${result.field.region || "Delta"} · ${result.field.area_feddan ?? 1} feddans`
                  : isAr
                    ? "قاعدة المعرفة العامة للزراعة"
                    : "General Agricultural Knowledge"}
              </span>
            </span>
            {result && (
              <span style={{ fontSize: "10px", opacity: 0.85 }}>
                {isAr ? "مرتبط بالنتائج" : "Linked to Scenario"}
              </span>
            )}
          </div>

          {/* Messages Container */}
          <div className="chat-messages-container" tabIndex={0} aria-live="polite">
            {messages.map((m) => (
              <div key={m.id} className={`message-bubble ${m.sender}`}>
                <div className="bubble-content" dir={isAr ? "rtl" : "ltr"}>
                  {m.text}
                </div>
                {m.citations && m.citations.length > 0 && (
                  <div className="citations-wrap">
                    {m.citations.map((c, i) => (
                      <span key={i} className="citation-pill">
                        {c.source} {c.passage_id ? `(${c.passage_id})` : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="message-bubble ai">
                <div className="bubble-content" style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: "var(--astryx-color-text-secondary, #4a544e)" }}>
                    {isAr ? "جاري استرجاع البيانات وتحليل السيناريو..." : "Consulting NASA & scenario data..."}
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Quick Prompt Chips */}
          <div className="quick-chips-row" aria-label="Suggested questions">
            {scenarioChips.map((chip, i) => (
              <button
                key={i}
                type="button"
                className="quick-chip"
                onClick={() => void handleSend(isAr ? chip.ar : chip.en)}
                disabled={loading}
              >
                {isAr ? chip.ar : chip.en}
              </button>
            ))}
          </div>

          {/* Chat Input Bar */}
          <form
            className="chat-input-bar"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
          >
            <input
              type="text"
              className="chat-input-field"
              value={input}
              placeholder={isAr ? "اسأل عن الري، الملوحة، أو المحاصيل..." : "Ask about irrigation, salinity, crops..."}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              dir={isAr ? "rtl" : "ltr"}
            />
            <button
              type="submit"
              className="chat-send-btn"
              disabled={loading || !input.trim()}
              title={isAr ? "إرسال" : "Send"}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {isAr ? (
                  <line x1="19" y1="12" x2="5" y2="12" />
                ) : (
                  <line x1="5" y1="12" x2="19" y2="12" />
                )}
                {isAr ? (
                  <polyline points="12 19 5 12 12 5" />
                ) : (
                  <polyline points="12 5 19 12 12 19" />
                )}
              </svg>
            </button>
          </form>
        </section>
      )}
    </aside>
  );
}
