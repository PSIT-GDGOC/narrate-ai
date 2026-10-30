/* global chrome */
const MAX_STORY_CHARS = 8000;
const DEFAULT_APP_URL = "http://localhost:5173";

const storyTextEl = document.getElementById("storyText");
const charCountEl = document.getElementById("charCount");
const playBtn = document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");
const stopBtn = document.getElementById("stopBtn");
const rateRange = document.getElementById("rateRange");
const rateLabel = document.getElementById("rateLabel");
const openAppBtn = document.getElementById("openAppBtn");
const grabBtn = document.getElementById("grabBtn");
const appUrlInput = document.getElementById("appUrlInput");
const statusBar = document.getElementById("statusBar");

function setStatus(text, isPlaying = false) {
  statusBar.textContent = text;
  if (isPlaying) {
    statusBar.classList.add("playing");
  } else {
    statusBar.classList.remove("playing");
  }
}

function updateCharCount() {
  const len = storyTextEl.value.length;
  const words = storyTextEl.value.trim() ? storyTextEl.value.trim().split(/\s+/).length : 0;
  const estMinutes = Math.ceil(words / 150);
  charCountEl.textContent = `${len} chars · ~${words} words${words > 0 ? ` (~${estMinutes}m)` : ""}`;
}

// Split text into digestible chunks for Web Speech API to prevent Chrome stalling
function chunkText(text, size = 180) {
  const sentences = text.match(/[^.!?\n]+[.!?]*\s*/g) || [text];
  const chunks = [];
  let current = "";
  for (const s of sentences) {
    if ((current + s).length > size && current) {
      chunks.push(current.trim());
      current = "";
    }
    current += s;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [text];
}

function stopNarration() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  setStatus("Stopped");
}

function playNarration() {
  const text = storyTextEl.value.trim();
  if (!text) {
    setStatus("Please enter or highlight some story text first.");
    return;
  }

  if (typeof window === "undefined" || !window.speechSynthesis) {
    setStatus("Speech synthesis is not supported in this browser.");
    return;
  }

  window.speechSynthesis.cancel();
  const chunks = chunkText(text);
  const rate = Number(rateRange.value) || 1.0;

  chunks.forEach((chunk, index) => {
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.rate = rate;

    if (index === 0) {
      utterance.onstart = () => {
        setStatus("Narrating…", true);
      };
    }

    if (index === chunks.length - 1) {
      utterance.onend = () => {
        setStatus("Finished narration");
      };
    }

    utterance.onerror = (e) => {
      console.warn("Speech synthesis error", e);
      setStatus("Narration ended");
    };

    window.speechSynthesis.speak(utterance);
  });
}

function pauseResumeNarration() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  const synth = window.speechSynthesis;
  if (synth.paused) {
    synth.resume();
    setStatus("Resumed narration…", true);
  } else if (synth.speaking) {
    synth.pause();
    setStatus("Paused");
  } else {
    playNarration();
  }
}

async function grabFromActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      setStatus("No active webpage found.");
      return;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString(),
    });

    if (results && results[0]?.result) {
      const selected = results[0].result.trim();
      if (selected) {
        storyTextEl.value = selected;
        updateCharCount();
        await chrome.storage.local.set({
          pendingText: selected,
          selectedStoryText: selected,
        });
        setStatus("Grabbed selection from page!");
        return;
      }
    }
    setStatus("No highlighted text found on the active page.");
  } catch (err) {
    console.error("Failed to grab selection", err);
    setStatus("Could not grab selection from this tab.");
  }
}

async function openInNarrateAI() {
  const text = storyTextEl.value.trim().slice(0, MAX_STORY_CHARS);
  if (!text) {
    setStatus("Please enter or highlight some story text first.");
    return;
  }

  stopNarration();

  const baseUrl = (appUrlInput.value || DEFAULT_APP_URL).trim().replace(/\/+$/, "");
  await chrome.storage.sync.set({ appUrl: baseUrl });
  await chrome.storage.local.set({ selectedStoryText: text, pendingText: text });

  const encoded = encodeURIComponent(text);
  const targetUrl = `${baseUrl}/#story=${encoded}`;

  await chrome.tabs.create({ url: targetUrl });
  setStatus("Launched NarrateAI!");
}

// Event Listeners
playBtn.addEventListener("click", playNarration);
pauseBtn.addEventListener("click", pauseResumeNarration);
stopBtn.addEventListener("click", stopNarration);
grabBtn.addEventListener("click", grabFromActiveTab);
openAppBtn.addEventListener("click", openInNarrateAI);

rateRange.addEventListener("input", () => {
  rateLabel.textContent = `${Number(rateRange.value).toFixed(1)}×`;
});

storyTextEl.addEventListener("input", () => {
  updateCharCount();
  chrome.storage.local.set({ selectedStoryText: storyTextEl.value });
});

appUrlInput.addEventListener("change", () => {
  chrome.storage.sync.set({ appUrl: appUrlInput.value.trim() });
});

window.addEventListener("unload", () => {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
});

// Initializer
(async function init() {
  try {
    const { pendingText, selectedStoryText } = await chrome.storage.local.get([
      "pendingText",
      "selectedStoryText",
    ]);
    const { appUrl } = await chrome.storage.sync.get("appUrl");

    appUrlInput.value = appUrl || DEFAULT_APP_URL;

    const initialText = pendingText || selectedStoryText || "";
    if (initialText) {
      storyTextEl.value = initialText;
      updateCharCount();
      // Clear pending text once loaded
      await chrome.storage.local.remove("pendingText");
    }
  } catch (err) {
    console.warn("Extension init error", err);
  }
})();
