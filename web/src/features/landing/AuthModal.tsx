import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "../../state/store";

export function AuthModal() {
  const { t } = useTranslation();
  const { authModalOpen, setAuthModalOpen, userEmail, setUserEmail, lang } = useStore();
  const isAr = lang === "ar";

  const [inputVal, setInputVal] = useState(userEmail || "");
  const [error, setError] = useState(false);

  if (!authModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputVal.trim();
    if (!clean || !clean.includes("@") || !clean.includes(".")) {
      setError(true);
      return;
    }
    setError(false);
    setUserEmail(clean);
    setAuthModalOpen(false);
  };

  const handleQuickLead = () => {
    setUserEmail("ahmed.yasser@shifters.spaceapps.org");
    setAuthModalOpen(false);
  };

  return (
    <div className="astryx-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
      <div className="astryx-card astryx-auth-modal">
        {/* Close Button */}
        <button
          type="button"
          onClick={() => setAuthModalOpen(false)}
          className="astryx-modal-close-btn"
          aria-label={t("ui.close", "Close")}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Shifters Transparent Logo */}
        <div className="astryx-auth-brand">
          <img
            src="/the_shifters_logo_transparent.png"
            alt="The Shifters"
            className="astryx-auth-logo"
          />
          <span className="astryx-badge astryx-badge--matcha">
            {t("app.title", "Journey into the Soil")}
          </span>
        </div>

        <h3 id="auth-modal-title" className="astryx-heading-3">
          {t("landing.auth_modal_title", "Enter Your Email to Unlock Simulation")}
        </h3>
        <p className="astryx-auth-subtitle">
          {t(
            "landing.auth_modal_subtitle",
            "Access full 3D root-zone physics, printable PDF agronomic advisories, and real-time NASA satellite telemetry."
          )}
        </p>

        {/* Email Entry Form */}
        <form onSubmit={handleSubmit} className="astryx-auth-form">
          <div className="astryx-input-group">
            <label htmlFor="user-email-input" className="astryx-label">
              {t("landing.email_label", "Your Email Address")}
            </label>
            <div className="astryx-input-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="astryx-input-icon">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <input
                id="user-email-input"
                type="email"
                required
                value={inputVal}
                onChange={(e) => {
                  setInputVal(e.target.value);
                  setError(false);
                }}
                placeholder={isAr ? "farmer@example.com" : "farmer@example.com"}
                className={`astryx-input ${error ? "astryx-input--error" : ""}`}
              />
            </div>
            {error && (
              <span className="astryx-field-error">
                {t("landing.invalid_email", "Please enter a valid email address.")}
              </span>
            )}
          </div>

          <button type="submit" className="astryx-btn astryx-btn--primary astryx-btn--full">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>{t("landing.unlock_button", "Add Email & Unlock Simulation")}</span>
          </button>
        </form>

        {/* 1-Tap Team Account Divider */}
        <div className="astryx-divider">
          <span>{t("landing.or_team_account", "Or 1-Tap Team Lead")}</span>
        </div>

        <button
          type="button"
          onClick={handleQuickLead}
          className="astryx-team-account-btn"
        >
          <div className="astryx-account-avatar">
            AY
            <span className="astryx-avatar-badge">✓</span>
          </div>
          <div className="astryx-account-details">
            <span className="astryx-account-name">Ahmed Yasser</span>
            <span className="astryx-account-role">Team Lead · The Shifters (NASA Space Apps)</span>
          </div>
          <span className="astryx-badge astryx-badge--amber">1-TAP ACCESS</span>
        </button>
      </div>
    </div>
  );
}
