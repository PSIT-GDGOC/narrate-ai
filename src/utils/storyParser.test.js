import { describe, it, expect } from "vitest";
import {
  cleanAndParseJSON,
  deduplicateSpeakers,
  classifyPersona,
  scoreVoice,
  assignVoices,
  resolveSpeechVoice,
  formatNarrationDuration,
  splitLineIntoChunks,
  buildColorMap,
  normalizeLangCode,
  detectStoryLanguage,
  filterVoicesByLanguage,
  hasVoicesForLanguage,
  getLanguageDisplayName,
  selectVoicePool,
} from "./storyParser";
import { SYSTEM_PROMPT } from "../constants/storyConstants";
import { NARRATOR_COLOR } from "../constants/storyConstants";

const line = (speaker, text = "Hello.") => ({ speaker, text });

// ─── cleanAndParseJSON ───────────────────────────────────────────────────────
describe("cleanAndParseJSON", () => {
  const sample = [{ speaker: "Narrator", text: "Once upon a time." }];

  it("parses a clean JSON array", () => {
    expect(cleanAndParseJSON(JSON.stringify(sample))).toEqual(sample);
  });

  it("strips ```json markdown fences", () => {
    const raw = "```json\n" + JSON.stringify(sample) + "\n```";
    expect(cleanAndParseJSON(raw)).toEqual(sample);
  });

  it("strips bare ``` fences", () => {
    const raw = "```\n" + JSON.stringify(sample) + "\n```";
    expect(cleanAndParseJSON(raw)).toEqual(sample);
  });

  it("strips uppercase ```JSON fences", () => {
    const raw = "```JSON\n" + JSON.stringify(sample) + "\n```";
    expect(cleanAndParseJSON(raw)).toEqual(sample);
  });

  it("ignores chatter before and after the JSON", () => {
    const raw = "Here is your analysis:\n" + JSON.stringify(sample) + "\nHope that helps!";
    expect(cleanAndParseJSON(raw)).toEqual(sample);
  });

  it("removes trailing commas in arrays and objects", () => {
    const raw = '[{"speaker": "Ann", "text": "Hi",}, {"speaker": "Bob", "text": "Yo",},]';
    expect(cleanAndParseJSON(raw)).toEqual([
      { speaker: "Ann", text: "Hi" },
      { speaker: "Bob", text: "Yo" },
    ]);
  });

  it("repairs missing commas between objects", () => {
    const raw = '[{"speaker": "Ann", "text": "Hi"} {"speaker": "Bob", "text": "Yo"}]';
    expect(cleanAndParseJSON(raw)).toEqual([
      { speaker: "Ann", text: "Hi" },
      { speaker: "Bob", text: "Yo" },
    ]);
  });

  it("unwraps known wrapper keys like { lines: [...] }", () => {
    for (const key of ["lines", "dialogue", "story", "output", "data"]) {
      expect(cleanAndParseJSON(JSON.stringify({ [key]: sample }))).toEqual(sample);
    }
  });

  // Known issue: the comma-repair regex runs over the whole string, so a "} {"
  // inside quoted dialogue is altered when the repair path is triggered.
  it.todo("does not alter '} {' inside quoted text during comma repair");

  it("wraps a single object without a known key in an array", () => {
    expect(cleanAndParseJSON('{"speaker": "Ann", "text": "Hi"}')).toEqual([
      { speaker: "Ann", text: "Hi" },
    ]);
  });

  it("auto-closes truncated JSON cut off between objects", () => {
    const raw = '[{"speaker": "Ann", "text": "Hi"}, {"speaker": "Bob", "text": "Yo"},';
    expect(cleanAndParseJSON(raw)).toEqual([
      { speaker: "Ann", text: "Hi" },
      { speaker: "Bob", text: "Yo" },
    ]);
  });

  it("salvages the complete objects when truncated mid-object", () => {
    const raw = '[{"speaker": "Ann", "text": "Hi"}, {"speaker": "Bob", "text": "Yo"';
    expect(cleanAndParseJSON(raw)).toEqual([{ speaker: "Ann", text: "Hi" }]);
  });

  it("does not get confused by brackets inside strings", () => {
    const tricky = [{ speaker: "Ann", text: "Use [brackets] and {braces} here" }];
    const raw = "Result: " + JSON.stringify(tricky) + " done";
    expect(cleanAndParseJSON(raw)).toEqual(tricky);
  });

  it("throws on empty, non-string, or unparseable input", () => {
    expect(() => cleanAndParseJSON("")).toThrow(/Empty response/);
    expect(() => cleanAndParseJSON(null)).toThrow(/Empty response/);
    expect(() => cleanAndParseJSON(42)).toThrow(/Empty response/);
    expect(() => cleanAndParseJSON("this is not json at all")).toThrow(/unparseable/);
  });
});

