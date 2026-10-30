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
} from "./storyParser";
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

  it("boosts voices matching the target language locale", () => {
    const esVoice = v("Lucia Natural", "es-ES");
    const deVoice = v("Lucia Natural", "de-DE");
    expect(scoreVoice(esVoice, none, "es")).toBeGreaterThan(scoreVoice(deVoice, none, "es"));
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

  it("prioritizes voices matching the target language locale", () => {
    const multiVoices = [
      { name: "Fiona Online (Natural)", lang: "en-US", voiceURI: "fiona" },
      { name: "Lucia Online (Natural)", lang: "es-ES", voiceURI: "lucia" },
      { name: "Jorge Online (Natural)", lang: "es-MX", voiceURI: "jorge" },
    ];
    const result = assignVoices(
      [
        { speaker: "Maria", persona: "young woman" },
        { speaker: "Carlos", persona: "strong man" },
      ],
      multiVoices,
      "es"
    );
    expect(result.Maria.lang).toMatch(/^es/);
    expect(result.Carlos.lang).toMatch(/^es/);
    expect(result.Maria.name).toMatch(/Lucia/);
    expect(result.Carlos.name).toMatch(/Jorge/);
  });

  it("falls back gracefully when target language voices are not available", () => {
    const result = assignVoices(
      [{ speaker: "Narrator", persona: "calm" }],
      voices,
      "fr"
    );
    expect(result.Narrator).toBeDefined();
    expect(result.Narrator.lang).toMatch(/^en/);
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
