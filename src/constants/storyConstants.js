export const EMOTION_PARAMS = {
  neutral:   { pitch: 1.0,  rate: 1.0,  volume: 1.0  },
  happy:     { pitch: 1.2,  rate: 1.1,  volume: 1.0  },
  angry:     { pitch: 0.9,  rate: 1.2,  volume: 1.0  },
  sad:       { pitch: 0.8,  rate: 0.75, volume: 0.85 },
  fearful:   { pitch: 1.2,  rate: 1.3,  volume: 0.9  },
  excited:   { pitch: 1.3,  rate: 1.25, volume: 1.0  },
  surprised: { pitch: 1.35, rate: 1.15, volume: 1.0  },
};

export const CHARACTER_COLORS = [
  { bg: "rgba(99,102,241,0.12)",  border: "#6366f1", text: "#6366f1", dot: "#6366f1" },
  { bg: "rgba(245,158,11,0.12)",  border: "#f59e0b", text: "#d97706", dot: "#f59e0b" },
  { bg: "rgba(139,92,246,0.12)",  border: "#8b5cf6", text: "#7c3aed", dot: "#8b5cf6" },
  { bg: "rgba(34,197,94,0.12)",   border: "#22c55e", text: "#16a34a", dot: "#22c55e" },
  { bg: "rgba(236,72,153,0.12)",  border: "#ec4899", text: "#db2777", dot: "#ec4899" },
  { bg: "rgba(249,115,22,0.12)",  border: "#f97316", text: "#ea580c", dot: "#f97316" },
  { bg: "rgba(20,184,166,0.12)",  border: "#14b8a6", text: "#0d9488", dot: "#14b8a6" },
  { bg: "rgba(217,70,239,0.12)",  border: "#d946ef", text: "#c026d3", dot: "#d946ef" },
];

export const NARRATOR_COLOR = { bg: "rgba(156,163,175,0.1)", border: "#9ca3af", text: "#6b7280", dot: "#9ca3af" };

export const FEMALE_HINTS = ["feminine","female","woman","girl","lady","motherly","sisterly","queen","princess","witch","goddess","gentle","soft","nurturing","melodic"];
export const MALE_HINTS   = ["masculine","male","man","boy","gruff","deep","baritone","kingly","wizard","warrior","commanding","stern","booming","husky","rough"];
export const OLD_HINTS    = ["ancient","old","elderly","aged","wise","weathered","grizzled","veteran"];
export const YOUNG_HINTS  = ["young","child","childlike","youthful","teenage","boy","girl","innocent","naive","playful"];

export const SAMPLE_STORY = `Frodo looked up at Gandalf with wide eyes. "I can't do this," he whispered. "The Ring is too heavy, too powerful. I'm just a hobbit from the Shire."

Gandalf knelt beside him, his voice low and firm. "That is precisely why you were chosen. Not because you are strong, but because you are good."

Sam rushed to his master's side, breathless from running. "Mr. Frodo! I've been looking everywhere for you!" He grabbed Frodo's hand tightly. "Whatever happens, I'm coming with you. You're not alone in this."

Frodo felt a warmth spread through him despite the cold mountain air. He looked at his dearest friend and managed a small smile. "You always find me, Sam."

"Always," Sam replied, and his voice carried a fierce certainty that no darkness could quite touch.

Aragorn emerged from the shadows, his hand resting on the hilt of his sword. "We cannot linger here. The enemy moves faster than we anticipated."

Legolas tilted his head, his elven eyes scanning the treeline. "He is right. I can hear them — at least a hundred, perhaps more. We must go now."

Gimli hefted his axe with a grunt. "Let them come. I've not had a decent fight since Moria." He looked at the others and added, more quietly, "Though I suppose running is also acceptable."`;

