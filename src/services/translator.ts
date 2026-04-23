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

// Keeping the old one just in case, though we will pivot to OCR reflow
export async function translateTextFragments(
  fragments: Record<number, string>,
  targetLanguage: string
): Promise<Record<number, string>> {
  if (Object.keys(fragments).length === 0) return {};

  const prompt = `You are an expert translator. 

YOUR OBJECTIVE: Translate the following text fragments from a PDF document into exactly this target language: "${targetLanguage}".
CRITICAL: You MUST translate into "${targetLanguage}". Do not output Chinese unless "${targetLanguage}" is Chinese.

The input is a JSON object where keys are sequential indices and values are text fragments from a single page in reading order.

CRITICAL RULES FOR PDF LAYOUT PRESERVATION:
PDFs often break sentences across multiple lines or fragments to fit the page structure (columns, paragraphs, margins).
To perfectly preserve this visual layout, you MUST translate the full sentence logically, but then DISTRIBUTE the translated text back into the original fragment keys.

Rules for distribution:
1. Identify the full sentence spanning multiple fragments.
2. Translate the entire sentence logically and fluently into ${targetLanguage}.
3. Split the translated sentence proportionally and place the parts back into their original corresponding keys.
4. Try to make the length of the translated fragments visually proportional to the original fragments.
5. Do NOT leave any keys empty unless the original was empty.
6. The output JSON must have the EXACT SAME set of keys as the input.

Example of Distribution Concept:
If a sentence spans indices "1" and "2", translate it as a whole to "${targetLanguage}", then place the first half of the translation in key "1" and the second half in key "2". Do NOT put everything in key "1" and leave "2" empty.

OTHER RULES:
- Preserve structural spaces, newlines, and bullet points at the start of fragments.
- Keep numbers, product names, acronyms, and pure symbols exactly as they are.
- DO NOT ADD OR REMOVE KEYS.

Input JSON:
${JSON.stringify(fragments)}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const resultText = response.text || '{}';
    console.log("Gemini Raw Response:", resultText);
    const translated = JSON.parse(resultText);

    // Ensure all keys are present and fallback to original if missing
    const finalResult: Record<number, string> = {};
    for (const key in fragments) {
      finalResult[key] = translated[key] !== undefined ? translated[key] : fragments[key];
    }
    return finalResult;
  } catch (error) {
    console.error("Translation API error caught:");
    console.error(error);
    return fragments; // Fallback to original on error
  }
}
