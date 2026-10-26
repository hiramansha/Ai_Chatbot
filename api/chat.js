
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("GEMINI_API_KEY is missing in Vercel.");
    return res.status(500).json({
      error: "API key missing. Check Vercel Environment Variables.",
    });
  }

  const { message } = req.body || {};

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({
      error: "Please enter a message.",
    });
  }

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent";

  const requestBody = {
    contents: [
      {
        parts: [{ text: message.trim() }],
      },
    ],
  };

  // Maximum 3 attempts, with a short wait between retries.
  let lastStatus = 500;
  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
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
      }

      lastStatus = response.status;
      lastError = data.error || data;

      console.error("Gemini HTTP status:", lastStatus);
      console.error("Gemini error details:", lastError);

      // Retry only temporary server or rate-limit errors.
      const retryable = [429, 500, 502, 503, 504].includes(lastStatus);

      if (!retryable || attempt === 2) {
        break;
      }
    } catch (error) {
      lastError = error.message;
      lastStatus = 502;

      console.error("Gemini network error:", lastError);

      if (attempt === 2) {
        break;
      }
    }

    // Wait 1 second, then 2 seconds before retrying.
    await new Promise((resolve) =>
      setTimeout(resolve, 1000 * (attempt + 1))
    );
  }

  return res.status(502).json({
    error: `Gemini request failed after retries (HTTP ${lastStatus}).`,
  });
}
