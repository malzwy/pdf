import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'AI_STUDIO_DUMMY_KEY' });


export async function translatePageImage(
  base64Image: string,
  targetLanguage: string
): Promise<string> {
  const prompt = `You are a professional document translator and OCR expert.

YOUR OBJECTIVE: Read the text from this document image and translate it into: "${targetLanguage}".

CRITICAL INSTRUCTIONS:
1. Extract and translate ALL text from the image into ${targetLanguage}.
2. Ignore the strict absolute positioning/bounding boxes of the original PDF. Instead, focus on the LOGICAL flow (paragraphs, headings, lists).
3. Output the result in clean, well-formatted Markdown. Use Markdown headings (#, ##), bold text (**text**), and lists (-, 1.) to mirror the visual hierarchy of the original document.
4. If there are tables, format them as Markdown tables.
5. ONLY output the translated Markdown. Do not include the original text or conversational filler.

This approach resolves text overlap by allowing the translated text to naturally reflow and wrap on a blank canvas.`;

  try {
    // Strip the data URL prefix (e.g., "data:image/jpeg;base64,")
    const base64Data = base64Image.split(',')[1];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType: 'image/jpeg'
          }
        }
      ],
    });

    return response.text || '*No translation generated.*';
  } catch (error) {
    console.error("Vision translation API error:", error);
    return '*An error occurred during OCR translation. Please check the console.*';
  }
}

async function callModel(prompt: string, config?: { isJson: boolean }): Promise<string> {
  const localEndpoint = import.meta.env.VITE_LOCAL_MODEL_ENDPOINT;
  const localModelName = import.meta.env.VITE_LOCAL_MODEL_NAME;

  if (localEndpoint && localModelName) {
    try {
      const response = await fetch(`${localEndpoint}/chat/completions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer placeholder' // OpenAI compatibility requires auth header usually
        },
        body: JSON.stringify({
          model: localModelName,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          stream: false,
        }),
      });
      const data = await response.json();
      return data.choices[0].message.content;
    } catch (e) {
      console.error("OpenAI-compatible local model failed, falling back to Gemini:", e);
    }
  }

  // Fallback to Gemini
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: config?.isJson ? { responseMimeType: 'application/json' } : {},
  });
  return response.text || '{}';
}

// Keeping the old one just in case, though we will pivot to OCR reflow
export async function translateTextFragments(
  fragments: Record<number, string>,
  targetLanguage: string
): Promise<Record<number, string>> {
  if (Object.keys(fragments).length === 0) return {};

  const prompt = `You are a world-class document translator specializing in complex PDF structures (tables, sidebars, charts).

YOUR OBJECTIVE: Translate the following text fragments.

CRITICAL INSTRUCTIONS FOR STRUCTURAL ELEMENTS:
1. TABLES: If a fragment contains tabular data (delimited by row/column structures conceptually), you MUST output it as a valid Markdown Table. Do not break the table row-by-row; translate the semantic block.
2. SIDEBARS/BOXES: Treat these as complete semantic units. Maintain their cohesive message. Do not split sentences arbitrarily within these boxes.
3. GENERAL: Output strictly in the target language: "${targetLanguage}".
   - Keep structural formatting (headings, lists) intact.
   - For simple text, translate fluently.

Input JSON:
${JSON.stringify(fragments)}`;

  try {
    const resultText = await callModel(prompt, { isJson: true });
    return JSON.parse(resultText);
  } catch (error) {
    console.error("Translation API error caught:", error);
    return fragments; // Fallback to original
  }
}
