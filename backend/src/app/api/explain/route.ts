import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(req: Request) {
  try {
    const { term, context } = await req.json();

    if (!term) {
      return NextResponse.json(
        { error: 'Term is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured' },
        { status: 500, headers: corsHeaders }
      );
    }

    const systemPrompt = `You are an expert technical tutor.
Explain the technical term: "${term}"
In the context of learning about: "${context || 'software development'}".

Please provide:
1. A clear, intuitive, and concise explanation (1 to 2 paragraphs) of what the concept is and why it matters, using simple analogies if appropriate.
2. A short, concrete, practical example. If it is a programming topic, provide a clean, code snippet (e.g. in Rust, TS, or Python). Do not write any markdown fences inside the JSON string values, just write the raw code or text example.

Return the response in a structured JSON format following the schema provided.`;

    const responseSchema = {
      type: "object",
      properties: {
        explanation: { 
          type: "string", 
          description: "The paragraph explanation of the term." 
        },
        example: { 
          type: "string", 
          description: "A short, practical code snippet or step-by-step example illustrating the term." 
        }
      },
      required: ["explanation", "example"]
    };

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: systemPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.3
      }
    });

    const outputText = response.text;
    if (!outputText) {
      throw new Error('Empty response from Gemini');
    }

    const parsedData = JSON.parse(outputText);
    return NextResponse.json(parsedData, { headers: corsHeaders });

  } catch (error: any) {
    console.error('API Explain Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to explain term' },
      { status: 500, headers: corsHeaders }
    );
  }
}