export const SYSTEM_PROMPT = `You are an expert literary analyst and audiobook director. Your job is to parse story text and extract structured dialogue data for an AI-powered multi-voice audiobook engine called NarrateAI.

RULES:
- Break the story into individual lines/sentences — each becomes one audio unit.
- For narration (non-dialogue), set speaker to "Narrator".
- Identify ALL unique speaking characters accurately.
- IF A CHARACTER IS THINKING (inner monologue, silent realization, or unspoken thoughts), set the "speaker" to that character (NOT "Narrator") and set "isThought" to true. For spoken dialogue or regular narrator text, set "isThought" to false.
- Choose emotion from ONLY this list: neutral, happy, angry, sad, fearful, excited, surprised.
- IMPORTANT: AVOID using "neutral" if there is any emotional undertone in the text — lean towards the active emotion (e.g. if a character is whispering in fear, use "fearful"; if welcoming, use "happy").
- persona: 4-6 descriptive words about the character (e.g. "wise elderly masculine gruff calm" or "energetic young feminine high-pitched fast"). Capture gender, age, vocal traits, and personality to help the voice assignment engine.
- voiceProfile pitch: between 0.6 and 1.8 (1.0 = normal, higher = lighter/higher voice).
- voiceProfile rate: between 0.8 and 1.3 (1.0 = normal speed).
- Make voice profiles VERY distinctly different between characters.
- language: the ISO 639-1 two-letter lowercase code of the language the line's "text" is written in (e.g. "en", "es", "fr", "de", "hi"). Include it on EVERY line. Detect it from the story itself.
- NEVER translate the story. Keep every "text" value in its original language exactly as written, and keep character names as written in the story.
- Always keep the narrator's speaker value as the literal English word "Narrator", and ALWAYS write "emotion" and "persona" in English (emotion must come from the English list above), whatever language the story is in. The voice engine depends on this.
- Return ONLY a valid JSON array. No explanation, no markdown fences, no preamble whatsoever.

OUTPUT FORMAT:
[
  {
    "speaker": "Narrator",
    "text": "The old man walked slowly.",
    "emotion": "neutral",
    "isThought": false,
    "language": "en",
    "persona": "calm measured eloquent narrative voice",
    "voiceProfile": { "pitch": 1.0, "rate": 0.95 }
  },
  {
    "speaker": "Gandalf",
    "text": "You shall not pass!",
    "emotion": "angry",
    "isThought": false,
    "language": "en",
    "persona": "wise elderly masculine commanding gruff",
    "voiceProfile": { "pitch": 0.75, "rate": 0.9 }
  },
  {
    "speaker": "Frodo",
    "text": "How will we ever get past the gate?",
    "emotion": "fearful",
    "isThought": true,
    "language": "en",
    "persona": "brave young hobbit anxious masculine",
    "voiceProfile": { "pitch": 1.1, "rate": 1.05 }
  }
]`;

export const DEFAULT_STORY_LANGUAGE = "en";

// Browsers still report a few legacy ISO 639 codes (notably Android Chrome / Java).
export const LEGACY_LANGUAGE_CODES = { iw: "he", in: "id", ji: "yi" };

// Used only when the model omits or garbles the "language" field: non-Latin
// scripts identify the language (or a very likely one) without an API call.
export const SCRIPT_LANGUAGE_HINTS = [
  { code: "hi", regex: /[\u0900-\u097F]/g },
  { code: "bn", regex: /[\u0980-\u09FF]/g },
  { code: "pa", regex: /[\u0A00-\u0A7F]/g },
  { code: "gu", regex: /[\u0A80-\u0AFF]/g },
  { code: "ta", regex: /[\u0B80-\u0BFF]/g },
  { code: "te", regex: /[\u0C00-\u0C7F]/g },
  { code: "kn", regex: /[\u0C80-\u0CFF]/g },
  { code: "ml", regex: /[\u0D00-\u0D7F]/g },
  { code: "th", regex: /[\u0E00-\u0E7F]/g },
  { code: "ko", regex: /[\uAC00-\uD7AF]/g },
  { code: "ja", regex: /[\u3040-\u30FF]/g },
  { code: "zh", regex: /[\u4E00-\u9FFF]/g },
  { code: "ar", regex: /[\u0600-\u06FF]/g },
  { code: "he", regex: /[\u0590-\u05FF]/g },
  { code: "el", regex: /[\u0370-\u03FF]/g },
  { code: "ru", regex: /[\u0400-\u04FF]/g },
];

export const NARRATION_WORDS_PER_MINUTE = 140;

export const GROQ_RETRY_DELAYS_MS = [1000, 2000, 4000];
export const GROQ_MAX_RETRIES = GROQ_RETRY_DELAYS_MS.length;
export const GROQ_RETRY_BUDGET_MS = 30000;
export const GROQ_ERROR_MESSAGES = {
  unauthorized: "Invalid API Key. Please double-check your Groq API key at https://console.groq.com/keys",
  rateLimited: "Rate Limit Exceeded. Please wait a minute and try again.",
  serviceUnavailable: "Service Unavailable. Please try again shortly.",
};

export const KEYBOARD_SHORTCUTS = [
  { keys: "Space", action: "Play / Pause" },
  { keys: "R", action: "Reset" },
  { keys: "Left Arrow", action: "Previous Line" },
  { keys: "Right Arrow", action: "Next Line" },
];
