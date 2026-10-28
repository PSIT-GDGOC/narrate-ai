import { S } from "../constants/styles";

export default function Header({
  hasStory,
  parsedLinesCount,
  charactersCount,
  showWritingPanel,
  setShowWritingPanel,
  showPlaybackPanel,
  setShowPlaybackPanel,
  helpButtonRef,
  openShortcutsHelp,
}) {
  return (
    <div style={S.header}>
      <div style={S.logo}>
        <span style={{ fontSize: "22px", filter: "drop-shadow(0 0 8px rgba(99,102,241,0.8))" }}>🎙</span>
        <span>
          Narrate<span style={{ color: "#818cf8" }}>AI</span>
        </span>
        <span style={{
          marginLeft: "4px", fontSize: "10px", fontWeight: 600,
          background: "linear-gradient(135deg, #f97316, #ef4444)",
          color: "white", padding: "2px 8px", borderRadius: "20px",
          letterSpacing: "0.05em",
        }}>GROQ · GPT-OSS 120B</span>
      </div>

      {hasStory && (
        <div style={{ display: "flex", gap: "8px", background: "rgba(255,255,255,0.05)", borderRadius: "10px", padding: "5px", border: "1px solid rgba(255,255,255,0.07)" }}>
          <button 
            onClick={() => setShowWritingPanel(!showWritingPanel)}
            title="Toggle Story Writer"
            style={{
              padding: "6px 16px", borderRadius: "8px", border: "none",
              fontSize: "12px", fontWeight: 700, cursor: "pointer",
              background: showWritingPanel ? "rgba(99,102,241,0.8)" : "transparent",
              color: showWritingPanel ? "#fff" : "#64748b",
              transition: "all 0.2s",
              display: "flex", alignItems: "center", gap: "6px",
            }}>
            ✏️ {showWritingPanel ? "Hide" : "Show"} Writer
          </button>
          <button 
            onClick={() => setShowPlaybackPanel(!showPlaybackPanel)}
            title="Toggle Playback"
            style={{
              padding: "6px 16px", borderRadius: "8px", border: "none",
              fontSize: "12px", fontWeight: 700, cursor: "pointer",
              background: showPlaybackPanel ? "rgba(99,102,241,0.8)" : "transparent",
              color: showPlaybackPanel ? "#fff" : "#64748b",
              transition: "all 0.2s",
              display: "flex", alignItems: "center", gap: "6px",
            }}>
            ▶️ {showPlaybackPanel ? "Hide" : "Show"} Playback
          </button>
        </div>
      )}

      <button
        ref={helpButtonRef}
        type="button"
        onClick={openShortcutsHelp}
        aria-label="Show keyboard shortcuts"
        title="Show keyboard shortcuts"
        style={{
          width: "34px",
          height: "34px",
          borderRadius: "8px",
          border: "1px solid rgba(129,140,248,0.5)",
          background: "rgba(99,102,241,0.15)",
          color: "#c7d2fe",
          fontSize: "17px",
          fontWeight: 800,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        ?
      </button>

      <div style={{ fontSize: "12px", color: "#475569", fontWeight: 500 }}>
        {hasStory ? `${parsedLinesCount} lines · ${charactersCount} chars` : ""}
      </div>
    </div>
  );
}
