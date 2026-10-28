import {
  EMOTION_PARAMS,
  CHARACTER_COLORS,
  NARRATOR_COLOR,
  FEMALE_HINTS,
  MALE_HINTS,
  OLD_HINTS,
  YOUNG_HINTS,
  SYSTEM_PROMPT,
  NARRATION_WORDS_PER_MINUTE,
} from "../constants/storyConstants";

// ─── HELPER FOR ROBUST JSON EXTRACTION ────────────────────────────────────────
export function cleanAndParseJSON(rawText) {
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

  // 6. Auto-repair trailing commas before closing braces/brackets
  cleaned = cleaned.replace(/,\s*([\]}])/g, "$1");

  // 7. Find balanced closure
  const openChar = rootType === "array" ? "[" : "{";
  const closeChar = rootType === "array" ? "]" : "}";
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  let endIdx = -1;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === "\\") {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === openChar) depth++;
      else if (char === closeChar) {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
  }

  if (endIdx !== -1) {
    cleaned = cleaned.substring(0, endIdx + 1);
  } else if (depth > 0) {
    // Auto-close open structures if truncated
    cleaned = cleaned.replace(/,\s*$/, "");
    if (inString) cleaned += '"';
    while (depth > 0) {
      cleaned += closeChar;
      depth--;
    }
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      for (const k of ["lines", "dialogue", "story", "output", "data"]) {
        if (Array.isArray(parsed[k])) return parsed[k];
      }
      return [parsed];
    }
  } catch {
    // Proceed to regex fallback
  }

  // 8. Regex-based object extractor fallback
  const objectRegex = /\{[\s\S]*?"speaker"[\s\S]*?"text"[\s\S]*?\}/g;
  const matches = cleaned.match(objectRegex);
  if (matches && matches.length > 0) {
    const salvaged = [];
    for (const m of matches) {
      try {
        const fixed = m.replace(/,\s*([\]}])/g, "$1");
        salvaged.push(JSON.parse(fixed));
      } catch {
        // Skip unparseable snippet
      }
    }
    if (salvaged.length > 0) return salvaged;
  }

  throw new Error("Unable to parse AI story analysis. The AI returned an unparseable response.");
}

export function formatNarrationDuration(wordCount) {
  if (!wordCount) return "0 sec";

  const totalSeconds = Math.ceil((wordCount / NARRATION_WORDS_PER_MINUTE) * 60);
  if (totalSeconds < 60) return `${totalSeconds} sec`;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    if (minutes > 0) return `${hours} hr ${minutes} min`;
    return `${hours} hr`;
  }

  if (seconds > 0) return `${minutes} min ${seconds} sec`;
  return `${minutes} min`;
}

