import { describe, it, expect } from "vitest";
import {
  cleanAndParseJSON,
  classifyPersona,
  scoreVoice,
  deduplicateSpeakers,
  splitLineIntoChunks,
  formatNarrationDuration,
} from "../NarrateAI";

describe("JSON Parsing & Auto-Repair (cleanAndParseJSON)", () => {
  it("parses valid JSON array correctly", () => {
    const raw = JSON.stringify([
      { speaker: "Narrator", text: "Hello world", emotion: "neutral" },
      { speaker: "Alice", text: "Hi there!", emotion: "happy" },
    ]);
    const result = cleanAndParseJSON(raw);
    expect(result).toHaveLength(2);
    expect(result[0].speaker).toBe("Narrator");
    expect(result[1].speaker).toBe("Alice");
  });

  it("extracts and parses markdown code fences (```json ... ```)", () => {
    const raw = "```json\n[{\"speaker\": \"Bob\", \"text\": \"Nice day!\"}]\n```";
    const result = cleanAndParseJSON(raw);
    expect(result).toHaveLength(1);
    expect(result[0].speaker).toBe("Bob");
  });

  it("extracts and parses generic code fences (``` ... ```)", () => {
    const raw = "```\n[{\"speaker\": \"Carol\", \"text\": \"Indeed.\"}]\n```";
    const result = cleanAndParseJSON(raw);
    expect(result).toHaveLength(1);
    expect(result[0].speaker).toBe("Carol");
  });

  it("handles conversational preamble and postscript surrounding JSON", () => {
    const raw = `Here is the parsed story script for you:
[
  {"speaker": "Narrator", "text": "Once upon a time."},
  {"speaker": "Hero", "text": "I am ready."}
]
Hope you like this result!`;
    const result = cleanAndParseJSON(raw);
    expect(result).toHaveLength(2);
    expect(result[1].speaker).toBe("Hero");
  });

  it("auto-repairs missing commas between JSON objects", () => {
    const raw = `[
      {"speaker": "Narrator", "text": "Line one"}
      {"speaker": "Alice", "text": "Line two"}
    ]`;
    const result = cleanAndParseJSON(raw);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("Line one");
    expect(result[1].text).toBe("Line two");
  });

  it("auto-repairs trailing commas before closing braces/brackets", () => {
    const raw = `[
      {"speaker": "Narrator", "text": "Finished",},
    ]`;
    const result = cleanAndParseJSON(raw);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Finished");
  });

  it("extracts lines from wrapper objects containing a lines array", () => {
    const raw = JSON.stringify({
      lines: [
        { speaker: "Narrator", text: "Inside lines property" },
      ],
    });
    const result = cleanAndParseJSON(raw);
    expect(result).toHaveLength(1);
    expect(result[0].speaker).toBe("Narrator");
  });

  it("throws a clear error on empty or invalid input", () => {
    expect(() => cleanAndParseJSON("")).toThrow("Empty response received from AI model.");
    expect(() => cleanAndParseJSON(null)).toThrow("Empty response received from AI model.");
  });
});

describe("Persona Classification (classifyPersona)", () => {
  it("correctly identifies female and young persona traits", () => {
    const traits = classifyPersona("energetic young feminine girl cheerful");
    expect(traits.isFemale).toBe(true);
    expect(traits.isYoung).toBe(true);
    expect(traits.isMale).toBe(false);
    expect(traits.isOld).toBe(false);
  });

  it("correctly identifies male and elderly persona traits", () => {
    const traits = classifyPersona("wise elderly grandfather deep masculine voice");
    expect(traits.isMale).toBe(true);
    expect(traits.isOld).toBe(true);
    expect(traits.isFemale).toBe(false);
    expect(traits.isYoung).toBe(false);
  });

  it("handles empty or neutral personas gracefully", () => {
    const traits = classifyPersona("");
    expect(traits.isFemale).toBe(false);
    expect(traits.isMale).toBe(false);
    expect(traits.isOld).toBe(false);
    expect(traits.isYoung).toBe(false);
  });
});

