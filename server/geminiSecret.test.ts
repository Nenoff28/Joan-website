import { describe, expect, it } from "vitest";

describe("Gemini protected secret", () => {
  it("authenticates a lightweight server-side Gemini request", async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    expect(apiKey, "GEMINI_API_KEY must be configured for this smoke test").toBeTruthy();

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey as string },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Отговори само с OK." }] }],
        generationConfig: { responseMimeType: "text/plain", maxOutputTokens: 8 },
      }),
    });

    expect(response.ok, `Gemini endpoint returned HTTP ${response.status}`).toBe(true);
  }, 30_000);
});
