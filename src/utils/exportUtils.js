export function downloadFile(content, filename, contentType) {
  if (typeof window === "undefined" || !window.Blob) return;
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function formatScriptJSON(parsedLines, characters, voiceAssignments) {
  return JSON.stringify(
    {
      title: "NarrateAI Audiobook Script",
      exportedAt: new Date().toISOString(),
      totalLines: (parsedLines || []).length,
      characters: characters || [],
      voiceAssignments: Object.entries(voiceAssignments || {}).reduce((acc, [speaker, voiceObj]) => {
        acc[speaker] = { name: voiceObj?.name, lang: voiceObj?.lang };
        return acc;
      }, {}),
      lines: (parsedLines || []).map(line => ({
        speaker: line.speaker,
        emotion: line.emotion || "neutral",
        isThought: !!line.isThought,
        language: line.language || line.lang || "en",
        text: line.text,
        voiceProfile: line.voiceProfile || { pitch: 1.0, rate: 1.0 },
      })),
    },
    null,
    2
  );
}

export function formatScriptTranscript(parsedLines, characters) {
  const header = `# NarrateAI Story Transcript\n\n`;
  const charSection = characters && characters.length > 0
    ? `## Characters\n` + characters.map(c => `- **${c.speaker}**: ${c.persona || "Narrator/Character"}`).join("\n") + "\n\n---\n\n"
    : "---\n\n";

  const linesSection = `## Screenplay\n\n` + (parsedLines || []).map(line => {
    const emotion = line.emotion ? ` (${line.emotion})` : "";
    const isNarrator = line.speaker === "Narrator";
    if (isNarrator) {
      return `[Narrator]${emotion}\n${line.text}\n`;
    }
    if (line.isThought) {
      return `**${line.speaker.toUpperCase()}**${emotion} *(thought)*:\n*(${line.text})*\n`;
    }
    return `**${line.speaker.toUpperCase()}**${emotion}:\n"${line.text}"\n`;
  }).join("\n");

  return header + charSection + linesSection;
}

export function exportAsJSON(parsedLines, characters, voiceAssignments) {
  if (!parsedLines || parsedLines.length === 0) return;
  const json = formatScriptJSON(parsedLines, characters, voiceAssignments);
  downloadFile(json, "narrateai-script.json", "application/json");
}

export function exportAsTranscript(parsedLines, characters) {
  if (!parsedLines || parsedLines.length === 0) return;
  const transcript = formatScriptTranscript(parsedLines, characters);
  downloadFile(transcript, "narrateai-transcript.md", "text/markdown");
}

