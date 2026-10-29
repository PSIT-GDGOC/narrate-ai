// Shown for non-English stories: confirms the detected language and warns when
// no matching browser voice is installed (narration then falls back gracefully).
export default function LanguageBanner({ languageName, hasLocaleVoices }) {
  if (!languageName) return null;

  const tone = hasLocaleVoices
    ? { bg: "rgba(99,102,241,0.08)", border: "rgba(99,102,241,0.3)", title: "#a5b4fc", icon: "🌐" }
    : { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.3)", title: "#fbbf24", icon: "⚠️" };

  return (
    <div
      role="status"
      style={{
        display: "flex", alignItems: "flex-start", gap: "12px",
        padding: "14px 16px", borderRadius: "12px", marginBottom: "20px",
        background: tone.bg, border: `1px solid ${tone.border}`,
      }}
    >
      <span style={{ fontSize: "20px", flexShrink: 0 }}>{tone.icon}</span>
      <div>
        <div style={{ fontSize: "13px", fontWeight: 700, color: tone.title, marginBottom: "4px" }}>
          {hasLocaleVoices
            ? `${languageName} story detected — using ${languageName} voices`
            : `${languageName} story detected — no ${languageName} voices installed`}
        </div>
        <div style={{ fontSize: "12px", color: "#94a3b8", lineHeight: 1.6 }}>
          {hasLocaleVoices
            ? "Each character is matched to an installed voice for this language."
            : `Narration will use your closest available voice, so pronunciation may sound off. Install a ${languageName} voice in your system or browser speech settings for best results.`}
        </div>
      </div>
    </div>
  );
}
