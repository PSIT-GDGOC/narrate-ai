/* global chrome */
const MENU_ID = "narrateai-narrate-selection";
const DEFAULT_APP_URL = "http://localhost:5173";
const MAX_STORY_LENGTH = 8000;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Narrate with NarrateAI",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText) return;

  const selectedText = info.selectionText.trim();
  if (!selectedText) return;

  // Persist the selected text so popup and app can access it
  await chrome.storage.local.set({
    pendingText: selectedText,
    selectedStoryText: selectedText,
  });

  try {
    // Attempt to open the extension popup directly (Chrome 127+)
    if (chrome.action && typeof chrome.action.openPopup === "function") {
      await chrome.action.openPopup();
      return;
    }
  } catch {
    // If openPopup is not allowed or fails, open web app tab as seamless fallback
  }

  try {
    const { appUrl } = await chrome.storage.sync.get("appUrl");
    const baseUrl = (appUrl || DEFAULT_APP_URL).replace(/\/+$/, "");
    const encodedStory = encodeURIComponent(selectedText.slice(0, MAX_STORY_LENGTH));
    await chrome.tabs.create({ url: `${baseUrl}/#story=${encodedStory}` });
  } catch (err) {
    console.error("Failed to open NarrateAI web application tab:", err);
  }
});
