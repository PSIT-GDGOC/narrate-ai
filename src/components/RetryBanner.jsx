import { useEffect, useState } from "react";

function retryReason(status) {
  if (status === 429) return "Rate limited";
  if (status === 503) return "Service unavailable";
  if (typeof status === "number") return "Server error";
  return "Connection problem";
}

export default function RetryBanner({ error, retryInfo }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!retryInfo) return undefined;
    const intervalId = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(intervalId);
  }, [retryInfo]);

  if (!error && !retryInfo) return null;

  if (error) {
    return (
      <div role="alert" style={{
        marginBottom: "16px", padding: "12px 14px", borderRadius: "10px",
        background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.35)",
        color: "#fecaca", fontSize: "13px", lineHeight: 1.5,
      }}>
        ⚠ {error}
      </div>
    );
  }

  const secondsLeft = Math.max(0, Math.ceil((retryInfo.until - now) / 1000));
  const message = secondsLeft > 0
    ? `${retryReason(retryInfo.status)}, retrying in ${secondsLeft}s (attempt ${retryInfo.attempt}/${retryInfo.max})...`
    : `${retryReason(retryInfo.status)}, retrying now (attempt ${retryInfo.attempt}/${retryInfo.max})...`;

  return (
    <>
      <style>{`
        @keyframes retryBannerPulse { 50% { opacity: 0.35; transform: scale(0.7); } }
        @media (prefers-reduced-motion: reduce) { .retry-banner-dot { animation: none !important; } }
      `}</style>
      <div role="status" aria-live="polite" style={{
        display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px",
        padding: "12px 14px", borderRadius: "10px", background: "rgba(245,158,11,0.1)",
        border: "1px solid rgba(245,158,11,0.3)", color: "#fde68a", fontSize: "13px",
      }}>
        <span className="retry-banner-dot" aria-hidden="true" style={{
          width: "8px", height: "8px", borderRadius: "50%", background: "#fbbf24",
          animation: "retryBannerPulse 1s ease-in-out infinite",
        }} />
        {message}
      </div>
    </>
  );
}
