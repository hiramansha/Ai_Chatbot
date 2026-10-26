
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const { message, history = [] } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "API key missing. Check Vercel Environment Variables.",
      });
    }

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "Please enter a message.",
      });
    }

    // Keep recent conversation only.
    const safeHistory = Array.isArray(history)
      ? history
          .filter(
            (item) =>
              item &&
              ["user", "model"].includes(item.role) &&
              typeof item.text === "string" &&
              item.text.trim()
          )
          .slice(-10)
          .map((item) => ({
            role: item.role,
            parts: [{ text: item.text.slice(0, 4000) }],
          }))
      : [];

    // Avoid duplicating the current message.
    const contents = [
      ...safeHistory,
      {
        role: "user",
        parts: [{ text: message.trim().slice(0, 4000) }],
      },
    ];

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: `You are Nova AI, a fast, friendly, natural conversational assistant.

LANGUAGE:
- Reply in the same language and script as the user's latest message.
- English input: reply in English.
- Roman Urdu input: reply in natural Roman Urdu.
- Urdu script input: reply in Urdu script.
- Punjabi input: reply in Punjabi, matching the user's script where possible.
- Understand casual spelling, abbreviations, and mixed languages.

ANSWER STYLE:
- Answer exactly what the user asks. Do not change the topic.
- Be concise and direct by default.
- If the user asks for a short answer, use 1-2 sentences.
- Give detailed explanations only when requested.
- Respond naturally to greetings and casual conversation.
- Avoid unnecessary introductions, headings, lists, and repeated follow-up offers.
- Use plain text. Do not output Markdown formatting symbols such as ** or ##.
- Use previous conversation context when relevant.
- Never claim you remember information that is not present in the conversation.
- Be accurate, helpful, and conversational.`,
              },
            ],
          },
          contents,
          generationConfig: {
            thinkingConfig: {
              thinkingLevel: "LOW",
            },
            maxOutputTokens: 300,
            temperature: 0.5,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", response.status, data);

      return res.status(502).json({
        error:
          response.status === 503
            ? "AI service is temporarily busy. Please try again."
            : `Gemini request failed (HTTP ${response.status}). Check Vercel Function Logs.`,
      });
    }

    const reply = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      return res.status(502).json({
        error: "AI returned an empty response. Please try again.",
      });
    }

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Nova AI error:", error);

    if (error.name === "AbortError") {
      return res.status(504).json({
        error: "AI response timed out. Please try again.",
      });
    }

    return res.status(500).json({
      error: "Server error. Please try again.",
    });
  } finally {
    clearTimeout(timeout);
  }
}
