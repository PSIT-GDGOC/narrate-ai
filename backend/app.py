import os
import json
import re
from typing import List, Dict, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="NarrateAI API", description="AI-powered story analysis for multi-voice audiobooks")

# Enable CORS for your frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://narrateai.vercel.app",
        "*"  # For testing - restrict in production
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Request/Response Models ---
class AnalyzeRequest(BaseModel):
    text: str
    apiKey: str  # User provides their own key

class VoiceProfile(BaseModel):
    pitch: float
    rate: float

class StoryLine(BaseModel):
    speaker: str
    text: str
    emotion: str
    isThought: bool = False
    persona: str
    voiceProfile: VoiceProfile

class AnalyzeResponse(BaseModel):
    lines: List[StoryLine]
    characters: List[Dict[str, str]]

# --- Constants (copied from your React app) ---
SYSTEM_PROMPT = """You are an expert literary analyst and audiobook director. Your job is to parse story text and extract structured dialogue data for an AI-powered multi-voice audiobook engine called NarrateAI.

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
]"""

# --- Helper Functions ---
def clean_and_parse_json(raw_text: str) -> List[Dict]:
    """Extract and robustly parse JSON from LLM response with multi-stage auto-repair"""
    if not raw_text or not isinstance(raw_text, str):
        raise ValueError("Empty response received from AI model.")

    cleaned = raw_text.strip()
    # 1. Strip markdown fences
    cleaned = re.sub(r'```(?:json)?', '', cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.replace('```', '').strip()

    # 2. Direct fast-path parse
    try:
        data = json.loads(cleaned)
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            for k in ['lines', 'dialogue', 'story', 'output', 'data']:
                if k in data and isinstance(data[k], list):
                    return data[k]
            return [data]
    except Exception:
        pass

    # 3. Extract JSON start
    first_bracket = cleaned.find('[')
    first_brace = cleaned.find('{')
    root_type = "array"
    start_idx = first_bracket
    if first_brace != -1 and (first_bracket == -1 or first_brace < first_bracket):
        root_type = "object"
        start_idx = first_brace

    if start_idx != -1:
        cleaned = cleaned[start_idx:]

    # 4. Fix missing commas between objects: } \s* { -> }, {
    cleaned = re.sub(r'\}\s*(?=\{)', '},', cleaned)
    cleaned = re.sub(r'\]\s*(?=\[)', '],', cleaned)

    # 5. Fix trailing commas
    cleaned = re.sub(r',\s*([\]\}])', r'\1', cleaned)

    # 6. Handle truncated output
    if root_type == "array":
        last_bracket = cleaned.rfind(']')
        if last_bracket != -1:
            cleaned = cleaned[:last_bracket + 1]
        else:
            last_brace = cleaned.rfind('}')
            if last_brace != -1:
                cleaned = cleaned[:last_brace + 1] + "\n]"
            else:
                cleaned = cleaned + "\n]"
    else:
        last_brace = cleaned.rfind('}')
        if last_brace != -1:
            cleaned = cleaned[:last_brace + 1]
        else:
            cleaned = cleaned + "\n}"

    # 7. Try parse after syntactic repair
    try:
        data = json.loads(cleaned)
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            for k in ['lines', 'dialogue', 'story', 'output', 'data']:
                if k in data and isinstance(data[k], list):
                    return data[k]
            return [data]
    except Exception:
        pass

    # 8. Individual object regex salvage
    object_matches = re.findall(r'\{[^{}]*\}', cleaned)
    recovered = []
    for m in object_matches:
        try:
            fixed = re.sub(r',\s*\}', '}', m)
            obj = json.loads(fixed)
            if isinstance(obj, dict) and ('text' in obj or 'speaker' in obj):
                recovered.append(obj)
        except Exception:
            continue

    if recovered:
        return recovered

    raise ValueError("Unable to parse AI story analysis. The AI returned an unparseable response.")

def deduplicate_speakers(parsed_lines: List[Dict]) -> List[Dict]:
    """Fuzzy deduplicate speaker names"""
    speakers = list(set(line['speaker'] for line in parsed_lines if line['speaker'] != 'Narrator'))
    alias_map = {}
    
    for i in range(len(speakers)):
        for j in range(i + 1, len(speakers)):
            s1 = speakers[i].lower()
            s2 = speakers[j].lower()
            
            words1 = [w for w in s1.split() if w not in ['mr', 'mrs', 'ms', 'lord', 'lady', 'sir']]
            words2 = [w for w in s2.split() if w not in ['mr', 'mrs', 'ms', 'lord', 'lady', 'sir']]
            
            if s1 in s2 or s2 in s1:
                primary = s1 if len(s1) <= len(s2) else s2
                alias = s2 if len(s1) <= len(s2) else s1
                alias_map[alias] = primary
            elif any(w in words2 for w in words1 if len(w) > 2):
                primary = s1 if len(s1) <= len(s2) else s2
                alias = s2 if len(s1) <= len(s2) else s1
                alias_map[alias] = primary
    
    result = []
    for line in parsed_lines:
        if line['speaker'] in alias_map:
            line['speaker'] = alias_map[line['speaker']]
        result.append(line)
    
    return result

def split_story_into_chunks(story_text: str, target_words: int = 320) -> List[str]:
    """Split text into manageable scene chunks by paragraphs and sentences"""
    if not story_text or not story_text.strip():
        return []

    raw_paragraphs = [p.strip() for p in story_text.split('\n') if p.strip()]
    if not raw_paragraphs:
        return [story_text.strip()]

    total_words = len(story_text.split())
    if total_words <= 380:
        return [story_text.strip()]

    chunks = []
    current_chunk = []
    current_words = 0

    for para in raw_paragraphs:
        para_words = len(para.split())
        if current_words + para_words > target_words and current_chunk:
            chunks.append("\n\n".join(current_chunk))
            current_chunk = [para]
            current_words = para_words
        else:
            current_chunk.append(para)
            current_words += para_words

    if current_chunk:
        chunks.append("\n\n".join(current_chunk))

    return chunks

# --- Main Analysis Function ---
async def analyze_story(text: str, api_key: str) -> Dict:
    """Core story analysis using Groq with automatic scene chunking"""
    client = Groq(api_key=api_key)
    
    preferred_order = [
        "llama-3.3-70b-versatile",
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "llama-3.1-70b-versatile",
        "llama-3.1-8b-instant",
        "gemma2-9b-it",
        "qwen/qwen3.8-27b",
        "qwen/qwen3.6-27b",
        "qwen-2.5-32b",
    ]
    models = preferred_order
    try:
        models_data = client.models.list().data
        excluded = ["whisper", "guard", "embed", "moderation", "tts", "stt", "vision", "compound-mini", "llama3-70b", "llama3-8b"]
        active_ids = [m.id for m in models_data if not any(ex in m.id.lower() for ex in excluded)]
        if active_ids:
            models = [m for m in preferred_order if m in active_ids] + [m for m in active_ids if m not in preferred_order]
    except Exception as e:
        print(f"Dynamic model query warning: {e}")

    chunks = split_story_into_chunks(text, 320)
    all_lines = []
    known_characters = {}

    for i, chunk in enumerate(chunks):
        chunk_parsed = None
        char_prompt = ""
        if known_characters:
            char_list = ", ".join([f'"{k}" ({v})' for k, v in known_characters.items()])
            char_prompt = f"\n\nALREADY INTRODUCED CHARACTERS: {char_list}. If any of these characters appear, use their exact name and persona."

        chunk_text = chunk + char_prompt
        last_error = None

        for model in models:
            token_limit = 950 if "qwen" in model.lower() else 4096
            create_params = {
                "model": model,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Analyze this story:\n\n{chunk_text}"}
                ],
                "temperature": 0.4,
                "max_tokens": token_limit,
            }
            if "gpt-oss" in model:
                create_params["reasoning_format"] = "hidden"

            try:
                completion = client.chat.completions.create(**create_params)
                raw_text = completion.choices[0].message.content
                parsed = clean_and_parse_json(raw_text)
                if isinstance(parsed, list) and len(parsed) > 0:
                    chunk_parsed = [line for line in parsed if line.get('text', '').strip()]
                    break
            except Exception as e:
                print(f"Model {model} failed on chunk {i + 1}: {e}")
                last_error = e
                if "invalid_api_key" in str(e).lower() or "401" in str(e):
                    raise Exception("Invalid Groq API key. Please check your key at console.groq.com/keys")

        if chunk_parsed:
            for line in chunk_parsed:
                all_lines.append(line)
                spk = line.get('speaker', 'Narrator')
                if spk != 'Narrator' and line.get('persona'):
                    known_characters[spk] = line.get('persona')
        elif not all_lines and i == len(chunks) - 1:
            raise Exception(f"Failed to analyze story: {last_error}")

    if not all_lines:
        raise Exception("The AI did not extract any readable narrative lines from your story.")

    all_lines = deduplicate_speakers(all_lines)
    char_map = {}
    for line in all_lines:
        spk = line.get('speaker', 'Narrator')
        if spk not in char_map:
            char_map[spk] = line.get('persona', '')

    characters = [{'speaker': k, 'persona': v} for k, v in char_map.items()]
    return {
        'lines': all_lines,
        'characters': characters
    }

