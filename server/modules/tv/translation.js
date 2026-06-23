const GOOGLE_TRANSLATE_ENDPOINT = "https://translate.googleapis.com/translate_a/single";

const URDU_TO_ROMAN_MAP = {
  ا: "a",
  آ: "aa",
  ب: "b",
  پ: "p",
  ت: "t",
  ٹ: "t",
  ث: "s",
  ج: "j",
  چ: "ch",
  ح: "h",
  خ: "kh",
  د: "d",
  ڈ: "d",
  ذ: "z",
  ر: "r",
  ڑ: "r",
  ز: "z",
  ژ: "zh",
  س: "s",
  ش: "sh",
  ص: "s",
  ض: "z",
  ط: "t",
  ظ: "z",
  ع: "a",
  غ: "gh",
  ف: "f",
  ق: "q",
  ک: "k",
  گ: "g",
  ل: "l",
  م: "m",
  ن: "n",
  ں: "n",
  و: "o",
  ہ: "h",
  ھ: "h",
  ء: "",
  ی: "y",
  ے: "e",
  ئ: "i",
  ۂ: "ah",
  ۓ: "e",
  "،": ",",
  "۔": ".",
  "؟": "?",
};

export function normalizeTranscriptOutputLanguage(outputLanguage) {
  const normalized = String(outputLanguage || "original").trim().toLowerCase();

  if (["original", "english", "urdu", "roman_urdu"].includes(normalized)) {
    return normalized;
  }

  return "original";
}

export function mapOutputLanguageLabel(outputLanguage) {
  if (outputLanguage === "english") return "English";
  if (outputLanguage === "urdu") return "Urdu";
  if (outputLanguage === "roman_urdu") return "Roman Urdu";
  return "Original";
}

function parseGoogleTranslateText(payload) {
  if (!Array.isArray(payload?.[0])) {
    return "";
  }

  return payload[0]
    .map((entry) => (Array.isArray(entry) ? String(entry[0] || "") : ""))
    .join("");
}

async function translateTextChunk(text, targetLanguage) {
  const params = new URLSearchParams({
    client: "gtx",
    sl: "auto",
    tl: targetLanguage,
    dt: "t",
    q: text,
  });

  const response = await fetch(`${GOOGLE_TRANSLATE_ENDPOINT}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Translation request failed with status ${response.status}`);
  }

  const payload = await response.json();
  return parseGoogleTranslateText(payload);
}

export async function translateSegments(segments, targetLanguage) {
  const texts = segments.map((segment) => String(segment.text || "").trim());
  if (texts.length === 0) return [];

  const translated = [];
  const chunkSize = 40;

  for (let index = 0; index < texts.length; index += chunkSize) {
    const chunk = texts.slice(index, index + chunkSize);
    const translatedChunkText = await translateTextChunk(chunk.join("\n"), targetLanguage);
    const translatedChunk = translatedChunkText.split("\n");

    if (translatedChunk.length === chunk.length) {
      translated.push(...translatedChunk);
      continue;
    }

    for (const line of chunk) {
      translated.push(await translateTextChunk(line, targetLanguage));
    }
  }

  return segments.map((segment, index) => ({
    ...segment,
    text: String(translated[index] || segment.text || "").trim(),
  }));
}

export function transliterateUrduTextToRomanUrdu(text) {
  const raw = String(text || "");

  return raw
    .split("")
    .map((character) => {
      if (URDU_TO_ROMAN_MAP[character]) {
        return URDU_TO_ROMAN_MAP[character];
      }

      return character;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

export function transliterateSegmentsToRomanUrdu(segments) {
  return segments.map((segment) => ({
    ...segment,
    text: transliterateUrduTextToRomanUrdu(segment.text),
  }));
}
