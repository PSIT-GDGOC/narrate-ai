import { S } from "../constants/styles";

export default function PlaybackControls({ isPlaying, currentIndex, total, onPlay, onPause, onStop, onPrev, onNext, speed, onSpeedChange, disabled }) {
  const progress = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;
  return (
    <div style={S.controls}>
      <div style={{ flex: 1 }}>
        <div style={{ height: "3px", background: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden", marginBottom: "6px" }}>
          <div style={{
            height: "100%",
            background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
            borderRadius: "2px",
            width: `${progress}%`,
            transition: "width 0.3s ease",
            boxShadow: "0 0 8px rgba(99,102,241,0.7)",
          }} />
        </div>
        {total > 0 && (
          <div style={{ fontSize: "11px", color: "#475569" }}>
            Line {currentIndex + 1} of {total}
          </div>
        )}
      </div>

      <select value={speed} onChange={e => onSpeedChange(Number(e.target.value))} disabled={disabled}
        style={{
          fontSize: "12px", padding: "6px 10px", borderRadius: "8px",
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.07)", color: "#94a3b8",
          cursor: disabled ? "not-allowed" : "pointer",
          fontFamily: "inherit",
        }}>
        <option value={0.75}>0.75×</option>
        <option value={1.0}>1×</option>
        <option value={1.25}>1.25×</option>
        <option value={1.5}>1.5×</option>
      </select>

      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <button onClick={onPrev} disabled={disabled || currentIndex === 0}
          title="Previous Line"
          style={{
            width: "38px", height: "38px", borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.06)",
            cursor: "pointer", fontSize: "14px", color: "#94a3b8",
            opacity: disabled || currentIndex === 0 ? 0.3 : 1,
            transition: "all 0.2s",
          }}>⏮</button>

        <button onClick={onStop} disabled={disabled || (!isPlaying && currentIndex === 0)}
          title="Stop & Reset"
          style={{
            width: "38px", height: "38px", borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.06)",
            cursor: "pointer", fontSize: "14px", color: "#94a3b8",
            opacity: disabled || (!isPlaying && currentIndex === 0) ? 0.3 : 1,
            transition: "all 0.2s",
          }}>⏹</button>

        {isPlaying ? (
          <button onClick={onPause} title="Pause" style={{
            width: "48px", height: "48px", borderRadius: "50%",
            border: "none",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "white", cursor: "pointer", fontSize: "18px",
            boxShadow: "0 4px 20px rgba(99,102,241,0.5)",
            transition: "all 0.2s",
          }}>⏸</button>
        ) : (
          <button onClick={onPlay} disabled={disabled} title="Play" style={{
            width: "48px", height: "48px", borderRadius: "50%",
            border: "none",
            background: disabled
              ? "rgba(255,255,255,0.08)"
              : "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: disabled ? "#475569" : "white",
            cursor: disabled ? "not-allowed" : "pointer",
            fontSize: "18px",
            boxShadow: disabled ? "none" : "0 4px 20px rgba(99,102,241,0.5)",
            transition: "all 0.2s",
          }}>▶</button>
        )}

        <button onClick={onNext} disabled={disabled || currentIndex === total - 1}
          title="Next Line"
          style={{
            width: "38px", height: "38px", borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.06)",
            cursor: "pointer", fontSize: "14px", color: "#94a3b8",
            opacity: disabled || currentIndex === total - 1 ? 0.3 : 1,
            transition: "all 0.2s",
          }}>⏭</button>
      </div>
    </div>
  );
}
