import { useState } from "react";
import { S } from "../constants/styles";

export default function ApiKeyPanel({ apiKey, onKeyChange }) {
  const [show, setShow] = useState(false);
  return (
    <div style={S.card}>
      <label style={S.label}>
        🔑 Groq API Key
        <span style={{ marginLeft: 8, fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "#6366f1", fontSize: "10px" }}>
          Free at console.groq.com — GPT-OSS 120B / 20B
        </span>
      </label>
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <input
          type={show ? "text" : "password"}
          value={apiKey}
          onChange={e => onKeyChange(e.target.value)}
          placeholder="Paste your Groq API key here (gsk_...)..."
          style={S.input}
          spellCheck={false}
        />
        <button
          onClick={() => setShow(s => !s)}
          title={show ? "Hide" : "Show"}
          style={{
            padding: "12px 14px", borderRadius: "10px",
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.05)",
            color: "#94a3b8", cursor: "pointer", fontSize: "14px",
            flexShrink: 0,
          }}
        >
          {show ? "🙈" : "👁"}
        </button>
      </div>
      {!apiKey && (
        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "8px", lineHeight: 1.6 }}>
          Get a free API key →{" "}
          <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer"
            style={{ color: "#6366f1", textDecoration: "none", fontWeight: 600 }}>
            console.groq.com/keys
          </a>
          {" "}— no credit card needed. Very generous free limits.
        </div>
      )}
      {apiKey && (
        <div style={{ fontSize: "12px", color: "#22c55e", marginTop: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
          ✓ Groq API key set — AI models ready
        </div>
      )}
    </div>
  );
}
