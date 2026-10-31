import { useState, useEffect, useMemo } from "react";
import { isProblematicVoice } from "../utils/storyParser";
import { NARRATOR_COLOR } from "../constants/storyConstants";

export default function VoiceCustomizerModal({
  character,
  currentAssignment,
  availableVoices = [],
  color = NARRATOR_COLOR,
  onClose,
  onSave,
  onReset,
}) {
  const safeVoices = useMemo(() => {
    const list = availableVoices.filter(v => !isProblematicVoice(v));
    return list.length > 0 ? list : availableVoices;
  }, [availableVoices]);

  const [selectedVoiceURI, setSelectedVoiceURI] = useState(() => {
    if (!currentAssignment) return safeVoices[0]?.voiceURI || safeVoices[0]?.name || "";
    const match = safeVoices.find(
      v => v.name === currentAssignment.name || v.voiceURI === currentAssignment.voiceURI || (currentAssignment.name && v.name.includes(currentAssignment.name))
    );
    return match ? (match.voiceURI || match.name) : (safeVoices[0]?.voiceURI || safeVoices[0]?.name || "");
  });

  const [pitch, setPitch] = useState(() => {
    return typeof currentAssignment?.pitch === "number" ? currentAssignment.pitch : 1.0;
  });

  const [rate, setRate] = useState(() => {
    return typeof currentAssignment?.rate === "number" ? currentAssignment.rate : 1.0;
  });

  const [isTesting, setIsTesting] = useState(false);
  const [testText, setTestText] = useState(
    `Hello! I am ${character?.speaker || "Narrator"}, and this is how my voice sounds in NarrateAI.`
  );

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (typeof window !== "undefined" && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [onClose]);

  const handleTestVoice = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (isTesting) {
      window.speechSynthesis.cancel();
      setIsTesting(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(testText);
    const chosenVoice = safeVoices.find(v => (v.voiceURI || v.name) === selectedVoiceURI) || safeVoices[0];
    if (chosenVoice) {
      utt.voice = chosenVoice;
    }
    utt.pitch = Math.min(2.0, Math.max(0.5, pitch));
    utt.rate = Math.min(2.0, Math.max(0.5, rate));

    utt.onend = () => setIsTesting(false);
    utt.onerror = () => setIsTesting(false);

    setIsTesting(true);
    window.speechSynthesis.speak(utt);
  };

  const handleSave = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    const chosenVoice = safeVoices.find(v => (v.voiceURI || v.name) === selectedVoiceURI) || safeVoices[0];
    onSave(character.speaker, {
      name: chosenVoice?.name || "",
      lang: chosenVoice?.lang || "",
      voiceURI: chosenVoice?.voiceURI || chosenVoice?.name || "",
      pitch: Number(pitch),
      rate: Number(rate),
      isCustom: true,
    });
    onClose();
  };

  const handleReset = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    onReset(character.speaker);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="customizer-title"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(10, 10, 20, 0.78)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
        animation: "fadeIn 0.2s ease-out",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (typeof window !== "undefined" && window.speechSynthesis) {
            window.speechSynthesis.cancel();
          }
          onClose();
        }
      }}
    >
      <div style={{
        background: "linear-gradient(145deg, #18192b 0%, #111222 100%)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        borderRadius: "20px",
        boxShadow: "0 24px 64px rgba(0, 0, 0, 0.7), 0 0 32px rgba(99, 102, 241, 0.15)",
        maxWidth: "520px",
        width: "100%",
        maxHeight: "90vh",
        overflowY: "auto",
        padding: "26px",
        color: "#e2e8f0",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <div style={{
                width: "12px", height: "12px", borderRadius: "50%",
                background: color?.dot || "#6366f1",
                boxShadow: `0 0 12px ${color?.dot || "#6366f1"}`,
              }} />
              <h2 id="customizer-title" style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#f8fafc" }}>
                Customize Voice: {character?.speaker}
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
              Override AI assigned speech properties for this character.
            </p>
          </div>
          <button
            onClick={() => {
              if (typeof window !== "undefined" && window.speechSynthesis) {
                window.speechSynthesis.cancel();
              }
              onClose();
            }}
            aria-label="Close customizer"
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#94a3b8",
              borderRadius: "8px",
              width: "32px",
              height: "32px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>

        {/* Persona Pill */}
        {character?.persona && (
          <div style={{
            fontSize: "12px",
            color: "#cbd5e1",
            background: "rgba(99, 102, 241, 0.08)",
            border: "1px solid rgba(99, 102, 241, 0.2)",
            borderRadius: "10px",
            padding: "10px 14px",
            marginBottom: "18px",
            lineHeight: 1.5,
          }}>
            <span style={{ fontWeight: 700, color: "#a5b4fc" }}>Persona Hints: </span>
            {character.persona}
          </div>
        )}

        {/* Voice Selection Dropdown */}
        <div style={{ marginBottom: "18px" }}>
          <label htmlFor="voice-select" style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#cbd5e1", marginBottom: "6px" }}>
            Browser Speech Voice
          </label>
          <select
            id="voice-select"
            value={selectedVoiceURI}
            onChange={e => setSelectedVoiceURI(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: "10px",
              background: "rgba(0, 0, 0, 0.4)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#f8fafc",
              fontSize: "13px",
              outline: "none",
              cursor: "pointer",
            }}
          >
            {safeVoices.map((v, idx) => (
              <option key={v.voiceURI || `${v.name}-${idx}`} value={v.voiceURI || v.name}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        </div>

        {/* Pitch Slider */}
        <div style={{ marginBottom: "18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "#cbd5e1" }}>
              🎵 Pitch: <span style={{ color: "#818cf8", fontWeight: 800 }}>{Number(pitch).toFixed(2)}x</span>
            </label>
            <span style={{ fontSize: "11px", color: "#64748b" }}>Range: 0.5x – 2.0x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.05"
            value={pitch}
            onChange={e => setPitch(parseFloat(e.target.value))}
            style={{ width: "100%", accentColor: "#818cf8", cursor: "pointer" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#64748b", marginTop: "4px" }}>
            <span>0.5x (Deeper / Gruff)</span>
            <span>1.0x (Normal)</span>
            <span>2.0x (Higher / Youthful)</span>
          </div>
        </div>

        {/* Rate Slider */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "#cbd5e1" }}>
              ⚡ Rate (Speed): <span style={{ color: "#38bdf8", fontWeight: 800 }}>{Number(rate).toFixed(2)}x</span>
            </label>
            <span style={{ fontSize: "11px", color: "#64748b" }}>Range: 0.5x – 2.0x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.05"
            value={rate}
            onChange={e => setRate(parseFloat(e.target.value))}
            style={{ width: "100%", accentColor: "#38bdf8", cursor: "pointer" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#64748b", marginTop: "4px" }}>
            <span>0.5x (Slower)</span>
            <span>1.0x (Normal)</span>
            <span>2.0x (Faster)</span>
          </div>
        </div>

        {/* Test Voice Section */}
        <div style={{
          padding: "16px",
          borderRadius: "12px",
          background: "rgba(99, 102, 241, 0.06)",
          border: "1px solid rgba(99, 102, 241, 0.2)",
          marginBottom: "24px",
        }}>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#cbd5e1", marginBottom: "6px" }}>
            Preview Speech
          </label>
          <input
            type="text"
            value={testText}
            onChange={e => setTestText(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "8px 12px",
              borderRadius: "8px",
              background: "rgba(0, 0, 0, 0.3)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#f8fafc",
              fontSize: "12px",
              marginBottom: "10px",
              outline: "none",
            }}
          />
          <button
            onClick={handleTestVoice}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              borderRadius: "8px",
              background: isTesting ? "#ef4444" : "rgba(99, 102, 241, 0.2)",
              border: `1px solid ${isTesting ? "#ef4444" : "#6366f1"}`,
              color: "#fff",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {isTesting ? "⏹️ Stop Preview" : "🔊 Test Voice"}
          </button>
        </div>

        {/* Footer Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
          <button
            onClick={handleReset}
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              background: "transparent",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#94a3b8",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reset Default
          </button>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => {
                if (typeof window !== "undefined" && window.speechSynthesis) {
                  window.speechSynthesis.cancel();
                }
                onClose();
              }}
              style={{
                padding: "10px 16px",
                borderRadius: "10px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#cbd5e1",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: "10px 20px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                border: "none",
                color: "#fff",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(99, 102, 241, 0.4)",
              }}
            >
              Apply Voice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