// ─── deduplicateSpeakers ─────────────────────────────────────────────────────
describe("deduplicateSpeakers", () => {
  it("merges a full name into the shorter name", () => {
    const out = deduplicateSpeakers([line("Harry"), line("Harry Potter")]);
    expect(out.map(l => l.speaker)).toEqual(["Harry", "Harry"]);
  });

  it("merges names that share a word, ignoring titles", () => {
    const out = deduplicateSpeakers([line("Mr Smith"), line("John Smith")]);
    expect(new Set(out.map(l => l.speaker)).size).toBe(1);
  });

  it("is case-insensitive", () => {
    const out = deduplicateSpeakers([line("alice"), line("Alice Wonder")]);
    expect(new Set(out.map(l => l.speaker)).size).toBe(1);
  });

  it("never merges the Narrator into a character", () => {
    const out = deduplicateSpeakers([line("Narrator"), line("Narrator Nick")]);
    expect(out[0].speaker).toBe("Narrator");
  });

  it("keeps distinct speakers separate", () => {
    const out = deduplicateSpeakers([line("Alice"), line("Bob")]);
    expect(out.map(l => l.speaker)).toEqual(["Alice", "Bob"]);
  });

  it("preserves other line fields and does not mutate input", () => {
    const input = [{ speaker: "Harry", text: "a", emotion: "happy" }, { speaker: "Harry Potter", text: "b" }];
    const copy = JSON.parse(JSON.stringify(input));
    const out = deduplicateSpeakers(input);
    expect(out[0].emotion).toBe("happy");
    expect(input).toEqual(copy);
  });

  it("handles an empty list", () => {
    expect(deduplicateSpeakers([])).toEqual([]);
  });
});

// ─── classifyPersona ─────────────────────────────────────────────────────────
describe("classifyPersona", () => {
  it("detects female hints", () => {
    expect(classifyPersona("A gentle, motherly woman").isFemale).toBe(true);
  });

  it("detects male hints", () => {
    const t = classifyPersona("A gruff, deep-voiced warrior");
    expect(t.isMale).toBe(true);
    expect(t.isFemale).toBe(false);
  });

  it("detects age hints", () => {
    expect(classifyPersona("an ancient wizard").isOld).toBe(true);
    expect(classifyPersona("a playful youthful kid").isYoung).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(classifyPersona("ELDERLY QUEEN")).toMatchObject({ isFemale: true, isOld: true });
  });

  it("returns all false for empty, missing, or unrelated personas", () => {
    const none = { isFemale: false, isMale: false, isOld: false, isYoung: false };
    expect(classifyPersona("")).toEqual(none);
    expect(classifyPersona()).toEqual(none);
    expect(classifyPersona("a cheerful narrator")).toEqual(none);
  });

  it.todo("does not flag 'female' personas as male (substring match on 'male')");

  it("combines multiple traits", () => {
    expect(classifyPersona("a young princess")).toMatchObject({ isFemale: true, isYoung: true });
  });
});

