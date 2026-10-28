export default function EmptyState({ onLoadSample }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "48px 24px", textAlign: "center", gap: "14px"
    }}>
      <div style={{ fontSize: "52px", lineHeight: 1, filter: "drop-shadow(0 0 20px rgba(99,102,241,0.5))" }}>🎙</div>
      <div style={{ fontSize: "20px", fontWeight: 800, color: "#fff", letterSpacing: "-0.3px" }}>
        Paste any story to begin
      </div>
      <div style={{ fontSize: "14px", color: "#64748b", maxWidth: "380px", lineHeight: 1.7 }}>
        NarrateAI uses Gemini to identify every character, assign them a distinct voice, and read the story aloud with real emotion.
      </div>
      <button onClick={onLoadSample} style={{
        marginTop: "8px", padding: "11px 24px", borderRadius: "10px",
        border: "1px solid rgba(99,102,241,0.4)",
        background: "rgba(99,102,241,0.1)",
        fontSize: "13px", color: "#818cf8", cursor: "pointer", fontWeight: 600,
        transition: "all 0.2s",
      }}>
        ✨ Try a sample story
      </button>
    </div>
  );
}
