import { useState, useRef, useEffect, useCallback } from "react";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const EMOTION_PARAMS = {
  neutral:   { pitch: 1.0,  rate: 1.0,  volume: 1.0  },
  happy:     { pitch: 1.2,  rate: 1.1,  volume: 1.0  },
  angry:     { pitch: 0.9,  rate: 1.2,  volume: 1.0  },
  sad:       { pitch: 0.8,  rate: 0.75, volume: 0.85 },
  fearful:   { pitch: 1.2,  rate: 1.3,  volume: 0.9  },
  excited:   { pitch: 1.3,  rate: 1.25, volume: 1.0  },
  surprised: { pitch: 1.35, rate: 1.15, volume: 1.0  },
};

const CHARACTER_COLORS = [
  { bg: "rgba(99,102,241,0.12)",  border: "#6366f1", text: "#6366f1", dot: "#6366f1" },
  { bg: "rgba(245,158,11,0.12)",  border: "#f59e0b", text: "#d97706", dot: "#f59e0b" },
  { bg: "rgba(139,92,246,0.12)",  border: "#8b5cf6", text: "#7c3aed", dot: "#8b5cf6" },
  { bg: "rgba(34,197,94,0.12)",   border: "#22c55e", text: "#16a34a", dot: "#22c55e" },
  { bg: "rgba(236,72,153,0.12)",  border: "#ec4899", text: "#db2777", dot: "#ec4899" },
  { bg: "rgba(249,115,22,0.12)",  border: "#f97316", text: "#ea580c", dot: "#f97316" },
  { bg: "rgba(20,184,166,0.12)",  border: "#14b8a6", text: "#0d9488", dot: "#14b8a6" },
  { bg: "rgba(217,70,239,0.12)",  border: "#d946ef", text: "#c026d3", dot: "#d946ef" },
];

const NARRATOR_COLOR = { bg: "rgba(156,163,175,0.1)", border: "#9ca3af", text: "#6b7280", dot: "#9ca3af" };

const FEMALE_HINTS = ["feminine","female","woman","girl","lady","motherly","sisterly","queen","princess","witch","goddess","gentle","soft","nurturing","melodic"];
const MALE_HINTS   = ["masculine","male","man","boy","gruff","deep","baritone","kingly","wizard","warrior","commanding","stern","booming","husky","rough"];
const OLD_HINTS    = ["ancient","old","elderly","aged","wise","weathered","grizzled","veteran"];
const YOUNG_HINTS  = ["young","child","childlike","youthful","teenage","boy","girl","innocent","naive","playful"];

const SAMPLE_STORY = `Frodo looked up at Gandalf with wide eyes. "I can't do this," he whispered. "The Ring is too heavy, too powerful. I'm just a hobbit from the Shire."

Gandalf knelt beside him, his voice low and firm. "That is precisely why you were chosen. Not because you are strong, but because you are good."

Sam rushed to his master's side, breathless from running. "Mr. Frodo! I've been looking everywhere for you!" He grabbed Frodo's hand tightly. "Whatever happens, I'm coming with you. You're not alone in this."

Frodo felt a warmth spread through him despite the cold mountain air. He looked at his dearest friend and managed a small smile. "You always find me, Sam."

"Always," Sam replied, and his voice carried a fierce certainty that no darkness could quite touch.

Aragorn emerged from the shadows, his hand resting on the hilt of his sword. "We cannot linger here. The enemy moves faster than we anticipated."

Legolas tilted his head, his elven eyes scanning the treeline. "He is right. I can hear them — at least a hundred, perhaps more. We must go now."

Gimli hefted his axe with a grunt. "Let them come. I've not had a decent fight since Moria." He looked at the others and added, more quietly, "Though I suppose running is also acceptable."`;

const SYSTEM_PROMPT = `You are an expert literary analyst and audiobook director. Your job is to parse story text and extract structured dialogue data for an AI-powered multi-voice audiobook engine called NarrateAI.

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
- Return ONLY a valid JSON array. No explanation, no markdown fences, no preamble whatsoever.

OUTPUT FORMAT:
[
  {
    "speaker": "Narrator",
    "text": "The old man walked slowly.",
    "emotion": "neutral",
    "isThought": false,
    "persona": "calm measured eloquent narrative voice",
    "voiceProfile": { "pitch": 1.0, "rate": 0.95 }
  },
  {
    "speaker": "Gandalf",
    "text": "You shall not pass!",
    "emotion": "angry",
    "isThought": false,
    "persona": "wise elderly masculine commanding gruff",
    "voiceProfile": { "pitch": 0.75, "rate": 0.9 }
  },
  {
    "speaker": "Frodo",
    "text": "How will we ever get past the gate?",
    "emotion": "fearful",
    "isThought": true,
    "persona": "brave young hobbit anxious masculine",
    "voiceProfile": { "pitch": 1.1, "rate": 1.05 }
  }
]`;

// ─── HELPER FOR INDESTRUCTIBLE ROBUST JSON EXTRACTION ────────────────────────
function cleanAndParseJSON(rawText) {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("Empty response received from AI model.");
  }

  let cleaned = rawText.trim();

  // 1. Strip markdown code fences (```json ... ``` or ``` ...)
  cleaned = cleaned.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();

  // 2. Direct fast-path parse
  try {
    const direct = JSON.parse(cleaned);
    if (Array.isArray(direct)) return direct;
    if (direct && typeof direct === "object") {
      for (const k of ["lines", "dialogue", "story", "output", "data"]) {
        if (Array.isArray(direct[k])) return direct[k];
      }
      return [direct];
    }
  } catch {
    // Proceed to auto-repair
  }

  // 3. Extract the primary JSON segment
  const firstBracket = cleaned.indexOf("[");
  const firstBrace = cleaned.indexOf("{");

  let rootType = "array";
  let startIdx = firstBracket;
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    rootType = "object";
    startIdx = firstBrace;
  }

  if (startIdx !== -1) {
    cleaned = cleaned.substring(startIdx);
  }

  // 4. Auto-repair missing commas between objects: } \s* {  -->  }, {
  cleaned = cleaned.replace(/\}\s*(?=\{)/g, "},");

  // 5. Auto-repair missing commas between array elements: ] \s* [  -->  ], [
  cleaned = cleaned.replace(/\]\s*(?=\[)/g, "],");

  // 6. Strip invalid trailing commas before closing braces/brackets
  cleaned = cleaned.replace(/,\s*([\]\}])/g, "$1");

  // 7. Auto-repair truncated output (e.g., token limit cutoff)
  if (rootType === "array") {
    const lastBracket = cleaned.lastIndexOf("]");
    if (lastBracket !== -1) {
      cleaned = cleaned.substring(0, lastBracket + 1);
    } else {
      const lastBrace = cleaned.lastIndexOf("}");
      if (lastBrace !== -1) {
        cleaned = cleaned.substring(0, lastBrace + 1) + "\n]";
      } else {
        cleaned = cleaned + "\n]";
      }
    }
  } else {
    const lastBrace = cleaned.lastIndexOf("}");
    if (lastBrace !== -1) {
      cleaned = cleaned.substring(0, lastBrace + 1);
    } else {
      cleaned = cleaned + "\n}";
    }
  }

  // 8. Try parsing again after syntactic normalization
  try {
    const repaired = JSON.parse(cleaned);
    if (Array.isArray(repaired)) return repaired;
    if (repaired && typeof repaired === "object") {
      for (const k of ["lines", "dialogue", "story", "output", "data"]) {
        if (Array.isArray(repaired[k])) return repaired[k];
      }
      return [repaired];
    }
  } catch {
    // 9. Aggressive object-by-object salvage as ultimate safety net
    const objectRegex = /\{[\s\S]*?\}(?=\s*[,\]\}]|\s*\{|\s*$)/g;
    const matches = cleaned.match(objectRegex);
    if (matches && matches.length > 0) {
      const recovered = [];
      for (const m of matches) {
        try {
          const fixedObj = m.replace(/,\s*\}/g, "}");
          const obj = JSON.parse(fixedObj);
          if (obj && (obj.text || obj.speaker)) {
            recovered.push(obj);
          }
        } catch {
          // ignore corrupted single unit
        }
      }
      if (recovered.length > 0) {
        return recovered;
      }
    }
  }

  // If all automated repairs failed, throw with actionable message
  throw new Error("Unable to parse AI story analysis. The AI returned an unparseable response.");
}

