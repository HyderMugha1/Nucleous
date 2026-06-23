const GOOGLE_TRANSLATE_ENDPOINT = "https://translate.googleapis.com/translate_a/single";

const URDU_TO_ROMAN_MAP = {
  "\u0627": "a",
  "\u0622": "aa",
  "\u0628": "b",
  "\u067e": "p",
  "\u062a": "t",
  "\u0679": "t",
  "\u062b": "s",
  "\u062c": "j",
  "\u0686": "ch",
  "\u062d": "h",
  "\u062e": "kh",
  "\u062f": "d",
  "\u0688": "d",
  "\u0630": "z",
  "\u0631": "r",
  "\u0691": "r",
  "\u0632": "z",
  "\u0698": "zh",
  "\u0633": "s",
  "\u0634": "sh",
  "\u0635": "s",
  "\u0636": "z",
  "\u0637": "t",
  "\u0638": "z",
  "\u0639": "a",
  "\u063a": "gh",
  "\u0641": "f",
  "\u0642": "q",
  "\u06a9": "k",
  "\u06af": "g",
  "\u0644": "l",
  "\u0645": "m",
  "\u0646": "n",
  "\u06ba": "n",
  "\u0648": "o",
  "\u06c1": "h",
  "\u06be": "h",
  "\u0621": "",
  "\u06cc": "y",
  "\u06d2": "e",
  "\u0626": "i",
  "\u06c2": "ah",
  "\u06d3": "e",
  "\u060c": ",",
  "\u06d4": ".",
  "\u061f": "?",
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
      if (character in URDU_TO_ROMAN_MAP) {
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
