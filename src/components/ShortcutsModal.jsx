import { KEYBOARD_SHORTCUTS } from "../constants/storyConstants";

export default function ShortcutsModal({ isOpen, onClose, helpDialogRef }) {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "rgba(2,6,23,0.78)",
        backdropFilter: "blur(8px)",
      }}
    >
      <section
        ref={helpDialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-shortcuts-title"
        aria-describedby="keyboard-shortcuts-description"
        tabIndex={-1}
        onClick={event => event.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "480px",
          maxHeight: "80vh",
          overflowY: "auto",
          padding: "24px",
          border: "1px solid rgba(129,140,248,0.4)",
          borderRadius: "16px",
          background: "#111827",
          color: "#e2e8f0",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          outline: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
          <h2 id="keyboard-shortcuts-title" style={{ margin: 0, fontSize: "21px", color: "#f8fafc" }}>
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            title="Close keyboard shortcuts"
            style={{
              width: "36px",
              height: "36px",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "8px",
              background: "rgba(255,255,255,0.05)",
              color: "#e2e8f0",
              fontSize: "18px",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
        <p id="keyboard-shortcuts-description" style={{ margin: "12px 0 20px", color: "#a8b3c7", fontSize: "14px", lineHeight: 1.6 }}>
          Available keyboard shortcuts:
        </p>
        <dl style={{ display: "grid", gap: "12px", margin: 0 }}>
          {KEYBOARD_SHORTCUTS.map(shortcut => (
            <div key={shortcut.keys} style={{ display: "grid", gridTemplateColumns: "minmax(112px, auto) 1fr", gap: "16px" }}>
              <dt style={{ margin: 0 }}>
                <kbd style={{
                  display: "inline-block",
                  padding: "6px 9px",
                  border: "1px solid rgba(165,180,252,0.4)",
                  borderRadius: "6px",
                  background: "rgba(99,102,241,0.16)",
                  color: "#e0e7ff",
                  fontSize: "12px",
                  fontWeight: 700,
                }}>{shortcut.keys}</kbd>
              </dt>
              <dd style={{ margin: "5px 0 0", color: "#e2e8f0", fontSize: "14px" }}>{shortcut.action}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