// ─── FUZZY SPEAKER DEDUPLICATION ──────────────────────────────────────────────
function deduplicateSpeakers(parsedLines) {
  const speakers = Array.from(new Set(parsedLines.map(l => l.speaker))).filter(s => s !== "Narrator");
  const aliasMap = {};
  
  for (let i = 0; i < speakers.length; i++) {
    for (let j = i + 1; j < speakers.length; j++) {
      const s1 = speakers[i];
      const s2 = speakers[j];
      
      const name1 = s1.toLowerCase();
      const name2 = s2.toLowerCase();
      
      const words1 = name1.split(/\s+/).filter(w => !["mr", "mrs", "ms", "lord", "lady", "sir"].includes(w));
      const words2 = name2.split(/\s+/).filter(w => !["mr", "mrs", "ms", "lord", "lady", "sir"].includes(w));
      
      const hasOverlap = words1.some(w => words2.includes(w) && w.length > 2); // only match overlaps of significant length
      
      if (name1.includes(name2) || name2.includes(name1) || hasOverlap) {
        const primary = s1.length <= s2.length ? s1 : s2;
        const alias = s1.length > s2.length ? s1 : s2;
        aliasMap[alias] = primary;
      }
    }
  }
  
  return parsedLines.map(line => {
    if (aliasMap[line.speaker]) {
      return { ...line, speaker: aliasMap[line.speaker] };
    }
    return line;
  });
}

// ─── INDIVIDUAL GROQ ATTEMPT ──────────────────────────────────────────────────
async function callGroqWithModel(apiKey, storyText, model, retryPromptSuffix = "", maxTokens = 4096) {
  const url = "https://api.groq.com/openai/v1/chat/completions";

  const userContent = retryPromptSuffix 
    ? `Analyze this story:\n\n${storyText}\n\n${retryPromptSuffix}`
    : `Analyze this story:\n\n${storyText}`;

  const body = {
    model: model,
    temperature: 0.4,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: userContent },
    ],
  };

  if (model.includes("gpt-oss")) {
    body.reasoning_format = "hidden";
    body.reasoning_effort = "low";
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000); // 35-second timeout

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (data.error) {
      const errMsg = data.error.message || JSON.stringify(data.error);
      // Auto-retry if rate limit or token limit specifies an allowed Limit
      if ((errMsg.includes("OTPM") || errMsg.includes("limit") || errMsg.includes("max_tokens") || errMsg.includes("Requested")) && maxTokens > 500) {
        const limitMatch = errMsg.match(/Limit\s+(\d+)/i);
        const lowerTokens = limitMatch ? Math.min(parseInt(limitMatch[1], 10), 950) : 950;
        console.warn(`Retrying ${model} with reduced max_tokens=${lowerTokens} due to tier limit constraint.`);
        return await callGroqWithModel(apiKey, storyText, model, retryPromptSuffix, lowerTokens);
      }
      throw new Error(errMsg);
    }

    return data.choices?.[0]?.message?.content || "";
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error(`Timeout after 35 seconds for model ${model}.`);
    }
    throw err;
  }
}

// ─── DYNAMIC GROQ MODEL DISCOVERY ─────────────────────────────────────────────
async function fetchActiveGroqModels(apiKey) {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.data || !Array.isArray(data.data)) return null;

    // Filter out audio, whisper, embeddings, moderation, and deprecated models
    const excluded = ["whisper", "guard", "embed", "moderation", "tts", "stt", "vision", "compound-mini", "llama3-70b", "llama3-8b"];
    const textModels = data.data
      .map(m => m.id)
      .filter(id => id && !excluded.some(ex => id.toLowerCase().includes(ex)));

    // Prioritize high-capacity models first (10,000+ TPM), then Qwen/Gemma
    const preferred = [
      "llama-3.3-70b-versatile",
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "llama-3.1-70b-versatile",
      "llama-3.1-8b-instant",
      "gemma2-9b-it",
      "qwen/qwen3.8-27b",
      "qwen/qwen3.6-27b",
      "qwen-2.5-32b",
    ];

    const sorted = [
      ...preferred.filter(m => textModels.includes(m)),
      ...textModels.filter(m => !preferred.includes(m)),
    ];

    return sorted.length > 0 ? sorted : null;
  } catch (e) {
    console.warn("Dynamic model query failed:", e);
    return null;
  }
}

// ─── STORY CHUNKING ENGINE FOR UNLIMITED LENGTH STORIES ───────────────────────
function splitStoryIntoChunks(storyText, targetWords = 320) {
  if (!storyText || !storyText.trim()) return [];

  const rawParagraphs = storyText.split(/\n+/).map(p => p.trim()).filter(Boolean);
  if (rawParagraphs.length === 0) return [storyText.trim()];

  const totalWords = storyText.split(/\s+/).filter(Boolean).length;
  if (totalWords <= 380) {
    return [storyText.trim()];
  }

  const chunks = [];
  let currentChunk = [];
  let currentWords = 0;

  for (const para of rawParagraphs) {
    const paraWords = para.split(/\s+/).filter(Boolean).length;

    if (paraWords > targetWords * 1.3) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join("\n\n"));
        currentChunk = [];
        currentWords = 0;
      }

      const sentences = para.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [para];
      let subChunk = [];
      let subWords = 0;

      for (const sent of sentences) {
        const sentWords = sent.split(/\s+/).filter(Boolean).length;
        if (subWords + sentWords > targetWords && subChunk.length > 0) {
          chunks.push(subChunk.join(" ").trim());
          subChunk = [sent.trim()];
          subWords = sentWords;
        } else {
          subChunk.push(sent.trim());
          subWords += sentWords;
        }
      }

      if (subChunk.length > 0) {
        chunks.push(subChunk.join(" ").trim());
      }
      continue;
    }

    if (currentWords + paraWords > targetWords && currentChunk.length > 0) {
      chunks.push(currentChunk.join("\n\n"));
      currentChunk = [para];
      currentWords = paraWords;
    } else {
      currentChunk.push(para);
      currentWords += paraWords;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join("\n\n"));
  }

  return chunks;
}

