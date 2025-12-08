import { GoogleGenAI } from "@google/genai";

// Initialize Gemini
// Note: In a real production app, this should be proxied through a backend to hide the key.
// Since this is a client-side demo request, we assume the env var is present or the user will set it.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getAnimeSuggestions = async (currentVideoTitle: string): Promise<string> => {
  if (!process.env.API_KEY) return "AI Service not configured (Missing API Key).";

  try {
    const model = "gemini-2.5-flash";
    const prompt = `The user is watching an anime video titled "${currentVideoTitle}". 
    Suggest 3 similar anime series they might like. Keep it brief and friendly. 
    Format as a bulleted list.`;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    return response.text || "Couldn't generate suggestions.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, I couldn't connect to the AI brain right now.";
  }
};