// ─── scoreVoice ──────────────────────────────────────────────────────────────
describe("scoreVoice", () => {
  const none = { isFemale: false, isMale: false };
  const v = (name, lang = "en-US") => ({ name, lang });

  it("hard-penalises known problematic voices", () => {
    expect(scoreVoice(v("Microsoft Zira Desktop"), none)).toBe(-1000);
    expect(scoreVoice(v("Amanda Multi"), none)).toBe(-1000);
  });

  it("prefers natural/neural/online voices", () => {
    const plain = scoreVoice(v("Basic Voice"), none);
    const natural = scoreVoice(v("Microsoft Aria Online (Natural)"), none);
    const neural = scoreVoice(v("Some Neural Voice"), none);
    expect(natural).toBeGreaterThan(plain);
    expect(neural).toBeGreaterThan(plain);
  });

  it("prefers English locales, with en-US above en-GB above non-English", () => {
    const us = scoreVoice(v("Voice", "en-US"), none);
    const gb = scoreVoice(v("Voice", "en-GB"), none);
    const fr = scoreVoice(v("Voice", "fr-FR"), none);
    expect(us).toBeGreaterThan(gb);
    expect(gb).toBeGreaterThan(fr);
  });

  it("rewards a gender match and penalises a mismatch", () => {
    const female = { isFemale: true, isMale: false };
    const male = { isFemale: false, isMale: true };
    const fiona = v("Fiona");
    const daniel = v("Daniel");
    expect(scoreVoice(fiona, female)).toBeGreaterThan(scoreVoice(fiona, male));
    expect(scoreVoice(daniel, male)).toBeGreaterThan(scoreVoice(daniel, female));
    expect(scoreVoice(fiona, female)).toBeGreaterThan(scoreVoice(fiona, none));
    expect(scoreVoice(daniel, female)).toBeLessThan(scoreVoice(daniel, none));
  });

  // Known issue: hints are matched by substring, so "man" matches "Samantha"
  // and "male" matches "female". Tracked here until the matching is tightened.
  it.todo("does not treat 'Samantha' as a male-sounding voice name");
});

// ─── assignVoices ────────────────────────────────────────────────────────────
describe("assignVoices", () => {
  const voices = [
    { name: "Fiona Online (Natural)", lang: "en-US", voiceURI: "s" },
    { name: "Daniel Online (Natural)", lang: "en-GB", voiceURI: "d" },
    { name: "Microsoft Zira", lang: "en-US", voiceURI: "z" },
  ];

  it("matches gender hints to voices and never uses problematic voices", () => {
    const result = assignVoices(
      [
        { speaker: "Queen", persona: "regal woman" },
        { speaker: "King", persona: "deep commanding man" },
      ],
      voices
    );
    expect(result.Queen.name).toMatch(/Fiona/);
    expect(result.King.name).toMatch(/Daniel/);
    expect(Object.values(result).some(v => /zira/i.test(v.name))).toBe(false);
  });

  it("gives each character a distinct voice while voices remain", () => {
    const result = assignVoices(
      [{ speaker: "A", persona: "" }, { speaker: "B", persona: "" }],
      voices
    );
    expect(result.A.name).not.toBe(result.B.name);
  });

  it("returns an empty object when no usable voices exist", () => {
    expect(assignVoices([{ speaker: "A" }], [])).toEqual({});
    expect(assignVoices([{ speaker: "A" }], [{ name: "Microsoft Zira", lang: "en-US" }])).toEqual({});
  });
});

// ─── resolveSpeechVoice ──────────────────────────────────────────────────────
describe("resolveSpeechVoice", () => {
  const pool = [
    { name: "Alpha", lang: "en-US", voiceURI: "uri-a" },
    { name: "Beta", lang: "en-GB", voiceURI: "uri-b" },
  ];

  it("returns null for missing data or an empty pool", () => {
    expect(resolveSpeechVoice(null, pool)).toBeNull();
    expect(resolveSpeechVoice({ name: "Alpha" }, [])).toBeNull();
  });

  it("resolves by name string, name object, voiceURI, and language", () => {
    expect(resolveSpeechVoice("Alpha", pool)).toBe(pool[0]);
    expect(resolveSpeechVoice({ name: "Beta" }, pool)).toBe(pool[1]);
    expect(resolveSpeechVoice({ voiceURI: "uri-b" }, pool)).toBe(pool[1]);
    expect(resolveSpeechVoice({ lang: "en-GB" }, pool)).toBe(pool[1]);
  });

  it("returns null when nothing matches", () => {
    expect(resolveSpeechVoice({ name: "Nope", lang: "de-DE" }, pool)).toBeNull();
  });
});

