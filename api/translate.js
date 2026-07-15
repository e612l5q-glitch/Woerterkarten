export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { word, article, lang } = req.body;
  if (!word) return res.status(400).json({ error: "No word provided" });

  const langNames = {
    RU:"Russisch", UK:"Ukrainisch", TR:"Türkisch", AR:"Arabisch",
    PL:"Polnisch", RO:"Rumänisch", FA:"Persisch", VI:"Vietnamesisch",
    ZH:"Chinesisch", ES:"Spanisch", FR:"Französisch", EN:"Englisch",
    IT:"Italienisch", PT:"Portugiesisch", JA:"Japanisch"
  };
  const langName = langNames[lang] || "Russisch";

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.VITE_ANTHROPIC_KEY,
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

    const data = await response.json();
    const text = data.content[0].text.trim();
    const parsed = JSON.parse(text);
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: "Translation failed" });
  }
}