// ─── SINGLE CHUNK ANALYZER ───────────────────────────────────────────────────
async function callGroqSingleChunk(apiKey, chunkText, models, knownCharacters = {}) {
  let charPrompt = "";
  const knownKeys = Object.keys(knownCharacters);
  if (knownKeys.length > 0) {
    const charList = Object.entries(knownCharacters).map(([name, persona]) => `"${name}" (${persona})`).join(", ");
    charPrompt = `\n\nALREADY INTRODUCED CHARACTERS: ${charList}. If any of these characters appear or speak, use their EXACT name and persona.`;
  }
  const textWithContext = chunkText + charPrompt;

  let lastError = null;
  for (const model of models) {
    const defaultTokens = model.toLowerCase().includes("qwen") ? 950 : 4096;
    try {
      const rawText = await callGroqWithModel(apiKey, textWithContext, model, "", defaultTokens);
      try {
        return cleanAndParseJSON(rawText);
      } catch (parseErr) {
        console.warn(`JSON parsing failed with model ${model}, retrying with correction...`, parseErr);
        const retrySuffix = "IMPORTANT: Return ONLY a valid JSON array. Each element MUST be separated by a comma. No markdown wrapping.";
        const retryRawText = await callGroqWithModel(apiKey, textWithContext, model, retrySuffix, defaultTokens);
        return cleanAndParseJSON(retryRawText);
      }
    } catch (err) {
      console.warn(`Groq model ${model} failed for chunk:`, err.message);
      lastError = err;
      if (err.message?.includes("Invalid API key") || err.message?.includes("401") || err.message?.includes("invalid_api_key")) {
        throw err;
      }
    }
  }
  throw lastError || new Error("Failed to analyze scene chunk.");
}

// ─── MASTER GROQ CALL WITH AUTOMATIC SCENE CHUNKING ──────────────────────────
async function callGroq(apiKey, storyText, onProgress) {
  const chunks = splitStoryIntoChunks(storyText, 320);
  const dynamicModels = await fetchActiveGroqModels(apiKey);
  const fallbackModels = [
    "llama-3.3-70b-versatile",
    "openai/gpt-oss-120b",
    "llama-3.1-8b-instant",
    "openai/gpt-oss-20b",
    "gemma2-9b-it",
  ];
  const models = (dynamicModels && dynamicModels.length > 0) ? dynamicModels : fallbackModels;

  const allLines = [];
  const knownCharacters = {};

  for (let i = 0; i < chunks.length; i++) {
    if (onProgress) {
      onProgress({ current: i + 1, total: chunks.length });
    }

    if (i > 0) {
      // Respect Groq rate limits between successive scene chunks
      await new Promise(r => setTimeout(r, 600));
    }

    try {
      const chunkLines = await callGroqSingleChunk(apiKey, chunks[i], models, knownCharacters);
      if (Array.isArray(chunkLines) && chunkLines.length > 0) {
        for (const line of chunkLines) {
          if (line && typeof line.text === "string" && line.text.trim()) {
            allLines.push(line);
            if (line.speaker && line.speaker !== "Narrator" && line.persona) {
              knownCharacters[line.speaker] = line.persona;
            }
          }
        }
      }
    } catch (chunkErr) {
      console.warn(`Chunk ${i + 1} issue:`, chunkErr);
      if (allLines.length === 0 && i === chunks.length - 1) {
        throw chunkErr;
      }
    }
  }

  if (allLines.length === 0) {
    throw new Error("Unable to analyze story into audio units. Please check your text and try again.");
  }

  return deduplicateSpeakers(allLines);
}

// ─── VOICE ASSIGNMENT ENGINE ──────────────────────────────────────────────────
function classifyPersona(persona = "") {
  const p = persona.toLowerCase();
  const isFemale  = FEMALE_HINTS.some(h => p.includes(h));
  const isMale    = MALE_HINTS.some(h => p.includes(h));
  const isOld     = OLD_HINTS.some(h => p.includes(h));
  const isYoung   = YOUNG_HINTS.some(h => p.includes(h));
  return { isFemale, isMale, isOld, isYoung };
}

function isProblematicVoice(voice) {
  const name = (voice.name + "").toLowerCase();
  const problematic = [
    "amanda multi",
    "microsoft zira",
  ];
  return problematic.some(p => name.includes(p));
}

function scoreVoice(voice, traits) {
  if (isProblematicVoice(voice)) return -1000;
  
  const name = (voice.name + " " + voice.lang).toLowerCase();
  let score = 0;

  // ── QUALITY: strongly prefer Neural / Natural / Online voices ──
  // These are Edge's high-quality human-sounding voices
  if (name.includes("natural"))          score += 50;
  if (name.includes("neural"))           score += 40;
  if (name.includes("online (natural)")) score += 60; // Edge neural voices
  if (name.includes("online"))           score += 30;

  // ── LANGUAGE: prefer English ──
  if (voice.lang.startsWith("en")) score += 10;
  if (voice.lang === "en-US")      score += 5;
  if (voice.lang === "en-GB")      score += 3;
  if (voice.lang === "en-AU")      score += 2;

  // ── GENDER: match persona hints ──
  const femaleNameHints = ["female","woman","fiona","samantha","karen","victoria","moira","tessa","veena","zira","susan","emily","heather","hazel","ava","allison","kate","serena","nicky","aria","jenny","michelle","monica","sonia","libby","maisie","clara","natasha","isabelle"];
  const maleNameHints   = ["male","man","daniel","alex","fred","lee","rishi","tom","thomas","arthur","oliver","george","aaron","james","gordon","bruce","junior","guy","ryan","brian","andrew","eric","jacob","jason","tony","william","elliot","liam","noah"];
  const looksLikeFemale = femaleNameHints.some(h => name.includes(h));
  const looksLikeMale   = maleNameHints.some(h => name.includes(h));
  if (traits.isFemale && looksLikeFemale) score += 20;
  if (traits.isMale   && looksLikeMale)   score += 20;
  if (traits.isFemale && looksLikeMale)   score -= 10;
  if (traits.isMale   && looksLikeFemale) score -= 10;

  return score;
}

function resolveSpeechVoice(assignedVoiceData, voicePool) {
  if (!assignedVoiceData || voicePool.length === 0) return null;
  if (typeof assignedVoiceData === "string") {
    return voicePool.find(v => v.name === assignedVoiceData || v.voiceURI === assignedVoiceData || v.name.toLowerCase().includes(assignedVoiceData.toLowerCase()));
  }

  const voiceName = assignedVoiceData.name || assignedVoiceData.voiceURI;
  if (voiceName) {
    const exact = voicePool.find(v => v.name === voiceName || v.voiceURI === voiceName || v.name.toLowerCase().includes(voiceName.toLowerCase()));
    if (exact) return exact;
  }

  if (assignedVoiceData.voiceURI) {
    const exactURI = voicePool.find(v => v.voiceURI === assignedVoiceData.voiceURI);
    if (exactURI) return exactURI;
  }

  if (assignedVoiceData.lang) {
    const byLang = voicePool.find(v => v.lang === assignedVoiceData.lang);
    if (byLang) return byLang;
  }

  return null;
}