// ─── small pure helpers ──────────────────────────────────────────────────────
describe("formatNarrationDuration", () => {
  it("handles zero", () => {
    expect(formatNarrationDuration(0)).toBe("0 sec");
  });

  it("formats seconds, minutes, and hours", () => {
    expect(formatNarrationDuration(70)).toBe("30 sec"); // 140 wpm
    expect(formatNarrationDuration(140)).toBe("1 min");
    expect(formatNarrationDuration(210)).toBe("1 min 30 sec");
    expect(formatNarrationDuration(140 * 60)).toBe("1 hr");
    expect(formatNarrationDuration(140 * 90)).toBe("1 hr 30 min");
  });
});

describe("splitLineIntoChunks", () => {
  it("returns [] for empty/invalid input", () => {
    expect(splitLineIntoChunks("")).toEqual([]);
    expect(splitLineIntoChunks(null)).toEqual([]);
  });

  it("returns short text as a single chunk", () => {
    expect(splitLineIntoChunks("  Short line.  ")).toEqual(["Short line."]);
  });

  it("splits long text into chunks within the limit without losing words", () => {
    const text = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ") + ".";
    const chunks = splitLineIntoChunks(text, 50);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach(c => expect(c.length).toBeLessThanOrEqual(50));
    expect(chunks.join(" ").replace(/\s+/g, " ")).toBe(text);
  });
});

describe("buildColorMap", () => {
  it("gives the Narrator the narrator color and each character a stable color", () => {
    const map = buildColorMap([line("Narrator"), line("Ann"), line("Bob"), line("Ann")]);
    expect(map.Narrator).toEqual(NARRATOR_COLOR);
    expect(map.Ann).toBeDefined();
    expect(map.Bob).toBeDefined();
    expect(map.Ann).not.toEqual(map.Bob);
    expect(Object.keys(map)).toHaveLength(3);
  });
});

// ─── multi-language support ──────────────────────────────────────────────────
describe("normalizeLangCode", () => {
  it("reduces locales to a lowercase primary language code", () => {
    expect(normalizeLangCode("hi")).toBe("hi");
    expect(normalizeLangCode("hi-IN")).toBe("hi");
    expect(normalizeLangCode("es_MX")).toBe("es");
    expect(normalizeLangCode(" FR ")).toBe("fr");
  });

  it("maps legacy codes and rejects garbage", () => {
    expect(normalizeLangCode("iw-IL")).toBe("he");
    expect(normalizeLangCode("in")).toBe("id");
    expect(normalizeLangCode("")).toBeNull();
    expect(normalizeLangCode(undefined)).toBeNull();
    expect(normalizeLangCode("english")).toBeNull();
    expect(normalizeLangCode("1x")).toBeNull();
  });
});

describe("detectStoryLanguage", () => {
  it("uses the language reported on the lines", () => {
    const lines = [
      { text: "Hola, ¿cómo estás?", language: "es" },
      { text: "Muy bien, gracias.", language: "es-MX" },
    ];
    expect(detectStoryLanguage(lines)).toBe("es");
  });

  it("weights by text length so a short foreign phrase cannot win", () => {
    const lines = [
      { text: "Bonjour", language: "fr" },
      { text: "The old lighthouse stood alone against the storm all night.", language: "en" },
    ];
    expect(detectStoryLanguage(lines)).toBe("en");
  });

  it("falls back to script detection when the model omits the language", () => {
    expect(detectStoryLanguage([{ text: "वह धीरे-धीरे घर की ओर चला।" }])).toBe("hi");
    expect(detectStoryLanguage([{ text: "ひらがなとカタカナと漢字" }])).toBe("ja");
    expect(detectStoryLanguage([{ text: "Привет, как дела?" }])).toBe("ru");
  });

  it("ignores invalid codes and defaults to English", () => {
    expect(detectStoryLanguage([{ text: "Hello there.", language: "klingon" }])).toBe("en");
    expect(detectStoryLanguage([])).toBe("en");
    expect(detectStoryLanguage(undefined)).toBe("en");
  });
});

