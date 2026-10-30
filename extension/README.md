# 🎙️ NarrateAI Browser Extension (Manifest V3)

A Chrome Manifest V3 browser extension that allows you to highlight text on any webpage (news articles, blogs, Wattpad stories, documentation) and instantly narrate it with dynamic AI voices or quick built-in speech playback.

---

## ✨ Features

- **Context Menu Integration**: Right-click highlighted text on any webpage and select **"Narrate with NarrateAI"**.
- **Instant Audio Player**: Built-in popup player with Play, Pause, Stop, and customizable playback speed (0.5× – 2.0×).
- **Auto-Chunking TTS**: Automatically splits longer texts into natural sentences to ensure Chrome's `speechSynthesis` engine never stalls or times out.
- **Dynamic Story Narration**: One-click **"Launch NarrateAI (Dynamic Voices)"** button transfers the text into the NarrateAI web app via safe URL hash encoding for character detection and multi-voice acting.
- **Grab Active Selection**: Click "Grab Highlighted" in the popup to extract the selected text from your current browser tab without right-clicking.
- **Configurable App URL**: Test locally (`http://localhost:5173`) or use the production deployment URL (`https://narrate-ai-gamma.vercel.app`).

---

## 🚀 How to Load the Extension in Chrome (Developer Mode)

1. Open Google Chrome.
2. Navigate to `chrome://extensions/` in your address bar.
3. Toggle on **Developer mode** in the top-right corner.
4. Click the **Load unpacked** button in the top-left corner.
5. In the file picker, select the `extension/` folder in this repository (`narrate-ai/extension`).
6. The **NarrateAI - Web Story Narrator** extension is now installed!
7. *(Optional)* Click the puzzle piece icon in the Chrome toolbar and pin **NarrateAI** for fast access.

---

## 📖 Usage Instructions

### Method 1: Context Menu (Recommended)
1. Highlight any portion of text or story on any webpage.
2. Right-click the highlighted text.
3. Click **"Narrate with NarrateAI"** in the context menu.
4. NarrateAI opens with your text automatically loaded and ready for analysis and narration.

### Method 2: Popup Toolbar Player
1. Click the **NarrateAI** icon in your browser toolbar.
2. Click **"Grab Highlighted"** to capture whatever text is currently selected on your active webpage, or paste text directly into the textarea.
3. Use the built-in **▶ Play**, **⏸ Pause**, and **⏹ Stop** controls for fast audio reading.
4. Click **"Launch NarrateAI (Dynamic Voices)"** to pass the story into the NarrateAI web application for full character extraction, emotional analysis, and multi-speaker voice synthesis.

---

## 🛠️ Permissions Explained

- `activeTab`: Allows capturing highlighted text from your current tab when clicking "Grab Highlighted".
- `contextMenus`: Creates the right-click "Narrate with NarrateAI" option on highlighted text selections.
- `storage`: Persists your preferred app URL and last narrated text snippet locally in your browser.
- `scripting`: Enables safe extraction of highlighted text directly from the active tab.

---

## 🔄 Development & Reloading

Whenever you make changes to files in `extension/`:
1. Go to `chrome://extensions/`.
2. Locate the **NarrateAI** card.
3. Click the circular **Reload** icon on the card to apply changes immediately.
