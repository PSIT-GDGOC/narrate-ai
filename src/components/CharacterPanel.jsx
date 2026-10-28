import { useState } from "react";
import { S } from "../constants/styles";
import { NARRATOR_COLOR } from "../constants/storyConstants";

export default function CharacterPanel({ characters, colorMap, voiceAssignments }) {
  const [expandedChar, setExpandedChar] = useState(null);

  if (!characters.length) return null;

  return (
    <div style={{ marginBottom: "20px" }}>
      <span style={S.label}>🎭 Voices Panel</span>
      
      {expandedChar && (
        <div style={{
          marginBottom: "20px",
          padding: "20px",
          borderRadius: "14px",
          background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.12))",
          border: "1px solid rgba(99,102,241,0.4)",
          boxShadow: "0 8px 32px rgba(99,102,241,0.2), inset 0 1px 3px rgba(99,102,241,0.1)",
          animation: "slideDown 0.3s ease-out",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px"
              }}>
                <div style={{
                  width: "12px", height: "12px", borderRadius: "50%",
                  background: colorMap[expandedChar.speaker]?.dot || "#6366f1",
                  boxShadow: `0 0 12px ${colorMap[expandedChar.speaker]?.dot || "#6366f1"}`,
                  flexShrink: 0,
                }}/> 
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#f1f5f9" }}>
                  {expandedChar.speaker}
                </h3>
              </div>
              
              <p style={{
                fontSize: "14px", lineHeight: 1.9, color: "#cbd5e1", margin: 0,
                marginBottom: "16px",
                whiteSpace: "pre-wrap",
                wordWrap: "break-word",
                wordBreak: "break-word",
              }}>
                {expandedChar.persona || "A mysterious character in this story."}
              </p>

              <div style={{
                fontSize: "12px", color: "#94a3b8", marginTop: "14px",
                padding: "12px 14px", background: "rgba(99,102,241,0.08)", borderRadius: "10px",
                borderLeft: `3px solid ${colorMap[expandedChar.speaker]?.dot || "#6366f1"}`,
              }}>
                <div style={{ fontWeight: 700, color: "#cbd5e1", marginBottom: "4px" }}>🎙 Voice Assignment</div>
                <div>{voiceAssignments[expandedChar.speaker]?.name || "Default System Voice"}</div>
              </div>
            </div>
            
            <button
              onClick={() => setExpandedChar(null)}
              style={{
                background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "10px", padding: "8px 12px", color: "#94a3b8", cursor: "pointer",
                fontSize: "14px", fontWeight: 700, transition: "all 0.2s",
                marginTop: "0px",
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                e.target.style.background = "rgba(255,255,255,0.15)";
                e.target.style.color = "#cbd5e1";
              }}
              onMouseLeave={e => {
                e.target.style.background = "rgba(255,255,255,0.1)";
                e.target.style.color = "#94a3b8";
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div style={{
        display: "flex",
        gap: "12px",
        overflowX: "auto",
        paddingBottom: "10px",
        paddingRight: "16px",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255,255,255,0.15) transparent",
      }}>
        {characters.map(char => {
          const color = colorMap[char.speaker] || NARRATOR_COLOR;
          const isExpanded = expandedChar?.speaker === char.speaker;
          
          return (
            <button
              key={char.speaker}
              onClick={() => setExpandedChar(isExpanded ? null : char)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 16px",
                borderRadius: "12px",
                background: isExpanded ? `${color.bg}99` : color.bg,
                border: isExpanded ? `2px solid ${color.border}` : "1px solid transparent",
                minWidth: "fit-content",
                flexShrink: 0,
                boxShadow: isExpanded 
                  ? `0 0 24px ${color.dot}50, inset 0 0 16px ${color.dot}15`
                  : `0 4px 12px rgba(0, 0, 0, 0.2)`,
                transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
              onMouseEnter={e => {
                if (!isExpanded) {
                  e.currentTarget.style.boxShadow = `0 0 28px ${color.dot}70, 0 10px 28px rgba(0,0,0,0.4)`;
                  e.currentTarget.style.transform = "translateY(-5px) scale(1.05)";
                  e.currentTarget.style.background = `${color.bg}cc`;
                }
              }}
              onMouseLeave={e => {
                if (!isExpanded) {
                  e.currentTarget.style.boxShadow = `0 4px 12px rgba(0, 0, 0, 0.2)`;
                  e.currentTarget.style.transform = "translateY(0) scale(1)";
                  e.currentTarget.style.background = color.bg;
                }
              }}
            >
              <div style={{
                width: isExpanded ? "12px" : "8px",
                height: isExpanded ? "12px" : "8px",
                borderRadius: "50%",
                background: color.dot,
                boxShadow: `0 0 ${isExpanded ? "16px" : "6px"} ${color.dot}`,
                flexShrink: 0,
                transition: "all 0.3s",
              }} />
              
              <div style={{
                fontSize: isExpanded ? "14px" : "13px",
                fontWeight: 700,
                color: color.text,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                transition: "all 0.3s",
              }}>
                {char.speaker}
              </div>
            </button>
          );
        })}
      </div>

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
