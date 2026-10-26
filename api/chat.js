
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const message = req.body?.message;

  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY is missing in Vercel settings.",
    });
  }

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Please enter a message." });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: message.trim() }],
            },
          ],
        }),
        signal: controller.signal,
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Gemini error:", response.status, data.error || data);

      return res.status(502).json({
        error: `Gemini API error (${response.status}). Please try again.`,
      });
    }

    const reply = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      console.error("No Gemini text returned:", data);
      return res.status(502).json({
        error: "Gemini returned an empty response. Please try again.",
      });
    }

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Chat API error:", error);

    if (error.name === "AbortError") {
      return res.status(504).json({
        error: "Gemini took too long to respond. Please try again.",
      });
    }

    return res.status(502).json({
      error: "Could not connect to Gemini. Please try again.",
    });
  } finally {
    clearTimeout(timeout);
  }
}

