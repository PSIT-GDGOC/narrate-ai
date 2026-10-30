/* eslint-disable react-refresh/only-export-components */
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Header from "./components/Header";
import ApiKeyPanel from "./components/ApiKeyPanel";
import EmptyState from "./components/EmptyState";
import RetryBanner from "./components/RetryBanner";
import VoiceQualityBanner from "./components/VoiceQualityBanner";
import CharacterPanel from "./components/CharacterPanel";
import StoryLine from "./components/StoryLine";
import PlaybackControls from "./components/PlaybackControls";
import HistoryPanel from "./components/HistoryPanel";
import ShortcutsModal from "./components/ShortcutsModal";
import useSpeechSynthesis from "./hooks/useSpeechSynthesis";
import { S } from "./constants/styles";
import { GROQ_ERROR_MESSAGES, SAMPLE_STORY, SAMPLE_STORIES, KEYBOARD_SHORTCUTS } from "./constants/storyConstants";
import {
  cleanAndParseJSON,
  formatNarrationDuration,
  splitLineIntoChunks,
  deduplicateSpeakers,
  classifyPersona,
  scoreVoice,
  resolveSpeechVoice,
  assignVoices,
  buildColorMap,
  callGroq,
} from "./utils/storyParser";
import { exportAsJSON, exportAsTranscript } from "./utils/exportUtils";

export {
  cleanAndParseJSON,
  formatNarrationDuration,
  splitLineIntoChunks,
  deduplicateSpeakers,
  classifyPersona,
  scoreVoice,
  assignVoices,
  resolveSpeechVoice,
  buildColorMap,
};

function getInitialNarrateAIState() {
  if (typeof window === "undefined") {
    return {
      apiKey: "",
      storyText: "",
      parsedLines: [],
      characters: [],
      colorMap: {},
      voiceAssignments: {},
      history: [],
      view: "input",
      storyLanguage: "en",
    };
  }

  try {
    const savedStoryLanguage = localStorage.getItem("narrateai_story_language") || "en";
    const savedApiKey = localStorage.getItem("narrateai_groq_key") || "";
    let savedStory = localStorage.getItem("narrateai_story_text") || "";
    
    // Check for extension story via URL hash
    if (window.location.hash.startsWith("#story=") || window.location.hash.startsWith("#text=")) {
      try {
        const prefix = window.location.hash.startsWith("#story=") ? "#story=" : "#text=";
        const hashStory = decodeURIComponent(window.location.hash.substring(prefix.length));
        if (hashStory.trim()) {
          savedStory = hashStory;
          window.history.replaceState(null, "", window.location.pathname);
        }
      } catch (err) {
        console.warn("Failed to decode story from URL hash", err);
      }
    }

    const savedParsedLines = JSON.parse(localStorage.getItem("narrateai_parsed_lines") || "null");
    const savedCharacters = JSON.parse(localStorage.getItem("narrateai_characters") || "null");
    const savedColorMap = JSON.parse(localStorage.getItem("narrateai_color_map") || "null");
    const savedVoiceAssignments = JSON.parse(localStorage.getItem("narrateai_voice_assignments") || "null");
    const savedHistory = JSON.parse(localStorage.getItem("narrateai_history") || "null");
    const savedView = localStorage.getItem("narrateai_view");

    const parsedLines = Array.isArray(savedParsedLines) ? savedParsedLines : [];
    const characters = Array.isArray(savedCharacters) && savedCharacters.length > 0
      ? savedCharacters
      : Object.entries((parsedLines || []).reduce((acc, line) => {
          if (line && line.speaker && !acc[line.speaker]) {
            acc[line.speaker] = line.persona || "";
          }
          return acc;
        }, {})).map(([speaker, persona]) => ({ speaker, persona }));

    return {
      apiKey: savedApiKey,
      storyText: savedStory,
      parsedLines,
      characters,
      colorMap: typeof savedColorMap === "object" && savedColorMap ? savedColorMap : {},
      voiceAssignments: typeof savedVoiceAssignments === "object" && savedVoiceAssignments ? savedVoiceAssignments : {},
      history: Array.isArray(savedHistory) ? savedHistory : [],
      view: savedView || (parsedLines.length > 0 ? "story" : "input"),
      storyLanguage: savedStoryLanguage,
    };
  } catch (err) {
    console.warn("Failed to restore NarrateAI state from localStorage", err);
    return {
      apiKey: "",
      storyText: "",
      parsedLines: [],
      characters: [],
      colorMap: {},
      voiceAssignments: {},
      history: [],
      view: "input",
      storyLanguage: "en",
    };
  }
}

