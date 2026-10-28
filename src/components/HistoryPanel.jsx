import { S } from "../constants/styles";

export default function HistoryPanel({ history, onLoadItem, onClear }) {
  if (!history || history.length === 0) return null;
  return (
    <div style={{ ...S.card, padding: "18px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
        <span style={{ ...S.label, marginBottom: 0 }}>🕘 Recent Stories</span>
        <button onClick={onClear} style={{ ...S.btnSecondary, padding: "8px 12px", fontSize: "11px" }}>
          Clear history
        </button>
      </div>
      <div style={{ display: "grid", gap: "10px" }}>
        {history.map(item => (
          <button
            key={item.id}
            onClick={() => onLoadItem(item)}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "14px 16px",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              color: "#e2e8f0",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <span style={{ fontWeight: 700, fontSize: "13px", color: "#f8fafc" }}>{item.title}</span>
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>
              {item.parsedLines?.length ?? 0} lines · {item.characters?.length ?? 0} voices
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