describe("Voice Scoring (scoreVoice)", () => {
  it("prioritizes neural and natural voices", () => {
    const voice1 = { name: "Microsoft Jenny Online (Natural)", lang: "en-US" };
    const voice2 = { name: "Generic Voice", lang: "en-US" };
    const traits = { isFemale: false, isMale: false, isOld: false, isYoung: false };

    const score1 = scoreVoice(voice1, traits);
    const score2 = scoreVoice(voice2, traits);
    expect(score1).toBeGreaterThan(score2);
  });

  it("boosts matching female voices for female personas", () => {
    const femaleVoice = { name: "Samantha", lang: "en-US" };
    const maleVoice = { name: "Daniel", lang: "en-US" };
    const traits = { isFemale: true, isMale: false, isOld: false, isYoung: false };

    expect(scoreVoice(femaleVoice, traits)).toBeGreaterThan(scoreVoice(maleVoice, traits));
  });

  it("boosts matching male voices for male personas", () => {
    const femaleVoice = { name: "Samantha", lang: "en-US" };
    const maleVoice = { name: "Daniel", lang: "en-US" };
    const traits = { isFemale: false, isMale: true, isOld: false, isYoung: false };

    expect(scoreVoice(maleVoice, traits)).toBeGreaterThan(scoreVoice(femaleVoice, traits));
  });

  it("severely penalizes problematic or robotic voices", () => {
    const badVoice = { name: "Microsoft Zira Desktop", lang: "en-US" };
    const traits = { isFemale: true, isMale: false, isOld: false, isYoung: false };
    expect(scoreVoice(badVoice, traits)).toBeLessThanOrEqual(-1000);
  });
});

describe("Speaker Deduplication (deduplicateSpeakers)", () => {
  it("unifies honorifics and full names with primary speaker", () => {
    const lines = [
      { speaker: "Lord Voldemort", text: "Avada Kedavra!" },
      { speaker: "Voldemort", text: "You cannot win." },
      { speaker: "Harry", text: "I have already won." },
    ];
    const deduped = deduplicateSpeakers(lines);
    const uniqueSpeakers = Array.from(new Set(deduped.map(l => l.speaker)));
    expect(uniqueSpeakers).toHaveLength(2);
    expect(uniqueSpeakers).toContain("Voldemort");
    expect(uniqueSpeakers).toContain("Harry");
  });

  it("preserves distinct unique character names", () => {
    const lines = [
      { speaker: "Alice", text: "Curiouser and curiouser!" },
      { speaker: "Bob", text: "Indeed." },
      { speaker: "Charlie", text: "Let's explore." },
    ];
    const deduped = deduplicateSpeakers(lines);
    expect(new Set(deduped.map(l => l.speaker)).size).toBe(3);
  });
});

describe("Line Chunking (splitLineIntoChunks)", () => {
  it("keeps short sentences intact", () => {
    const text = "Short line.";
    const chunks = splitLineIntoChunks(text, 150);
    expect(chunks).toEqual(["Short line."]);
  });

  it("chunks sentences exceeding maxChars at natural boundaries", () => {
    const longText = "The dragon rose from the mountain peak with a fierce roar, scattering embers across the sleeping valley below. The villagers gasped in terror as shadows stretched across the night sky.";
    const chunks = splitLineIntoChunks(longText, 100);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach(c => {
      expect(c.length).toBeLessThanOrEqual(130);
    });
  });
});

describe("Narration Duration Formatter (formatNarrationDuration)", () => {
  it("returns 0 sec for empty or 0 words", () => {
    expect(formatNarrationDuration(0)).toBe("0 sec");
  });

  it("formats seconds accurately under 1 minute", () => {
    // 70 words at 140 WPM = 30 seconds
    expect(formatNarrationDuration(70)).toBe("30 sec");
  });

  it("formats minutes and seconds accurately", () => {
    // 210 words at 140 WPM = 90 seconds -> 1 min 30 sec
    expect(formatNarrationDuration(210)).toBe("1 min 30 sec");
  });
});
