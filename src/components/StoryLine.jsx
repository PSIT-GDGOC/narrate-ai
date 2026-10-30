import { useRef, useEffect } from "react";
import { S } from "../constants/styles";
import { NARRATOR_COLOR } from "../constants/storyConstants";

export default function StoryLine({ line, isActive, colorMap, onClick, activeCharIndex }) {
  const ref = useRef(null);
  const color = colorMap[line.speaker] || NARRATOR_COLOR;
  const isNarrator = line.speaker === "Narrator";
  const isThought = !!line.isThought;

  useEffect(() => {
    if (isActive && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isActive]);

  const renderContent = () => {
    if (!line.text) return null;
    if (!isActive || activeCharIndex === null || activeCharIndex === undefined) {
      return line.text;
    }

    const segments = line.text.split(/(\s+)/);
    let runningIndex = 0;

    return segments.map((seg, idx) => {
      const start = runningIndex;
      const end = runningIndex + seg.length;
      runningIndex = end;

      const isSpace = /^\s+$/.test(seg);
      if (isSpace) {
        return <span key={idx}>{seg}</span>;
      }

      const isWordActive = activeCharIndex >= start && activeCharIndex < end;

      return (
        <span
          key={idx}
          style={isWordActive ? {
            background: color.bg || "rgba(99, 102, 241, 0.3)",
            color: "#ffffff",
            borderRadius: "4px",
            padding: "1px 4px",
            boxShadow: `0 0 10px ${color.dot || "#6366f1"}`,
            fontWeight: 600,
            transition: "all 0.12s ease",
            display: "inline-block",
          } : {
            transition: "all 0.12s ease",
          }}
        >
          {seg}
        </span>
      );
    });
  };

  return (
    <div ref={ref} onClick={onClick} style={{
      ...(isActive ? S.storyLineActive : S.storyLineInactive),
      borderLeftColor: isActive ? color.dot : "transparent",
      background: isActive ? color.bg : "transparent",
      cursor: "pointer",
    }}>
      {!isNarrator && (
        <div style={{
          fontSize: "11px", fontWeight: 700, color: color.text,
          letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px",
          display: "flex", alignItems: "center", gap: "8px",
        }}>
          <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: color.dot, boxShadow: `0 0 6px ${color.dot}` }} />
          {line.speaker} {isThought && <span style={{ textTransform: "none", fontStyle: "italic", opacity: 0.8 }}>(Thought)</span>}
          <span style={{ fontWeight: 400, opacity: 0.6, textTransform: "none", letterSpacing: 0, fontSize: "10px" }}>
            {line.emotion}
          </span>
        </div>
      )}
      <div style={{
        fontSize: isNarrator ? "14px" : "15px",
        color: isActive ? "#f1f5f9" : "#94a3b8",
        lineHeight: 1.75,
        fontStyle: (isNarrator || isThought) ? "italic" : "normal",
        transition: "color 0.25s",
        borderLeft: isThought ? "2px dashed rgba(255, 255, 255, 0.15)" : "none",
        paddingLeft: isThought ? "8px" : "0",
      }}>
        {renderContent()}
      </div>
    </div>
  );
}
