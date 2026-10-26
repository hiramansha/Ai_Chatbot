
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const { message } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("GEMINI_API_KEY is missing in Vercel.");
      return res.status(500).json({
        error: "API key missing. Check Vercel Environment Variables.",
      });
    }

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "Please enter a message.",
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
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
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini HTTP status:", response.status);
      console.error("Gemini error details:", data.error || data);

      return res.status(502).json({
        error: `Gemini request failed (HTTP ${response.status}). Check Vercel Function Logs.`,
      });
    }

    const reply = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      console.error("Gemini returned no text:", data);
      return res.status(502).json({
        error: "Gemini returned no text. Check Vercel Function Logs.",
      });
    }

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Chat function error:", error);

    return res.status(500).json({
      error: "Server error. Check Vercel Function Logs.",
    });
  }
}
