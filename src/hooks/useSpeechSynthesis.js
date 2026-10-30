import { useState, useRef, useEffect } from "react";
import { EMOTION_PARAMS } from "../constants/storyConstants";
import { isProblematicVoice, resolveSpeechVoice, splitLineIntoChunks } from "../utils/storyParser";

export default function useSpeechSynthesis(parsedLines = [], voiceAssignments = {}) {
  const [speechSupported] = useState(
    () => typeof window !== "undefined" && "speechSynthesis" in window && !!window.speechSynthesis
  );
  const [availableVoices, setAvailableVoices] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [showFinished, setShowFinished] = useState(false);

  const synthRef = useRef(typeof window !== "undefined" ? window.speechSynthesis : null);
  const watchdogIntervalRef = useRef(null);
  const indexRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef(1.0);
  const linesRef = useRef([]);
  const voiceRef = useRef({});
  const generationRef = useRef(0);

  // Sync references in an effect
  useEffect(() => {
    linesRef.current = parsedLines;
    voiceRef.current = voiceAssignments;
    speedRef.current = speed;
  }, [parsedLines, voiceAssignments, speed]);

  // Load available voices
  useEffect(() => {
    if (!speechSupported || !synthRef.current) return;
    const synth = synthRef.current;
    function loadVoices() {
      const voices = synth.getVoices().filter(v => !isProblematicVoice(v));
      if (voices.length > 0) setAvailableVoices(voices);
    }
    loadVoices();
    synth.onvoiceschanged = loadVoices;
    return () => {
      synth.onvoiceschanged = null;
    };
  }, [speechSupported]);

  function cleanupWatchdog() {
    if (watchdogIntervalRef.current) {
      clearInterval(watchdogIntervalRef.current);
      watchdogIntervalRef.current = null;
    }
  }

  function startWatchdog() {
    cleanupWatchdog();
    watchdogIntervalRef.current = setInterval(() => {
      if (synthRef.current && synthRef.current.speaking && !synthRef.current.paused) {
        synthRef.current.pause();
        synthRef.current.resume();
      }
    }, 10000);
  }

  function playLine(index) {
    const lines = linesRef.current;
    const voices = voiceRef.current;
    const generation = generationRef.current;

    cleanupWatchdog();

    if (!synthRef.current || !playingRef.current) return;
    if (generation !== generationRef.current) return;

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
    const assignedVoiceData = voices[line.speaker];

    const pool = synthRef.current ? synthRef.current.getVoices() : [];
    const safePool = pool.filter(v => !isProblematicVoice(v));
    const actualVoiceObj = assignedVoiceData
      ? resolveSpeechVoice(assignedVoiceData, safePool.length > 0 ? safePool : pool)
      : null;
    const selectedVoice = (actualVoiceObj && !isProblematicVoice(actualVoiceObj))
      ? actualVoiceObj
      : (safePool.length > 0 ? safePool[0] : null);

    const chunks = splitLineIntoChunks(line.text, 150);
    let chunkIndex = 0;

    const speakNextChunk = () => {
      if (!playingRef.current || generation !== generationRef.current) {
        cleanupWatchdog();
        return;
      }

      if (chunkIndex >= chunks.length) {
        cleanupWatchdog();
        if (playingRef.current && generation === generationRef.current) {
          playLine(index + 1);
        }
        return;
      }

      const chunkText = chunks[chunkIndex];
      chunkIndex += 1;

      const utt = new SpeechSynthesisUtterance(chunkText);
      if (selectedVoice) {
        utt.voice = selectedVoice;
      }
      if (line.language || line.lang) {
        utt.lang = line.language || line.lang;
      } else if (selectedVoice?.lang) {
        utt.lang = selectedVoice.lang;
      }
      utt.pitch = Math.min(2.0, Math.max(0.1, vp.pitch * emotionParams.pitch));
      utt.rate = Math.min(3.0, Math.max(0.1, vp.rate * emotionParams.rate * speedRef.current));
      utt.volume = emotionParams.volume;

      utt.onend = () => {
        speakNextChunk();
      };

      utt.onerror = () => {
        speakNextChunk();
      };

      startWatchdog();
      synthRef.current.speak(utt);
    };

    speakNextChunk();
  }

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
    cleanupWatchdog();
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
    cleanupWatchdog();
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
    if (currentIndex < linesRef.current.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      indexRef.current = nextIdx;
      if (playingRef.current) {
        startPlayback(nextIdx);
      }
    }
  }

  function skipBackward() {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      indexRef.current = prevIdx;
      if (playingRef.current) {
        startPlayback(prevIdx);
      }
    }
  }

  function handleSpeedChange(newSpeed) {
    setSpeed(newSpeed);
    speedRef.current = newSpeed;
    if (playingRef.current) {
      const currentIdx = indexRef.current;
      startPlayback(currentIdx);
    }
  }

  return {
    speechSupported,
    availableVoices,
    isPlaying,
    currentIndex,
    setCurrentIndex,
    speed,
    showFinished,
    setShowFinished,
    startPlayback,
    stopPlayback,
    pausePlayback,
    handlePlay,
    skipForward,
    skipBackward,
    handleSpeedChange,
    synthRef,
  };
}