// ─── CHROME TTS LONG LINE CHUNKER (~150 chars boundary) ──────────────────────
export function splitLineIntoChunks(text, maxChars = 150) {
  if (!text || typeof text !== "string") return [];
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return [trimmed];

  const clauses = trimmed.match(/[^.!?;\n,]+[.!?;\n,]+(?:\s+|$)|[^.!?;\n,]+$/g) || [trimmed];
  const chunks = [];
  let current = "";

  for (const clause of clauses) {
    const clauseTrimmed = clause.trim();
    if (!clauseTrimmed) continue;

    if (!current) {
      if (clauseTrimmed.length <= maxChars) {
        current = clauseTrimmed;
      } else {
        const words = clauseTrimmed.split(/\s+/);
        let sub = "";
        for (const word of words) {
          if ((sub + " " + word).trim().length <= maxChars) {
            sub = (sub ? sub + " " + word : word).trim();
          } else {
            if (sub) chunks.push(sub);
            sub = word;
          }
        }
        if (sub) current = sub;
      }
    } else if ((current + " " + clauseTrimmed).length <= maxChars) {
      current = current + " " + clauseTrimmed;
    } else {
      chunks.push(current);
      if (clauseTrimmed.length <= maxChars) {
        current = clauseTrimmed;
      } else {
        const words = clauseTrimmed.split(/\s+/);
        let sub = "";
        for (const word of words) {
          if ((sub + " " + word).trim().length <= maxChars) {
            sub = (sub ? sub + " " + word : word).trim();
          } else {
            if (sub) chunks.push(sub);
            sub = word;
          }
        }
        current = sub;
      }
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.length > 0 ? chunks : [trimmed];
}

// ─── FUZZY SPEAKER DEDUPLICATION ──────────────────────────────────────────────
export function deduplicateSpeakers(parsedLines) {
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
      
      const hasOverlap = words1.some(w => words2.includes(w) && w.length > 2);
      
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

// ─── VOICE MATCHING & PERSONA CLASSIFICATION ─────────────────────────────────
export function classifyPersona(persona = "") {
  const p = persona.toLowerCase();
  const isFemale = FEMALE_HINTS.some(h => p.includes(h));
  const isMale   = MALE_HINTS.some(h => p.includes(h));
  const isOld    = OLD_HINTS.some(h => p.includes(h));
  const isYoung  = YOUNG_HINTS.some(h => p.includes(h));
  return { isFemale, isMale, isOld, isYoung };
}

export function isProblematicVoice(voice) {
  const name = (voice.name + "").toLowerCase();
  const problematic = [
    "amanda multi",
    "microsoft zira",
  ];
  return problematic.some(p => name.includes(p));
}

export function scoreVoice(voice, traits) {
  if (isProblematicVoice(voice)) return -1000;
  
  const name = (voice.name + " " + voice.lang).toLowerCase();
  let score = 0;

  if (name.includes("natural"))          score += 50;
  if (name.includes("neural"))           score += 40;
  if (name.includes("online (natural)")) score += 60;
  if (name.includes("online"))           score += 30;

  if (voice.lang.startsWith("en")) score += 10;
  if (voice.lang === "en-US")      score += 5;
  if (voice.lang === "en-GB")      score += 3;
  if (voice.lang === "en-AU")      score += 2;

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

export function resolveSpeechVoice(assignedVoiceData, voicePool) {
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

export function assignVoices(characters, availableVoices) {
  const safeVoices = availableVoices.filter(v => !isProblematicVoice(v));
  
  const qualityPool = safeVoices.filter(v => {
    const name = v.name.toLowerCase();
    return v.lang.startsWith("en") && 
           (name.includes("online") || name.includes("neural") || name.includes("natural"));
  });
  
  const englishPool = safeVoices.filter(v => v.lang.startsWith("en"));
  const pool = qualityPool.length > 0 ? qualityPool : (englishPool.length > 0 ? englishPool : safeVoices);
  
  if (pool.length === 0) return {};

  const assignments = {};
  const usedNames   = new Set();

  const sorted = [...characters].sort((a, b) =>
    a.speaker === "Narrator" ? -1 : b.speaker === "Narrator" ? 1 : 0
  );

  for (const char of sorted) {
    const traits = classifyPersona(char.persona);

    const scored = pool
      .map(v => ({
        voice: v,
        score: scoreVoice(v, traits) - (usedNames.has(v.name) ? 1000 : 0),
      }))
      .sort((a, b) => b.score - a.score);

    const pick = scored.find(s => !usedNames.has(s.voice.name)) || scored[0];
    assignments[char.speaker] = pick.voice;
    usedNames.add(pick.voice.name);
  }

  return assignments;
}

export function buildColorMap(lines) {
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

// ─── GROQ API CALLERS ────────────────────────────────────────────────────────
export async function callGroqWithModel(apiKey, storyText, model, retryPromptSuffix = "", maxTokens = 4096) {
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
  const timeoutId = setTimeout(() => controller.abort(), 35000);

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
      throw new Error(`Timeout after 35 seconds for model ${model}.`, { cause: err });
    }
    throw err;
  }
}

export async function fetchActiveGroqModels(apiKey) {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.data || !Array.isArray(data.data)) return null;

    const excluded = ["whisper", "guard", "embed", "moderation", "tts", "stt", "vision", "compound-mini", "llama3-70b", "llama3-8b"];
    const textModels = data.data
      .map(m => m.id)
      .filter(id => id && !excluded.some(ex => id.toLowerCase().includes(ex)));

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

export function splitStoryIntoChunks(storyText, targetWords = 320) {
  const paragraphs = storyText.split(/\n\s*\n/).filter(p => p.trim());
  const chunks = [];
  let currentChunk = "";
  let currentCount = 0;

  for (const para of paragraphs) {
    const wordCount = para.trim().split(/\s+/).filter(Boolean).length;
    if (currentCount > 0 && (currentCount + wordCount > targetWords + 80)) {
      chunks.push(currentChunk.trim());
      currentChunk = para;
      currentCount = wordCount;
    } else {
      currentChunk = currentChunk ? currentChunk + "\n\n" + para : para;
      currentCount += wordCount;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [storyText];
}

export async function callGroqSingleChunk(apiKey, chunkText, models, knownCharacters = {}) {
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

export async function callGroq(apiKey, storyText, onProgress) {
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
export { EMOTION_PARAMS };