describe("filterVoicesByLanguage / hasVoicesForLanguage", () => {
  const voices = [
    { name: "A", lang: "en-US" },
    { name: "B", lang: "hi-IN" },
    { name: "C", lang: "hi_IN" },
    { name: "D", lang: "fr-CA" },
    { name: "Microsoft Zira", lang: "hi-IN" },
  ];

  it("matches by primary language across separators", () => {
    expect(filterVoicesByLanguage(voices, "hi").map(v => v.name)).toEqual(["B", "C", "Microsoft Zira"]);
    expect(filterVoicesByLanguage(voices, "fr-FR").map(v => v.name)).toEqual(["D"]);
    expect(filterVoicesByLanguage(voices, "de")).toEqual([]);
    expect(filterVoicesByLanguage(null, "en")).toEqual([]);
  });

  it("does not count problematic voices as available", () => {
    expect(hasVoicesForLanguage(voices, "hi")).toBe(true);
    expect(hasVoicesForLanguage([{ name: "Microsoft Zira", lang: "hi-IN" }], "hi")).toBe(false);
    expect(hasVoicesForLanguage(voices, "de")).toBe(false);
  });
});

describe("getLanguageDisplayName", () => {
  it("returns a readable language name", () => {
    expect(getLanguageDisplayName("hi")).toBe("Hindi");
    expect(getLanguageDisplayName("es-MX")).toBe("Spanish");
    expect(getLanguageDisplayName("???")).toBe("");
  });
});

describe("locale-aware voice assignment", () => {
  const voices = [
    { name: "Fiona Online (Natural)", lang: "en-US", voiceURI: "en1" },
    { name: "Daniel Online (Natural)", lang: "en-GB", voiceURI: "en2" },
    { name: "Elvira Online (Natural)", lang: "es-ES", voiceURI: "es1" },
    { name: "Jorge Online (Natural)", lang: "es-MX", voiceURI: "es2" },
    { name: "Basic Hindi", lang: "hi-IN", voiceURI: "hi1" },
  ];
  const cast = [
    { speaker: "Narrator", persona: "calm" },
    { speaker: "Ana", persona: "young woman" },
    { speaker: "Luis", persona: "deep man" },
  ];

  it("keeps English behaviour by default", () => {
    const result = assignVoices(cast.slice(1), voices);
    expect(Object.values(result).every(v => v.lang.startsWith("en"))).toBe(true);
  });

  it("only uses voices of the story language when available", () => {
    const result = assignVoices(cast, voices, "es");
    expect(Object.values(result).every(v => v.lang.startsWith("es"))).toBe(true);
  });

  it("keeps gender matching inside the locale pool", () => {
    const result = assignVoices(cast.slice(1), voices, "es");
    expect(result.Ana.name).toMatch(/Elvira/);
    expect(result.Luis.name).toMatch(/Jorge/);
  });

  it("prefers quality voices within the locale, but accepts basic ones", () => {
    expect(selectVoicePool(voices, "es").every(v => /online/i.test(v.name))).toBe(true);
    expect(selectVoicePool(voices, "hi").map(v => v.name)).toEqual(["Basic Hindi"]);
  });

  it("falls back to English voices when no locale voice is installed", () => {
    const result = assignVoices(cast, voices, "de");
    expect(Object.keys(result)).toHaveLength(3);
    expect(Object.values(result).every(v => v.lang.startsWith("en"))).toBe(true);
  });

  it("falls back to any safe voice when neither locale nor English exist", () => {
    const onlyFrench = [{ name: "Amelie", lang: "fr-FR", voiceURI: "fr" }];
    expect(assignVoices([{ speaker: "A" }], onlyFrench, "de").A.name).toBe("Amelie");
  });

  it("scores language-matching voices above others for non-English stories", () => {
    const none = { isFemale: false, isMale: false };
    const es = scoreVoice({ name: "Voice", lang: "es-ES" }, none, "es");
    const en = scoreVoice({ name: "Voice", lang: "en-US" }, none, "es");
    expect(es).toBeGreaterThan(en);
  });

  it("prefers the listener's regional variant", () => {
    const none = { isFemale: false, isMale: false };
    const mx = scoreVoice({ name: "Voice", lang: "es-MX" }, none, "es", "MX");
    const es = scoreVoice({ name: "Voice", lang: "es-ES" }, none, "es", "MX");
    expect(mx).toBeGreaterThan(es);
  });
});

describe("SYSTEM_PROMPT", () => {
  it("asks the model for an ISO 639-1 language code on every line without translating", () => {
    expect(SYSTEM_PROMPT).toMatch(/ISO 639-1/);
    expect(SYSTEM_PROMPT).toMatch(/"language"/);
    expect(SYSTEM_PROMPT).toMatch(/NEVER translate/);
  });
});