# --- API Endpoints ---
@app.get("/")
async def root():
    return {"message": "NarrateAI API is running", "status": "healthy"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/analyze")
async def analyze(request: AnalyzeRequest):
    """
    Analyze a story text using the user's Groq API key.
    
    Args:
        request: JSON with 'text' (story) and 'apiKey' (user's Groq key)
    
    Returns:
        JSON with 'lines' and 'characters'
    """
    if not request.text or len(request.text.strip()) < 10:
        raise HTTPException(status_code=400, detail="Story must be at least 10 characters long")
    
    if not request.apiKey or len(request.apiKey.strip()) < 20:
        raise HTTPException(status_code=400, detail="Valid Groq API key is required")
    
    try:
        result = await analyze_story(request.text, request.apiKey)
        return result
    except Exception as e:
        error_msg = str(e)
        if "Invalid Groq API key" in error_msg:
            raise HTTPException(status_code=401, detail=error_msg)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {error_msg}")

@app.get("/voices")
async def get_voice_instructions():
    """Returns the emotion-to-voice-parameter mapping"""
    return {
        "neutral": {"pitch": 1.0, "rate": 1.0, "volume": 1.0},
        "happy": {"pitch": 1.2, "rate": 1.1, "volume": 1.0},
        "angry": {"pitch": 0.9, "rate": 1.2, "volume": 1.0},
        "sad": {"pitch": 0.8, "rate": 0.75, "volume": 0.85},
        "fearful": {"pitch": 1.2, "rate": 1.3, "volume": 0.9},
        "excited": {"pitch": 1.3, "rate": 1.25, "volume": 1.0},
        "surprised": {"pitch": 1.35, "rate": 1.15, "volume": 1.0}
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)