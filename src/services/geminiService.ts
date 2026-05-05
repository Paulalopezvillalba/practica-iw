import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const geminiModel = ai.models.generateContent.bind(ai.models, {
  model: "gemini-3-flash-preview",
});

export async function analyzeComment(text: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analiza si el siguiente comentario es ofensivo, hiriente o viola las normas de convivencia de una red social respetuosa. Responde solo con un JSON: {"isOffensive": boolean, "reason": string}. Texto: "${text}"`,
      config: {
        responseMimeType: "application/json",
      }
    });
    
    return JSON.parse(response.text || '{"isOffensive": false}');
  } catch (e) {
    console.error("Error analyzing comment with Gemini:", e);
    return { isOffensive: false };
  }
}
