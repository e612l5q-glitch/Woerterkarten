export default async function handler(req, res) {
  const reqId = Math.random().toString(36).slice(2, 8);
  const log = (...args) => console.log(`[translate ${reqId}]`, ...args);
  const err = (...args) => console.error(`[translate ${reqId}]`, ...args);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    log("rejected non-POST method:", req.method);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { word, article, lang } = req.body || {};
  if (!word) {
    log("rejected: no word provided");
    return res.status(400).json({ error: "No word provided" });
  }

  const hasKey = Boolean(process.env.ANTHROPIC_KEY);
  log("ANTHROPIC_KEY present:", hasKey, "| length:", (process.env.ANTHROPIC_KEY || "").length);
  if (!hasKey) {
    err("ANTHROPIC_KEY is missing");
  }

  const langNames = {
    RU: "Russisch", UK: "Ukrainisch", TR: "Türkisch", AR: "Arabisch",
    PL: "Polnisch", RO: "Rumänisch", FA: "Persisch", VI: "Vietnamesisch",
    ZH: "Chinesisch", ES: "Spanisch", FR: "Französisch", EN: "Englisch",
    IT: "Italienisch", PT: "Portugiesisch", JA: "Japanisch"
  };
  const langName = langNames[lang] || "Russisch";

  try {
    log("calling Anthropic API...");
    const started = Date.now();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{
          role: "user",
          content: `Du bist ein Wörterbuch-Assistent für Deutschlerner.
Für das deutsche Wort "${article ? article + " " : ""}${word}" gib mir:
1. Eine kurze Übersetzung ins ${langName} (1-3 Wörter)
2. Einen einfachen deutschen Beispielsatz (A2-B1 Niveau)

Antworte NUR im JSON-Format ohne Markdown:
{"translation": "...", "example": "..."}`
        }]
      })
    });

    log(`Anthropic responded: HTTP ${response.status} in ${Date.now() - started}ms`);

    if (!response.ok) {
      const rawError = await response.text();
      err(`Anthropic API error ${response.status}:`, rawError);
      return res.status(502).json({ error: "Translation failed" });
    }

    const data = await response.json();

    const text = data?.content?.[0]?.text?.trim();
    if (!text) {
      err("Unexpected Anthropic response shape (no content[0].text):", JSON.stringify(data).slice(0, 1000));
      return res.status(502).json({ error: "Translation failed" });
    }

    log("raw model text:", text);

    const cleaned_text = extractJson(text);

    let parsed;
    try {
      parsed = JSON.parse(cleaned_text);
    } catch (parseErr) {
      err("Failed to JSON.parse model output. Raw text was:", text, "| parse error:", parseErr.message);
      return res.status(502).json({ error: "Translation failed" });
    }

    log("success:", parsed);
    return res.status(200).json(parsed);

  } catch (e) {
    err("Unhandled exception:", e?.message);
    err("Stack:", e?.stack);
    return res.status(500).json({ error: "Translation failed" });
  }
}

function extractJson(raw) {
  let s = raw.trim();
 
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) s = fence[1].trim();
 
  if (!s.startsWith("{")) {
    const first = s.indexOf("{");
    const last = s.lastIndexOf("}");
    if (first !== -1 && last > first) s = s.slice(first, last + 1);
  }
 
  return s.trim();
}
