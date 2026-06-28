import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

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
    const { text, profile } = await req.json();

    if (!text) {
      return NextResponse.json(
        { keywords: [] },
        { headers: corsHeaders }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured' },
        { status: 500, headers: corsHeaders }
      );
    }

    const topic = profile?.topic || 'General learning';
    const knownConcepts = profile?.knownConcepts || [];
    const priorKnowledge = profile?.priorKnowledge || '';

    // Create a strict instruction prompt to find unfamiliar terms
    const systemPrompt = `You are a helpful learning assistant. The user is watching a YouTube video or Live Stream about: "${topic}".
Their prior knowledge is: "${priorKnowledge}".
They ALREADY know the following concepts: ${JSON.stringify(knownConcepts)}. DO NOT extract or return any of these concepts.

Analyze the following short transcript text snippet:
---
"${text}"
---

Identify any advanced technical terms, acronyms, frameworks, libraries, design patterns, or domain-specific concepts mentioned in the text that:
1. Are highly relevant to the topic of "${topic}".
2. A learner with their profile is unlikely to know, OR that are NOT in the list of what they already know.
3. Exclude extremely common, basic words (like 'programming', 'function', 'variable', 'data', 'computer' unless used in a highly specific complex context).
4. Extract at most 3-4 keywords. If no keywords are found, return an empty array.

For each concept, provide:
- 'term': The exact name of the concept (properly capitalized, e.g., 'Axum', 'gRPC', 'Serde').
- 'shortDescription': A clear, one-sentence definition explaining what it is in simple terms.

Return the response in a structured JSON format following the schema provided.`;

    const responseSchema = {
      type: "object",
      properties: {
        keywords: {
          type: "array",
          description: "A list of newly extracted unfamiliar concepts.",
          items: {
            type: "object",
            properties: {
              term: { 
                type: "string", 
                description: "The name of the term/concept (e.g. 'Tokio', 'B-Tree')." 
              },
              shortDescription: { 
                type: "string", 
                description: "A 1-sentence description suitable for a quick learning overlay." 
              }
            },
            required: ["term", "shortDescription"]
          }
        }
      },
      required: ["keywords"]
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: systemPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.1
      }
    });

    const outputText = response.text;
    if (!outputText) {
      throw new Error('Empty response from Gemini');
    }

    const parsedData = JSON.parse(outputText);
    return NextResponse.json(parsedData, { headers: corsHeaders });

  } catch (error: any) {
    console.error('API Process Live Text Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process text' },
      { status: 500, headers: corsHeaders }
    );
  }
}
