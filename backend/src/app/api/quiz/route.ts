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
    const { topic, priorKnowledge } = await req.json();

    if (!topic) {
      return NextResponse.json(
        { error: 'Topic is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY environment variable is not configured' },
        { status: 500, headers: corsHeaders }
      );
    }

    const systemPrompt = `You are an expert tutor. Your task is to generate a diagnostic quiz of exactly 5 multiple-choice questions to assess a user's knowledge about the topic: "${topic}".
The user described their prior knowledge as: "${priorKnowledge || 'None specified'}".

Each question MUST:
1. Target a single specific prerequisite or core technical concept relevant to "${topic}" (e.g. if the topic is "RAG in Rust", concepts might be "Vector Database", "Embeddings", "Rust Async/Await", "Smart Pointers", "Borrow Checker").
2. Have 4 plausible options, with exactly one correct option.
3. Be designed to differentiate between a beginner and an intermediate student.

Return the response in a structured JSON format following the schema provided.`;

    const responseSchema = {
      type: "object",
      properties: {
        questions: {
          type: "array",
          minItems: 5,
          maxItems: 5,
          description: "An array of exactly 5 quiz questions.",
          items: {
            type: "object",
            properties: {
              concept: { 
                type: "string", 
                description: "The specific technical concept/term tested (e.g., 'Smart Pointers', 'Vector database')."
              },
              text: { 
                type: "string", 
                description: "The question text."
              },
              options: {
                type: "array",
                minItems: 4,
                maxItems: 4,
                items: { type: "string" },
                description: "Four multiple-choice options."
              },
              correctAnswer: { 
                type: "string", 
                description: "The exact correct answer (must match one of the items in 'options')."
              }
            },
            required: ["concept", "text", "options", "correctAnswer"]
          }
        }
      },
      required: ["questions"]
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: systemPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.2
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini API');
    }

    const parsedData = JSON.parse(text);
    return NextResponse.json(parsedData, { headers: corsHeaders });

  } catch (error: any) {
    console.error('API Quiz Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate quiz' },
      { status: 500, headers: corsHeaders }
    );
  }
}