function assignVoices(characters, availableVoices) {
  // Filter out problematic voices first
  const safeVoices = availableVoices.filter(v => !isProblematicVoice(v));
  
  // Prefer high-quality English voices; fall back to all safe voices
  const qualityPool = safeVoices.filter(v => {
    const name = v.name.toLowerCase();
    return v.lang.startsWith("en") && 
           (name.includes("online") || name.includes("neural") || name.includes("natural"));
  });
  
  const englishPool = safeVoices.filter(v => v.lang.startsWith("en"));
  const pool = qualityPool.length > 0 ? qualityPool : (englishPool.length > 0 ? englishPool : safeVoices);
  
  if (pool.length === 0) return {};

  const assignments  = {};
  const usedNames    = new Set();

  // Sort: Narrator first, then characters in detection order
  const sorted = [...characters].sort((a, b) =>
    a.speaker === "Narrator" ? -1 : b.speaker === "Narrator" ? 1 : 0
  );

  for (const char of sorted) {
    const traits = classifyPersona(char.persona);

    // Score every voice; penalise already-used ones heavily
    const scored = pool
      .map(v => ({
        voice: v,
        score: scoreVoice(v, traits) - (usedNames.has(v.name) ? 1000 : 0),
      }))
      .sort((a, b) => b.score - a.score);

    // Pick the best voice that hasn't been used yet
    const pick = scored.find(s => !usedNames.has(s.voice.name)) || scored[0];
    assignments[char.speaker] = pick.voice;
    usedNames.add(pick.voice.name);
  }

  return assignments;
}

// ─── UTILITIES ────────────────────────────────────────────────────────────────
function buildColorMap(lines) {
  const map = {};
  let idx = 0;
  for (const line of lines) {
    if (!map[line.speaker]) {
      map[line.speaker] = line.speaker === "Narrator"
        ? NARRATOR_COLOR
        : CHARACTER_COLORS[idx++ % CHARACTER_COLORS.length];
    }
  }
  return map;
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    color: "#e2e8f0",
  },
  header: {
    background: "rgba(255,255,255,0.03)",
    backdropFilter: "blur(20px)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    padding: "0 28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: "60px",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  logo: {
    fontSize: "18px",
    fontWeight: 800,
    color: "#fff",
    letterSpacing: "-0.5px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  main: {
    maxWidth: "740px",
    margin: "0 auto",
    padding: "32px 20px 140px",
  },
  card: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "16px",
    padding: "24px",
    marginBottom: "20px",
    backdropFilter: "blur(10px)",
  },
  label: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#94a3b8",
    marginBottom: "10px",
    display: "block",
  },
  input: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
    fontSize: "14px",
    color: "#e2e8f0",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  },
  textarea: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.04)",
    fontSize: "14px",
    lineHeight: 1.8,
    color: "#e2e8f0",
    resize: "vertical",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  },
  btnPrimary: {
    flex: 1,
    padding: "13px",
    borderRadius: "12px",
    border: "none",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
    color: "white",
    transition: "all 0.2s",
    letterSpacing: "0.02em",
    boxShadow: "0 4px 20px rgba(99,102,241,0.4)",
  },
  btnDisabled: {
    flex: 1,
    padding: "13px",
    borderRadius: "12px",
    border: "none",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "not-allowed",
    background: "rgba(255,255,255,0.08)",
    color: "#64748b",
    transition: "all 0.2s",
    letterSpacing: "0.02em",
  },
  btnSecondary: {
    padding: "13px 20px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
    fontSize: "13px",
    color: "#94a3b8",
    cursor: "pointer",
    fontWeight: 600,
    transition: "all 0.2s",
  },
  errorBox: {
    padding: "12px 16px",
    borderRadius: "10px",
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    color: "#f87171",
    fontSize: "13px",
    marginBottom: "14px",
    lineHeight: 1.6,
  },
  storyLineActive: {
    padding: "12px 16px",
    borderRadius: "10px",
    marginBottom: "6px",
    borderLeft: "3px solid",
    transition: "all 0.25s ease",
    opacity: 1,
  },
  storyLineInactive: {
    padding: "12px 16px",
    borderRadius: "10px",
    marginBottom: "6px",
    borderLeft: "3px solid transparent",
    transition: "all 0.25s ease",
    opacity: 0.5,
  },
  controls: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    background: "rgba(15,15,26,0.92)",
    backdropFilter: "blur(20px)",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    padding: "16px 28px",
    display: "flex",
    alignItems: "center",
    gap: "16px",
    zIndex: 20,
  },
};

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function ApiKeyPanel({ apiKey, onKeyChange }) {
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

function EmptyState({ onLoadSample }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "48px 24px", textAlign: "center", gap: "14px"
    }}>
      <div style={{ fontSize: "52px", lineHeight: 1, filter: "drop-shadow(0 0 20px rgba(99,102,241,0.5))" }}>🎙</div>
      <div style={{ fontSize: "20px", fontWeight: 800, color: "#fff", letterSpacing: "-0.3px" }}>
        Paste any story to begin
      </div>
      <div style={{ fontSize: "14px", color: "#64748b", maxWidth: "380px", lineHeight: 1.7 }}>
        NarrateAI uses Gemini to identify every character, assign them a distinct voice, and read the story aloud with real emotion.
      </div>
      <button onClick={onLoadSample} style={{
        marginTop: "8px", padding: "11px 24px", borderRadius: "10px",
        border: "1px solid rgba(99,102,241,0.4)",
        background: "rgba(99,102,241,0.1)",
        fontSize: "13px", color: "#818cf8", cursor: "pointer", fontWeight: 600,
        transition: "all 0.2s",
      }}>
        ✨ Try a sample story
      </button>
    </div>
  );
}

// ─── VOICE QUALITY BANNER ────────────────────────────────────────────────
function VoiceQualityBanner({ availableVoices }) {
  const hasNatural = availableVoices.some(v =>
    v.name.toLowerCase().includes("natural") ||
    v.name.toLowerCase().includes("neural") ||
    v.name.toLowerCase().includes("online")
  );

  if (hasNatural) return null; // Already using good voices, no need to show banner

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: "12px",
      padding: "14px 16px", borderRadius: "12px", marginBottom: "20px",
      background: "rgba(245,158,11,0.08)",
      border: "1px solid rgba(245,158,11,0.3)",
    }}>
      <span style={{ fontSize: "20px", flexShrink: 0 }}>💡</span>
      <div>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "#fbbf24", marginBottom: "4px" }}>
          Upgrade to human-sounding voices — free!
        </div>
        <div style={{ fontSize: "12px", color: "#92400e", lineHeight: 1.6, color: "#d97706" }}>
          Open this app in <strong>Microsoft Edge</strong> to unlock Neural voices like
          <em> Microsoft Aria, Guy, Jenny</em> — they sound genuinely human.
          Edge is free and already on your Windows PC.
        </div>
        <a
          href="microsoft-edge:https://narrate-ai-gamma.vercel.app/"
          style={{
            display: "inline-block", marginTop: "8px",
            padding: "6px 14px", borderRadius: "8px",
            background: "rgba(245,158,11,0.2)",
            border: "1px solid rgba(245,158,11,0.4)",
            color: "#fbbf24", fontSize: "12px", fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Open in Edge →
        </a>
      </div>
    </div>
  );
}

