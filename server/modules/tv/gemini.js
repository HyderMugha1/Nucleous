import { config } from "../../config.js";
import { stripCodeFences } from "./utils.js";

function ensureGeminiConfigured() {
  if (!config.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is required");
  }
}

const TRANSCRIPTION_PROMPT = `You are a broadcast transcription engine.

Transcribe the spoken content of this video into subtitle-ready segments.

Return only valid JSON with this exact schema:
{
  "language": "string",
  "segments": [
    {
      "start_sec": 0.0,
      "end_sec": 4.2,
      "text": "..."
    }
  ]
}

Rules:
- Use timestamps in seconds.
- Create readable subtitle-style segments.
- Preserve spoken meaning accurately.
- Do not include markdown or code fences.
- Keep each segment short enough for SRT display.
- If speech is unclear, still return your best transcript.
`;

export async function transcribeYouTubeVideoWithGemini(youtubeUrl) {
  ensureGeminiConfigured();

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": config.geminiApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: TRANSCRIPTION_PROMPT },
          { file_data: { file_uri: youtubeUrl } },
        ],
      }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Gemini transcription request failed");
  }

  const rawText = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "";
  const parsed = JSON.parse(stripCodeFences(rawText));
  const segments = Array.isArray(parsed.segments) ? parsed.segments : [];

  return {
    language: parsed.language || "unknown",
    segments: segments.map((segment, index) => ({
      segment_index: index,
      start_sec: Number(segment.start_sec || 0),
      end_sec: Number(segment.end_sec || 0),
      text: String(segment.text || "").trim(),
    })).filter((segment) => segment.text),
  };
}