// ─── MAIN APP COMPONENT ───────────────────────────────────────────────────────
export default function NarrateAI() {
  const [initialState]                          = useState(getInitialNarrateAIState);
  const [apiKey, setApiKey]                     = useState(initialState.apiKey);
  const [storyText, setStoryText]               = useState(initialState.storyText);
  const [parsedLines, setParsedLines]           = useState(initialState.parsedLines);
  const [characters, setCharacters]             = useState(initialState.characters);
  const [colorMap, setColorMap]                 = useState(initialState.colorMap);
  const [voiceAssignments, setVoiceAssignments] = useState(initialState.voiceAssignments);
  const [storyLanguage, setStoryLanguage]       = useState(initialState.storyLanguage || "en");
  const [isLoading, setIsLoading]               = useState(false);
  const [error, setError]                       = useState("");
  const [loadingStep, setLoadingStep]           = useState("");
  const [chunkProgress, setChunkProgress]       = useState(null);
  const [retryInfo, setRetryInfo]               = useState(null);
  
  const [history, setHistory]                   = useState(initialState.history);
  const [showWritingPanel, setShowWritingPanel] = useState(true);
  const [showPlaybackPanel, setShowPlaybackPanel] = useState(true);
  const [isHelpOpen, setIsHelpOpen]             = useState(false);

  const helpButtonRef = useRef(null);
  const helpDialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Custom speech synthesis hook
  const {
    speechSupported,
    availableVoices,
    isPlaying,
    currentIndex,
    setCurrentIndex,
    activeCharIndex,
    speed,
    showFinished,
    startPlayback,
    stopPlayback,
    pausePlayback,
    handlePlay,
    skipForward,
    skipBackward,
    handleSpeedChange,
    synthRef,
  } = useSpeechSynthesis(parsedLines, voiceAssignments);

  // Persist API key to localStorage
  useEffect(() => {
    if (apiKey) localStorage.setItem("narrateai_groq_key", apiKey);
  }, [apiKey]);

  // Listen for extension story text via URL hash changes
  useEffect(() => {
    function handleHashChange() {
      if (window.location.hash.startsWith("#story=") || window.location.hash.startsWith("#text=")) {
        try {
          const prefix = window.location.hash.startsWith("#story=") ? "#story=" : "#text=";
          const hashStory = decodeURIComponent(window.location.hash.substring(prefix.length));
          if (hashStory.trim()) {
            setStoryText(hashStory);
            window.history.replaceState(null, "", window.location.pathname);
          }
        } catch (err) {
          console.warn("Failed to decode story from URL hash", err);
        }
      }
    }
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Persist history
  function saveStoryToHistory(text, parsed, chars, colors, voiceAssigns, language = "en") {
    if (!text.trim()) return;
    const title = text.trim().substring(0, 45) + (text.trim().length > 45 ? "..." : "");
    const newItem = {
      id: Date.now(),
      title,
      storyText: text,
      parsedLines: parsed,
      characters: chars,
      colorMap: colors,
      voiceAssignments: voiceAssigns,
      language,
    };

    setHistory(prevHistory => {
      const updated = [newItem, ...prevHistory.filter(h => h.storyText.trim() !== text.trim())].slice(0, 5);
      localStorage.setItem("narrateai_history", JSON.stringify(updated));
      return updated;
    });
  }

  function loadHistoryItem(item) {
    stopPlayback();
    setStoryText(item.storyText);
    setParsedLines(item.parsedLines || []);
    setCharacters(item.characters || []);
    setColorMap(item.colorMap || {});
    setVoiceAssignments(item.voiceAssignments || {});
    if (item.language) {
      setStoryLanguage(item.language);
      localStorage.setItem("narrateai_story_language", item.language);
    }
    setCurrentIndex(0);
    setError("");
  }

  function clearHistory() {
    localStorage.removeItem("narrateai_history");
    setHistory([]);
  }

  // Memoize resolved voice assignments for CharacterPanel
  const resolvedVoiceAssignments = useMemo(() => {
    const resolved = {};
    for (const [speaker, voiceData] of Object.entries(voiceAssignments)) {
      resolved[speaker] = resolveSpeechVoice(voiceData, availableVoices);
    }
    return resolved;
  }, [voiceAssignments, availableVoices]);

  // Keyboard shortcut modal helpers
  const openShortcutsHelp = useCallback(() => {
    previousFocusRef.current = document.activeElement;
    setIsHelpOpen(true);
  }, []);

  const closeShortcutsHelp = useCallback(() => {
    setIsHelpOpen(false);
  }, []);

  useEffect(() => {
    if (!isHelpOpen) {
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === "function") {
        previousFocusRef.current.focus();
      }
      return;
    }

    const dialog = helpDialogRef.current;
    if (dialog) dialog.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeShortcutsHelp();
        return;
      }

      if (event.key !== "Tab" || !dialog) return;

      const focusable = dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable.length === 0) return;

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isHelpOpen, closeShortcutsHelp]);

  // Global playback shortcuts
  const actionsRef = useRef({});
  useEffect(() => {
    actionsRef.current = { handlePlay, pausePlayback, stopPlayback, skipForward, skipBackward };
  });

  useEffect(() => {
    function handleKeyDown(e) {
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.isContentEditable);
      if (isInputFocused) return;

      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        if (isPlaying) {
          actionsRef.current.pausePlayback?.();
        } else {
          actionsRef.current.handlePlay?.();
        }
      } else if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        actionsRef.current.stopPlayback?.();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        actionsRef.current.skipForward?.();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        actionsRef.current.skipBackward?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying]);

  // ── ANALYSE WITH GROQ ──
  async function analyzeStory() {
    if (!storyText.trim() || isLoading) return;
    if (!apiKey.trim()) {
      setError("Please enter your Groq API key above to get started.");
      return;
    }

    const wordCount = storyText.trim().split(/\s+/).filter(Boolean).length;
    const sentenceCount = storyText.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    if (wordCount < 10 || sentenceCount < 3) {
      setError("Please enter a longer story (at least 3 sentences or 10 words) for best results.");
      return;
    }

    setIsLoading(true);
    setLoadingStep("groq");
    setChunkProgress(null);
    setRetryInfo(null);
    setError("");
    setParsedLines([]);
    setCharacters([]);
    setVoiceAssignments({});
    stopPlayback();

    try {
      const parsed = await callGroq(apiKey.trim(), storyText, (progress) => {
        setChunkProgress(progress);
        setRetryInfo(null);
      }, (info) => {
        setRetryInfo({ ...info, until: Date.now() + info.waitMs });
      });

      setLoadingStep("parse");
      setChunkProgress(null);
      setRetryInfo(null);

      const filteredParsed = parsed.filter(line => line && typeof line.text === "string" && line.text.trim() !== "");
      const dedupedParsed = deduplicateSpeakers(filteredParsed);

      if (dedupedParsed.length === 0) {
        throw new Error("The AI did not extract any readable narrative lines from your story.");
      }

      setLoadingStep("assign");

      const charMap = {};
      for (const line of dedupedParsed) {
        if (!charMap[line.speaker]) charMap[line.speaker] = line.persona || "";
      }
      const chars = Object.entries(charMap).map(([speaker, persona]) => ({ speaker, persona }));

      const detectedLang = dedupedParsed.find(l => l && (l.language || l.lang))?.language
        || dedupedParsed.find(l => l && (l.language || l.lang))?.lang
        || "en";
      const cleanLang = typeof detectedLang === "string" ? detectedLang.toLowerCase().trim().slice(0, 2) : "en";
      setStoryLanguage(cleanLang);
      localStorage.setItem("narrateai_story_language", cleanLang);

      const voices = synthRef.current ? synthRef.current.getVoices() : [];
      const pool = voices.length > 0 ? voices : availableVoices;
      const assignments = assignVoices(chars, pool, cleanLang);
      const cMap = buildColorMap(dedupedParsed);

      setParsedLines(dedupedParsed);
      setCharacters(chars);
      setColorMap(cMap);
      setVoiceAssignments(assignments);
      setCurrentIndex(0);

      localStorage.setItem("narrateai_story_text", storyText);
      localStorage.setItem("narrateai_parsed_lines", JSON.stringify(dedupedParsed));
      localStorage.setItem("narrateai_characters", JSON.stringify(chars));
      localStorage.setItem("narrateai_color_map", JSON.stringify(cMap));

      const serialized = {};
      for (const [speaker, voiceObj] of Object.entries(assignments)) {
        serialized[speaker] = { name: voiceObj?.name, lang: voiceObj?.lang };
      }
      localStorage.setItem("narrateai_voice_assignments", JSON.stringify(serialized));

      saveStoryToHistory(storyText, dedupedParsed, chars, cMap, serialized, cleanLang);

    } catch (err) {
      console.error(err);
      setRetryInfo(null);
      if (err.status === 401) {
        setError(GROQ_ERROR_MESSAGES.unauthorized);
      } else if (err.status === 429) {
        setError(GROQ_ERROR_MESSAGES.rateLimited);
      } else if (err.status === 503) {
        setError(GROQ_ERROR_MESSAGES.serviceUnavailable);
      } else {
        setError(`Analysis failed: ${err.message || "Please check your story and try again."}`);
      }
    } finally {
      setIsLoading(false);
      setLoadingStep("");
      setRetryInfo(null);
    }
  }

  const hasStory = parsedLines.length > 0;
  const canAnalyze = !!apiKey.trim() && !!storyText.trim() && !isLoading;
  const storyWordCount = storyText.trim() ? storyText.trim().split(/\s+/).filter(Boolean).length : 0;
  const storyCharacterCount = storyText.length;
  const estimatedNarrationDuration = formatNarrationDuration(storyWordCount);

  return (
    <div style={S.page}>
      <Header
        hasStory={hasStory}
        parsedLinesCount={parsedLines.length}
        charactersCount={characters.length}
        showWritingPanel={showWritingPanel}
        setShowWritingPanel={setShowWritingPanel}
        showPlaybackPanel={showPlaybackPanel}
        setShowPlaybackPanel={setShowPlaybackPanel}
        helpButtonRef={helpButtonRef}
        openShortcutsHelp={openShortcutsHelp}
      />

      <div style={{
        ...S.main,
        maxWidth: showWritingPanel && showPlaybackPanel ? "1400px" : "800px",
        transition: "max-width 0.3s ease",
      }}>
        {!speechSupported && (
          <div style={{ ...S.errorBox, marginBottom: "24px" }}>
            ⚠️ <strong>Text-to-Speech Not Supported:</strong> Your browser does not support the Web Speech API or it is currently disabled. Please open this app in Google Chrome or Microsoft Edge to enable voice playback.
          </div>
        )}

        <div style={{
          display: "grid",
          gridTemplateColumns: showWritingPanel && showPlaybackPanel 
            ? "1fr 1fr" 
            : "1fr",
          gap: "32px",
          alignItems: "start",
        }}>
          {showWritingPanel && (
            <div className="left-panel" style={{ minHeight: "0" }}>
              <ApiKeyPanel apiKey={apiKey} onKeyChange={setApiKey} />

              <div style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <label style={{ ...S.label, marginBottom: 0 }}>Your Story</label>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    {`${storyWordCount} words · ${storyCharacterCount} characters · est. ${estimatedNarrationDuration}`}
                  </span>
                </div>
                <textarea
                  value={storyText}
                  onChange={e => setStoryText(e.target.value)}
                  placeholder="Paste any story, chapter, or scene here..."
                  rows={12}
                  style={S.textarea}
                />
              </div>

              <RetryBanner error={error} retryInfo={isLoading ? retryInfo : null} />

              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <button
                  onClick={analyzeStory}
                  disabled={!canAnalyze}
                  style={canAnalyze ? S.btnPrimary : S.btnDisabled}
                >
                  {isLoading ? (
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                      <span style={{
                        width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.4)",
                        borderTopColor: "#fff", borderRadius: "50%",
                        animation: "spin 0.7s linear infinite", display: "inline-block"
                      }} />
                      {chunkProgress && chunkProgress.total > 1
                        ? `Analysing scene ${chunkProgress.current} of ${chunkProgress.total}…`
                        : loadingStep === "groq"
                        ? "Analysing text with AI…"
                        : loadingStep === "parse"
                        ? "Fuzzying speakers & parsing…"
                        : "Assigning neural voices…"}
                    </span>
                  ) : "✨ Analyse & Prepare Voices"}
                </button>

                <select
                  aria-label="Select sample story"
                  value=""
                  onChange={(e) => {
                    const selected = SAMPLE_STORIES.find(s => s.id === e.target.value);
                    if (selected) {
                      setStoryText(selected.text);
                    }
                  }}
                  style={{
                    ...S.btnSecondary,
                    cursor: "pointer",
                    padding: "10px 14px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#94a3b8",
                    fontSize: "12px",
                    fontWeight: 600,
                    borderRadius: "10px",
                  }}
                >
                  <option value="" disabled>✨ Sample Stories ▾</option>
                  {SAMPLE_STORIES.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.icon} {s.genre} - {s.title}
                    </option>
                  ))}
                </select>
              </div>

              {!storyText && !hasStory && (
                <EmptyState
                  onLoadSample={(txt) => setStoryText(txt || SAMPLE_STORY)}
                  sampleStories={SAMPLE_STORIES}
                />
              )}

              <HistoryPanel history={history} onLoadItem={loadHistoryItem} onClear={clearHistory} />
            </div>
          )}

          {showPlaybackPanel && (
            <div className="right-panel" style={{ minHeight: "0" }}>
              {hasStory ? (
                <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "16px" }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    flexWrap: "wrap",
                    paddingBottom: "12px",
                    borderBottom: "1px solid rgba(255,255,255,0.05)"
                  }}>
                    <span style={{ fontSize: "16px" }}>🎙️</span>
                    <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#f1f5f9", flex: 1 }}>Playback Studio</h2>
                    <span style={{ fontSize: "11px", color: "#818cf8", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)", padding: "4px 10px", borderRadius: "6px", fontWeight: 600 }}>
                      🌐 {storyLanguage.toUpperCase()}
                    </span>
                    <span style={{ fontSize: "11px", color: "#64748b", background: "rgba(99,102,241,0.1)", padding: "4px 10px", borderRadius: "6px", fontWeight: 600 }}>
                      {parsedLines.length} lines
                    </span>
                    <div style={{ display: "inline-flex", gap: "6px", marginLeft: "auto" }}>
                      <button
                        onClick={() => exportAsJSON(parsedLines, characters, voiceAssignments)}
                        title="Export as JSON script"
                        style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid rgba(99,102,241,0.25)", background: "rgba(99,102,241,0.1)", color: "#818cf8", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
                      >📦 JSON</button>
                      <button
                        onClick={() => exportAsTranscript(parsedLines, characters)}
                        title="Export as text transcript"
                        style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid rgba(99,102,241,0.25)", background: "rgba(99,102,241,0.1)", color: "#818cf8", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
                      >📝 Transcript</button>
                    </div>
                  </div>

                  <VoiceQualityBanner availableVoices={availableVoices} />
                  
                  {showFinished && (
                    <div style={{
                      background: "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.15) 100%)",
                      border: "1px solid rgba(99,102,241,0.3)",
                      borderRadius: "16px",
                      padding: "28px",
                      textAlign: "center",
                      boxSizing: "border-box",
                      animation: "fadeIn 0.5s ease-out",
                    }}>
                      <div style={{ fontSize: "52px", marginBottom: "12px", animation: "bounce 1s infinite alternate" }}>🎉</div>
                      <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#fff", marginBottom: "6px" }}>Story Narration Complete!</h3>
                      <p style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "18px", lineHeight: 1.6 }}>
                        You've finished listening to <strong>{parsedLines.length}</strong> lines voiced by <strong>{characters.length}</strong> unique characters.
                      </p>
                      <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
                        <button onClick={() => startPlayback(0)} style={{
                          padding: "10px 20px", borderRadius: "10px", border: "none",
                          background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", color: "#fff",
                          fontSize: "12px", fontWeight: 700, cursor: "pointer",
                          boxShadow: "0 4px 15px rgba(99,102,241,0.3)",
                        }}>Replay Story</button>
                        <button onClick={() => { stopPlayback(); setShowWritingPanel(true); }} style={{
                          padding: "10px 20px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(255,255,255,0.05)", color: "#94a3b8",
                          fontSize: "12px", fontWeight: 600, cursor: "pointer",
                        }}>Edit Story</button>
                        <button onClick={() => exportAsJSON(parsedLines, characters, voiceAssignments)} style={{
                          padding: "10px 20px", borderRadius: "10px", border: "1px solid rgba(99,102,241,0.3)",
                          background: "rgba(99,102,241,0.1)", color: "#818cf8",
                          fontSize: "12px", fontWeight: 600, cursor: "pointer",
                        }}>📦 Export JSON</button>
                        <button onClick={() => exportAsTranscript(parsedLines, characters)} style={{
                          padding: "10px 20px", borderRadius: "10px", border: "1px solid rgba(99,102,241,0.3)",
                          background: "rgba(99,102,241,0.1)", color: "#818cf8",
                          fontSize: "12px", fontWeight: 600, cursor: "pointer",
                        }}>📝 Export Transcript</button>
                      </div>
                    </div>
                  )}

                  <CharacterPanel
                    characters={characters}
                    colorMap={colorMap}
                    voiceAssignments={resolvedVoiceAssignments}
                  />
                  
                  <div style={{
                    flex: 1,
                    minHeight: "400px",
                    overflowY: "auto",
                    paddingRight: "8px",
                    borderRadius: "12px",
                    padding: "16px",
                    background: "rgba(0, 0, 0, 0.18)",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    boxShadow: "inset 0 2px 8px rgba(0,0,0,0.3)",
                  }}>
                    {parsedLines.map((line, i) => (
                      <StoryLine
                        key={i}
                        line={line}
                        isActive={i === currentIndex}
                        activeCharIndex={i === currentIndex ? activeCharIndex : null}
                        colorMap={colorMap}
                        onClick={() => startPlayback(i)}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                storyText && <div style={{
                  textAlign: "center", padding: "48px 24px", color: "#64748b",
                  border: "2px dashed rgba(255,255,255,0.05)", borderRadius: "16px",
                }}>
                  <div style={{ fontSize: "36px", marginBottom: "12px" }}>⚡</div>
                  <div>Click <strong>Analyse & Prepare Voices</strong> in the Writer panel to build the audiobook view.</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showPlaybackPanel && hasStory && (
        <PlaybackControls
          isPlaying={isPlaying}
          currentIndex={currentIndex}
          total={parsedLines.length}
          onPlay={handlePlay}
          onPause={pausePlayback}
          onStop={stopPlayback}
          onPrev={skipBackward}
          onNext={skipForward}
          speed={speed}
          onSpeedChange={handleSpeedChange}
          disabled={isLoading}
        />
      )}

      {/* Accessible live region for screen readers */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {isPlaying && parsedLines[currentIndex]
          ? `Now reading line ${currentIndex + 1} of ${parsedLines.length}, voiced by ${parsedLines[currentIndex].speaker}: ${parsedLines[currentIndex].text}`
          : showFinished
          ? `Story narration complete! ${parsedLines.length} lines finished.`
          : ""}
      </div>

      <ShortcutsModal
        isOpen={isHelpOpen}
        onClose={closeShortcutsHelp}
        helpDialogRef={helpDialogRef}
        shortcuts={KEYBOARD_SHORTCUTS}
      />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounce { from { transform: translateY(0); } to { transform: translateY(-4px); } }
        textarea:focus, input:focus { border-color: rgba(99,102,241,0.6) !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
        button:not(:disabled):hover { filter: brightness(1.1); transform: translateY(-1px); }
        button:focus-visible, select:focus-visible, input:focus-visible, textarea:focus-visible, [tabindex]:focus-visible {
          outline: 2px solid #818cf8 !important;
          outline-offset: 2px !important;
          box-shadow: 0 0 0 4px rgba(99,102,241,0.4) !important;
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border-width: 0;
        }
        select option { background: #1a1a2e; color: #e2e8f0; }
        
        @media (min-width: 860px) {
          .left-panel { display: block !important; }
        }
      `}</style>
    </div>
  );
}