// ─── CHARACTER PANEL (read-only, auto-assigned voices) ───────────────────────────
function CharacterPanel({ characters, colorMap, voiceAssignments }) {
  const [expandedChar, setExpandedChar] = useState(null);

  if (!characters.length) return null;

  return (
    <div style={{ marginBottom: "20px" }}>
      <span style={S.label}>🎭 Voices Panel</span>
      
      {/* Expanded Character Detail Card */}
      {expandedChar && (
        <div style={{
          marginBottom: "20px",
          padding: "20px",
          borderRadius: "14px",
          background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.12))",
          border: "1px solid rgba(99,102,241,0.4)",
          boxShadow: "0 8px 32px rgba(99,102,241,0.2), inset 0 1px 3px rgba(99,102,241,0.1)",
          animation: "slideDown 0.3s ease-out",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Character Name Header */}
              <div style={{
                display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px"
              }}>
                <div style={{
                  width: "12px", height: "12px", borderRadius: "50%",
                  background: colorMap[expandedChar.speaker]?.dot || "#6366f1",
                  boxShadow: `0 0 12px ${colorMap[expandedChar.speaker]?.dot || "#6366f1"}`,
                  flexShrink: 0,
                }}/> 
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#f1f5f9" }}>
                  {expandedChar.speaker}
                </h3>
              </div>
              
              {/* Character Description from Story - full persona text without truncation */}
              <p style={{
                fontSize: "14px", lineHeight: 1.9, color: "#cbd5e1", margin: 0,
                marginBottom: "16px",
                whiteSpace: "pre-wrap",
                wordWrap: "break-word",
                wordBreak: "break-word",
              }}>
                {expandedChar.persona || "A mysterious character in this story."}
              </p>

              {/* Voice Assignment - only shown when expanded */}
              <div style={{
                fontSize: "12px", color: "#94a3b8", marginTop: "14px",
                padding: "12px 14px", background: "rgba(99,102,241,0.08)", borderRadius: "10px",
                borderLeft: `3px solid ${colorMap[expandedChar.speaker]?.dot || "#6366f1"}`,
              }}>
                <div style={{ fontWeight: 700, color: "#cbd5e1", marginBottom: "4px" }}>🎙 Voice Assignment</div>
                <div>{voiceAssignments[expandedChar.speaker]?.name || "Default System Voice"}</div>
              </div>
            </div>
            
            {/* Close Button */}
            <button
              onClick={() => setExpandedChar(null)}
              style={{
                background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "10px", padding: "8px 12px", color: "#94a3b8", cursor: "pointer",
                fontSize: "14px", fontWeight: 700, transition: "all 0.2s",
                marginTop: "0px",
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                e.target.style.background = "rgba(255,255,255,0.15)";
                e.target.style.color = "#cbd5e1";
              }}
              onMouseLeave={e => {
                e.target.style.background = "rgba(255,255,255,0.1)";
                e.target.style.color = "#94a3b8";
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Character Cards Grid - Simple, Clean */}
      <div style={{
        display: "flex",
        gap: "12px",
        overflowX: "auto",
        paddingBottom: "10px",
        paddingRight: "16px",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255,255,255,0.15) transparent",
      }}>
        {characters.map(char => {
          const color = colorMap[char.speaker] || NARRATOR_COLOR;
          const isExpanded = expandedChar?.speaker === char.speaker;
          
          return (
            <button
              key={char.speaker}
              onClick={() => setExpandedChar(isExpanded ? null : char)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 16px",
                borderRadius: "12px",
                background: isExpanded ? `${color.bg}99` : color.bg,
                border: isExpanded ? `2px solid ${color.border}` : "1px solid transparent",
                minWidth: "fit-content",
                flexShrink: 0,
                boxShadow: isExpanded 
                  ? `0 0 24px ${color.dot}50, inset 0 0 16px ${color.dot}15`
                  : `0 4px 12px rgba(0, 0, 0, 0.2)`,
                transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
              onMouseEnter={e => {
                if (!isExpanded) {
                  e.currentTarget.style.boxShadow = `0 0 28px ${color.dot}70, 0 10px 28px rgba(0,0,0,0.4)`;
                  e.currentTarget.style.transform = "translateY(-5px) scale(1.05)";
                  e.currentTarget.style.background = `${color.bg}cc`;
                }
              }}
              onMouseLeave={e => {
                if (!isExpanded) {
                  e.currentTarget.style.boxShadow = `0 4px 12px rgba(0, 0, 0, 0.2)`;
                  e.currentTarget.style.transform = "translateY(0) scale(1)";
                  e.currentTarget.style.background = color.bg;
                }
              }}
            >
              {/* Character Dot - animated on state changes */}
              <div style={{
                width: isExpanded ? "12px" : "8px",
                height: isExpanded ? "12px" : "8px",
                borderRadius: "50%",
                background: color.dot,
                boxShadow: `0 0 ${isExpanded ? "16px" : "6px"} ${color.dot}`,
                flexShrink: 0,
                transition: "all 0.3s",
              }} />
              
              {/* Character Name - only content shown */}
              <div style={{
                fontSize: isExpanded ? "14px" : "13px",
                fontWeight: 700,
                color: color.text,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                transition: "all 0.3s",
              }}>
                {char.speaker}
              </div>
            </button>
          );
        })}
      </div>

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

function HistoryPanel({ history, onLoadItem, onClear }) {
  if (!history || history.length === 0) return null;
  return (
    <div style={{ ...S.card, padding: "18px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
        <span style={{ ...S.label, marginBottom: 0 }}>🕘 Recent Stories</span>
        <button onClick={onClear} style={{ ...S.btnSecondary, padding: "8px 12px", fontSize: "11px" }}>
          Clear history
        </button>
      </div>
      <div style={{ display: "grid", gap: "10px" }}>
        {history.map(item => (
          <button
            key={item.id}
            onClick={() => onLoadItem(item)}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "14px 16px",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              color: "#e2e8f0",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <span style={{ fontWeight: 700, fontSize: "13px", color: "#f8fafc" }}>{item.title}</span>
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>
              {item.parsedLines?.length ?? 0} lines · {item.characters?.length ?? 0} voices
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
function StoryLine({ line, isActive, colorMap, onClick }) {
  const ref = useRef(null);
  const color = colorMap[line.speaker] || NARRATOR_COLOR;
  const isNarrator = line.speaker === "Narrator";
  const isThought = !!line.isThought;

  useEffect(() => {
    if (isActive && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isActive]);

  return (
    <div ref={ref} onClick={onClick} style={{
      ...(isActive ? S.storyLineActive : S.storyLineInactive),
      borderLeftColor: isActive ? color.dot : "transparent",
      background: isActive ? color.bg : "transparent",
      cursor: "pointer",
    }}>
      {!isNarrator && (
        <div style={{
          fontSize: "11px", fontWeight: 700, color: color.text,
          letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px",
          display: "flex", alignItems: "center", gap: "8px",
        }}>
          <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: color.dot, boxShadow: `0 0 6px ${color.dot}` }} />
          {line.speaker} {isThought && <span style={{ textTransform: "none", fontStyle: "italic", opacity: 0.8 }}>(Thought)</span>}
          <span style={{ fontWeight: 400, opacity: 0.6, textTransform: "none", letterSpacing: 0, fontSize: "10px" }}>
            {line.emotion}
          </span>
        </div>
      )}
      <div style={{
        fontSize: isNarrator ? "14px" : "15px",
        color: isActive ? "#f1f5f9" : "#94a3b8",
        lineHeight: 1.75,
        fontStyle: (isNarrator || isThought) ? "italic" : "normal",
        transition: "color 0.25s",
        borderLeft: isThought ? "2px dashed rgba(255, 255, 255, 0.15)" : "none",
        paddingLeft: isThought ? "8px" : "0",
      }}>
        {line.text}
      </div>
    </div>
  );
}
function PlaybackControls({ isPlaying, currentIndex, total, onPlay, onPause, onStop, onPrev, onNext, speed, onSpeedChange, disabled }) {
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

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function NarrateAI() {
  const [apiKey, setApiKey]                   = useState("");
  const [storyText, setStoryText]             = useState("");
  const [parsedLines, setParsedLines]         = useState([]);
  const [characters, setCharacters]           = useState([]);
  const [colorMap, setColorMap]               = useState({});
  const [voiceAssignments, setVoiceAssignments] = useState({});
  const [availableVoices, setAvailableVoices]   = useState([]);
  const [isLoading, setIsLoading]             = useState(false);
  const [isPlaying, setIsPlaying]             = useState(false);
  const [currentIndex, setCurrentIndex]       = useState(0);
  const [error, setError]                     = useState("");
  const [speed, setSpeed]                     = useState(1.0);
  const [view, setView]                       = useState("input");
  const [speechSupported]                     = useState(() => typeof window !== "undefined" && "speechSynthesis" in window && !!window.speechSynthesis);
  const [showFinished, setShowFinished]       = useState(false);
  const [loadingStep, setLoadingStep]         = useState("");
  const [chunkProgress, setChunkProgress]     = useState(null);
  
  const [history, setHistory]                 = useState([]);
  const [showWritingPanel, setShowWritingPanel] = useState(true);
  const [showPlaybackPanel, setShowPlaybackPanel] = useState(true);
  
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedApiKey = localStorage.getItem("narrateai_groq_key") || "";
      const savedStory = localStorage.getItem("narrateai_story_text") || "";
      const savedParsedLines = JSON.parse(localStorage.getItem("narrateai_parsed_lines") || "[]");
      const savedCharacters = JSON.parse(localStorage.getItem("narrateai_characters") || "[]");
      const savedColorMap = JSON.parse(localStorage.getItem("narrateai_color_map") || "{}");
      const savedVoiceAssignments = JSON.parse(localStorage.getItem("narrateai_voice_assignments") || "{}");
      const savedView = localStorage.getItem("narrateai_view") || "";
      const savedHistory = JSON.parse(localStorage.getItem("narrateai_history") || "[]");

      const parsedLines = Array.isArray(savedParsedLines) ? savedParsedLines : [];
      const characters = Array.isArray(savedCharacters) && savedCharacters.length > 0
        ? savedCharacters
        : Object.entries((parsedLines || []).reduce((acc, line) => {
            if (line && line.speaker && !acc[line.speaker]) {
              acc[line.speaker] = line.persona || "";
            }
            return acc;
          }, {})).map(([speaker, persona]) => ({ speaker, persona }));

      setApiKey(savedApiKey);
      setStoryText(savedStory);
      setParsedLines(parsedLines);
      setCharacters(characters);
      setColorMap(typeof savedColorMap === "object" && savedColorMap ? savedColorMap : {});
      setVoiceAssignments(typeof savedVoiceAssignments === "object" && savedVoiceAssignments ? savedVoiceAssignments : {});
      setHistory(Array.isArray(savedHistory) ? savedHistory : []);
      setView(savedView || (parsedLines.length > 0 ? "story" : "input"));
    } catch (err) {
      console.warn("Failed to restore NarrateAI state from localStorage", err);
    }
  }, []);

  const synthRef   = useRef(typeof window !== "undefined" ? window.speechSynthesis : null);
  const watchdogIntervalRef = useRef(null);
  const indexRef   = useRef(0);
  const playingRef = useRef(false);
  const speedRef   = useRef(1.0);
  const linesRef   = useRef([]);
  const voiceRef   = useRef({});
  const generationRef = useRef(0);

  // Persist API key to localStorage
  useEffect(() => {
    if (apiKey) localStorage.setItem("narrateai_groq_key", apiKey);
  }, [apiKey]);

  // Persist view to localStorage
  useEffect(() => {
    localStorage.setItem("narrateai_view", view);
  }, [view]);

  // ── HISTORY HELPERS ──
  function saveStoryToHistory(text, parsed, chars, colors, voiceAssigns) {
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
    };

    setHistory(prevHistory => {
      const updated = [newItem, ...prevHistory.filter(h => h.storyText.trim() !== text.trim())].slice(0, 5);
      localStorage.setItem("narrateai_history", JSON.stringify(updated));
      return updated;
    });
  }

  function clearHistory() {
    setHistory([]);
    localStorage.removeItem("narrateai_history");
  }

  function loadHistoryItem(item) {
    stopPlayback();
    setStoryText(item.storyText);
    setParsedLines(item.parsedLines);
    setCharacters(item.characters);
    setColorMap(item.colorMap);
    setVoiceAssignments(item.voiceAssignments);
    setCurrentIndex(0);
    indexRef.current = 0;
    setView("story");
    
    localStorage.setItem("narrateai_story_text", item.storyText);
    localStorage.setItem("narrateai_parsed_lines", JSON.stringify(item.parsedLines));
    localStorage.setItem("narrateai_characters", JSON.stringify(item.characters));
    localStorage.setItem("narrateai_color_map", JSON.stringify(item.colorMap));
    localStorage.setItem("narrateai_voice_assignments", JSON.stringify(item.voiceAssignments));
  }

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { voiceRef.current = voiceAssignments; }, [voiceAssignments]);
  useEffect(() => { linesRef.current = parsedLines; }, [parsedLines]);

  useEffect(() => {
    return () => {
      if (synthRef.current) synthRef.current.cancel();
      if (watchdogIntervalRef.current) clearInterval(watchdogIntervalRef.current);
    };
  }, []);

  // Keyboard controls
  useEffect(() => {
    function handleKeyDown(e) {
      if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA") {
        return;
      }
      
      if (e.code === "Space") {
        e.preventDefault();
        if (playingRef.current) {
          pausePlayback();
        } else {
          handlePlay();
        }
      } else if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        stopPlayback();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        skipForward();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        skipBackward();
      }
    }
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, parsedLines]);

  // Load browser voices
  useEffect(() => {
    if (!speechSupported) return;
    function loadVoices() {
      if (!synthRef.current) return;
      const voices = synthRef.current.getVoices();
      if (voices.length > 0) setAvailableVoices(voices);
    }
    loadVoices();
    if (synthRef.current) {
      synthRef.current.onvoiceschanged = loadVoices;
    }
    return () => {
      if (synthRef.current) synthRef.current.onvoiceschanged = null;
    };
  }, [speechSupported]);

  useEffect(() => {
    if (availableVoices.length === 0 || Object.keys(voiceAssignments).length === 0) return;
    const safePool = availableVoices.filter(v => !isProblematicVoice(v));
    const pool = safePool.length > 0 ? safePool : availableVoices;
    const resolved = {};
    let changed = false;

    for (const [speaker, voiceData] of Object.entries(voiceAssignments)) {
      const actualVoice = resolveSpeechVoice(voiceData, pool);
      if (actualVoice && !isProblematicVoice(actualVoice)) {
        resolved[speaker] = actualVoice;
        if (actualVoice !== voiceData) {
          changed = true;
        }
      } else if (pool.length > 0) {
        resolved[speaker] = pool[0];
        changed = true;
      }
    }

    if (changed) {
      setVoiceAssignments(resolved);
    }
  }, [availableVoices, voiceAssignments]);

  // ── ANALYSE WITH GROQ ──
  async function analyzeStory() {
    if (!storyText.trim() || isLoading) return;
    if (!apiKey.trim()) {
      setError("Please enter your Groq API key above to get started.");
      return;
    }

    // ── MINIMUM LENGTH CHECK ──
    const wordCount = storyText.trim().split(/\s+/).filter(Boolean).length;
    const sentenceCount = storyText.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    if (wordCount < 10 || sentenceCount < 3) {
      setError("Please enter a longer story (at least 3 sentences or 10 words) for best results.");
      return;
    }

    setIsLoading(true);
    setLoadingStep("groq");
    setChunkProgress(null);
    setError("");
    setParsedLines([]);
    setCharacters([]);
    setVoiceAssignments({});
    stopPlayback();

    try {
      const parsed = await callGroq(apiKey.trim(), storyText, (progress) => {
        setChunkProgress(progress);
      });

      setLoadingStep("parse");
      setChunkProgress(null);

      // ── FILTER OUT EMPTY LINES ──
      const filteredParsed = parsed.filter(line => line && typeof line.text === "string" && line.text.trim() !== "");

      // ── FUZZY SPEAKER DEDUPLICATION ──
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

      const voices = synthRef.current ? synthRef.current.getVoices() : [];
      const pool = voices.length > 0 ? voices : availableVoices;
      const assignments = assignVoices(chars, pool);
      const cMap = buildColorMap(dedupedParsed);

      setParsedLines(dedupedParsed);
      setCharacters(chars);
      setColorMap(cMap);
      setVoiceAssignments(assignments);
      setCurrentIndex(0);
      indexRef.current = 0;
      setView("story");

      // Save to localStorage
      localStorage.setItem("narrateai_story_text", storyText);
      localStorage.setItem("narrateai_parsed_lines", JSON.stringify(dedupedParsed));
      localStorage.setItem("narrateai_characters", JSON.stringify(chars));
      localStorage.setItem("narrateai_color_map", JSON.stringify(cMap));

      const serialized = {};
      for (const [speaker, voiceObj] of Object.entries(assignments)) {
        serialized[speaker] = { name: voiceObj?.name, lang: voiceObj?.lang };
      }
      localStorage.setItem("narrateai_voice_assignments", JSON.stringify(serialized));

      // Save to history tray
      saveStoryToHistory(storyText, dedupedParsed, chars, cMap, serialized);

    } catch (err) {
      console.error(err);
      if (err.message?.includes("Invalid API Key") || err.message?.includes("401") || err.message?.includes("invalid_api_key")) {
        setError("Invalid API key. Please double-check your Groq API key at console.groq.com/keys");
      } else {
        setError(`Analysis failed: ${err.message || "Please check your story and try again."}`);
      }
    } finally {
      setIsLoading(false);
      setLoadingStep("");
    }
  }

  // ── PLAYBACK ENGINE ──
  const playLine = useCallback((index) => {
    const lines = linesRef.current;
    const voices = voiceRef.current;
    const generation = generationRef.current;

    // Clear any active watchdog timer before starting
    if (watchdogIntervalRef.current) {
      clearInterval(watchdogIntervalRef.current);
      watchdogIntervalRef.current = null;
    }

    if (!synthRef.current || !playingRef.current) {
      return;
    }

    if (generation !== generationRef.current) {
      return;
    }

    if (index >= lines.length) {
      playingRef.current = false;
      setIsPlaying(false);
      setShowFinished(true);
      return;
    }

    const line = lines[index];
    indexRef.current = index;
    setCurrentIndex(index);
    const emotionParams = EMOTION_PARAMS[line.emotion] || EMOTION_PARAMS.neutral;
    const vp = line.voiceProfile || { pitch: 1.0, rate: 1.0 };
    const utt = new SpeechSynthesisUtterance(line.text);
    const assignedVoiceData = voices[line.speaker];
    if (assignedVoiceData) {
      const pool = synthRef.current ? synthRef.current.getVoices() : [];
      const safePool = pool.filter(v => !isProblematicVoice(v));
      const actualVoiceObj = resolveSpeechVoice(assignedVoiceData, safePool.length > 0 ? safePool : pool);
      if (actualVoiceObj && !isProblematicVoice(actualVoiceObj)) {
        utt.voice = actualVoiceObj;
      } else if (safePool.length > 0) {
        utt.voice = safePool[0];
      }
    }
    utt.pitch  = Math.min(2.0, Math.max(0.1, vp.pitch * emotionParams.pitch));
    utt.rate   = Math.min(3.0, Math.max(0.1, vp.rate * emotionParams.rate * speedRef.current));
    utt.volume = emotionParams.volume;

    const cleanupWatchdog = () => {
      if (watchdogIntervalRef.current) {
        clearInterval(watchdogIntervalRef.current);
        watchdogIntervalRef.current = null;
      }
    };

    utt.onend = () => {
      cleanupWatchdog();
      if (playingRef.current && generation === generationRef.current) playLine(index + 1);
    };

    utt.onerror = () => {
      cleanupWatchdog();
      if (playingRef.current && generation === generationRef.current) playLine(index + 1);
    };

    synthRef.current.speak(utt);
  }, []);

  function startPlayback(fromIndex = 0) {
    if (!synthRef.current) return;
    generationRef.current += 1;
    setShowFinished(false);
    synthRef.current.cancel();
    playingRef.current = true;
    setIsPlaying(true);
    playLine(fromIndex);
  }

  function stopPlayback() {
    generationRef.current += 1;
    playingRef.current = false;
    if (watchdogIntervalRef.current) {
      clearInterval(watchdogIntervalRef.current);
      watchdogIntervalRef.current = null;
    }
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setIsPlaying(false);
    setCurrentIndex(0);
    indexRef.current = 0;
    setShowFinished(false);
  }

  function pausePlayback() {
    playingRef.current = false;
    if (watchdogIntervalRef.current) {
      clearInterval(watchdogIntervalRef.current);
      watchdogIntervalRef.current = null;
    }
    if (synthRef.current) {
      synthRef.current.pause();
    }
    setIsPlaying(false);
  }

  function handlePlay() {
    if (synthRef.current && synthRef.current.paused) {
      playingRef.current = true;
      setIsPlaying(true);
      synthRef.current.resume();
    } else {
      startPlayback(currentIndex);
    }
  }

  function skipForward() {
    if (currentIndex < parsedLines.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      indexRef.current = nextIdx;
      if (isPlaying) {
        startPlayback(nextIdx);
      }
    }
  }

  // Go to previous line
  function skipBackward() {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      indexRef.current = prevIdx;
      if (isPlaying) {
        startPlayback(prevIdx);
      }
    }
  }
  function handleSpeedChange(val) {
    setSpeed(val);
    speedRef.current = val;
    if (isPlaying) {
      const idx = indexRef.current;
      pausePlayback();
      setTimeout(() => startPlayback(idx), 50);
    }
  }

  const hasStory = parsedLines.length > 0;
  const canAnalyze = !!apiKey.trim() && !!storyText.trim() && !isLoading;

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      {/* HEADER */}
      <div style={S.header}>
        <div style={S.logo}>
          <span style={{ fontSize: "22px", filter: "drop-shadow(0 0 8px rgba(99,102,241,0.8))" }}>🎙</span>
          <span>
            Narrate<span style={{ color: "#818cf8" }}>AI</span>
          </span>
          <span style={{
            marginLeft: "4px", fontSize: "10px", fontWeight: 600,
            background: "linear-gradient(135deg, #f97316, #ef4444)",
            color: "white", padding: "2px 8px", borderRadius: "20px",
            letterSpacing: "0.05em",
          }}>GROQ · GPT-OSS 120B</span>
        </div>

        {hasStory && (
          <div style={{ display: "flex", gap: "8px", background: "rgba(255,255,255,0.05)", borderRadius: "10px", padding: "5px", border: "1px solid rgba(255,255,255,0.07)" }}>
            <button 
              onClick={() => setShowWritingPanel(!showWritingPanel)}
              title="Toggle Story Writer"
              style={{
                padding: "6px 16px", borderRadius: "8px", border: "none",
                fontSize: "12px", fontWeight: 700, cursor: "pointer",
                background: showWritingPanel ? "rgba(99,102,241,0.8)" : "transparent",
                color: showWritingPanel ? "#fff" : "#64748b",
                transition: "all 0.2s",
                display: "flex", alignItems: "center", gap: "6px",
              }}>
              ✏️ {showWritingPanel ? "Hide" : "Show"} Writer
            </button>
            <button 
              onClick={() => setShowPlaybackPanel(!showPlaybackPanel)}
              title="Toggle Playback"
              style={{
                padding: "6px 16px", borderRadius: "8px", border: "none",
                fontSize: "12px", fontWeight: 700, cursor: "pointer",
                background: showPlaybackPanel ? "rgba(99,102,241,0.8)" : "transparent",
                color: showPlaybackPanel ? "#fff" : "#64748b",
                transition: "all 0.2s",
                display: "flex", alignItems: "center", gap: "6px",
              }}>
              ▶️ {showPlaybackPanel ? "Hide" : "Show"} Playback
            </button>
          </div>
        )}

        <div style={{ fontSize: "12px", color: "#475569", fontWeight: 500 }}>
          {hasStory ? `${parsedLines.length} lines · ${characters.length} chars` : ""}
        </div>
      </div>

      {/* MAIN */}
      <div style={{
        ...S.main,
        maxWidth: "100%",
        transition: "all 0.3s ease",
      }}>
        {!speechSupported && (
          <div style={S.errorBox}>
            ⚠️ <strong>Text-to-Speech Not Supported:</strong> Your browser does not support the Web Speech API or it is currently disabled. Please open this app in Google Chrome or Microsoft Edge to enable voice playback.
          </div>
        )}

        <div style={{
          display: "grid",
          gridTemplateColumns: showWritingPanel && showPlaybackPanel 
            ? "1fr 1fr" 
            : (showPlaybackPanel ? "1fr" : (showWritingPanel ? "1fr" : "1fr")),
          gap: "32px",
          alignItems: "start",
        }}>
          
          {/* LEFT PANEL: INPUT VIEW */}
          {showWritingPanel && (
            <div className="left-panel" style={{
              minHeight: "0",
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: "10px",
                marginBottom: "18px", paddingBottom: "12px",
                borderBottom: "1px solid rgba(255,255,255,0.05)"
              }}>
                <span style={{ fontSize: "16px" }}>✏️</span>
                <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#f1f5f9" }}>Story Writer</h2>
              </div>

              <ApiKeyPanel apiKey={apiKey} onKeyChange={setApiKey} />

              <div style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <label style={{ ...S.label, marginBottom: 0 }}>Your Story</label>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    {storyText ? `${storyText.trim().split(/\s+/).filter(Boolean).length} words · est. ${Math.ceil(storyText.trim().split(/\s+/).filter(Boolean).length / 150)} min narration` : "0 words"}
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

              {error && <div style={S.errorBox}>⚠ {error}</div>}

              <div style={{ display: "flex", gap: "10px" }}>
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

                {!storyText && (
                  <button onClick={() => setStoryText(SAMPLE_STORY)} style={S.btnSecondary}>
                    Sample
                  </button>
                )}
              </div>

              {!storyText && !hasStory && <EmptyState onLoadSample={() => setStoryText(SAMPLE_STORY)} />}

              <HistoryPanel history={history} onLoadItem={loadHistoryItem} onClear={clearHistory} />
            </div>
          )}

          {/* RIGHT PANEL: PLAYBACK VIEW */}
          {showPlaybackPanel && (
            <div className="right-panel" style={{
              minHeight: "0",
            }}>
              {hasStory ? (
                <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "16px" }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    paddingBottom: "12px",
                    borderBottom: "1px solid rgba(255,255,255,0.05)"
                  }}>
                    <span style={{ fontSize: "16px" }}>🎙️</span>
                    <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#f1f5f9", flex: 1 }}>Playback Studio</h2>
                    <span style={{ fontSize: "11px", color: "#64748b", background: "rgba(99,102,241,0.1)", padding: "4px 10px", borderRadius: "6px", fontWeight: 600 }}>
                      {parsedLines.length} lines
                    </span>
                  </div>

                  <VoiceQualityBanner availableVoices={availableVoices} />
                  
                  {/* Celebration finished card */}
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
                      <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
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
                      </div>
                    </div>
                  )}

                  <CharacterPanel
                    characters={characters}
                    colorMap={colorMap}
                    voiceAssignments={voiceAssignments}
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
                      <StoryLine key={i} line={line} isActive={i === currentIndex} colorMap={colorMap} onClick={() => startPlayback(i)} />
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

      {/* PLAYBACK CONTROLS */}
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

      {/* Styles & Animation keyframes */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounce { from { transform: translateY(0); } to { transform: translateY(-4px); } }
        textarea:focus, input:focus { border-color: rgba(99,102,241,0.6) !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
        button:not(:disabled):hover { filter: brightness(1.1); transform: translateY(-1px); }
        select option { background: #1a1a2e; color: #e2e8f0; }
        
        @media (min-width: 860px) {
          .left-panel { display: block !important; }
          .right-panel { display: block !important; }
        }
      `}</style>
    </div>
  );
}
