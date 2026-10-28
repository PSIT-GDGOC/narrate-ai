export default function VoiceQualityBanner({ availableVoices }) {
  const hasNatural = availableVoices.some(v =>
    v.name.toLowerCase().includes("natural") ||
    v.name.toLowerCase().includes("neural") ||
    v.name.toLowerCase().includes("online")
  );

  if (hasNatural) return null;

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: "12px",
      padding: "14px 16px", borderRadius: "12px", marginBottom: "20px",
      background: "rgba(245,158,11,0.08)",
      border: "1px solid rgba(245,158,11,0.3)",
    }}>
      <span style={{ fontSize: "20px", flexShrink: 0 }}>💡</span>
      <div>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "#fbbf24", marginBottom: "4px" }}>
          Upgrade to human-sounding voices — free!
        </div>
        <div style={{ fontSize: "12px", lineHeight: 1.6, color: "#d97706" }}>
          Open this app in <strong>Microsoft Edge</strong> to unlock Neural voices like
          <em> Microsoft Aria, Guy, Jenny</em> — they sound genuinely human.
          Edge is free and already on your Windows PC.
        </div>
        <a
          href="microsoft-edge:https://narrate-ai-gamma.vercel.app/"
          style={{
            display: "inline-block", marginTop: "8px",
            padding: "6px 14px", borderRadius: "8px",
            background: "rgba(245,158,11,0.2)",
            border: "1px solid rgba(245,158,11,0.4)",
            color: "#fbbf24", fontSize: "12px", fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Open in Edge →
        </a>
      </div>
    </div>
  );
}
