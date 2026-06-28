import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

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

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY environment variable is not configured' },
        { status: 500, headers: corsHeaders }
      );
    }

    const topic = profile?.topic || 'General learning';
    const knownConcepts = profile?.knownConcepts || [];
    const priorKnowledge = profile?.priorKnowledge || '';

    const systemPrompt = `You are a technical learning assistant. The user is watching a video about "${topic}".
Their prior knowledge is: "${priorKnowledge}".
They ALREADY know these concepts (DO NOT extract any of these): ${JSON.stringify(knownConcepts)}.

Analyze this live transcript snippet:
---
"${text}"
---

Your task is to identify and extract any technical concepts, libraries, frameworks, protocols, databases, data structures, algorithms, or programming features mentioned in the text.

Extraction Rules:
1. Extract specific, concrete technical terms (e.g., 'Axum', 'Serde', 'Tokio', 'Vector DB', 'Embeddings', 'Borrow Checker', 'Lifetimes', 'Arc', 'gRPC').
2. Do NOT extract general programming terms (like 'code', 'function', 'loop', 'variable', 'class', 'database') unless they refer to a highly specific pattern.
3. Do NOT extract any concepts that are in the list of what they already know.
4. Extract up to 4 concepts. If nothing new or technical is found, return an empty array under "keywords".

You MUST return a JSON object with a "keywords" key containing an array of objects. Each object must have:
- "term": The exact name of the concept (properly capitalized, e.g., 'Serde').
- "shortDescription": A clear, one-sentence definition explaining it in simple terms.
- "explanation": A detailed 2-3 sentence technical definition explaining how it works and fits into the topic: "${topic}".
- "example": A short, clean code snippet or structure demonstrating it in real life. If not applicable, omit this field.

Ensure the response is a valid, raw JSON object. Do not include markdown code block formatting.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b:free',
        messages: [
          { role: 'user', content: systemPrompt }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter API failed: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenRouter API');
    }

    const parsedData = JSON.parse(content.trim());
    return NextResponse.json(parsedData, { headers: corsHeaders });

  } catch (error: any) {
    console.error('API Process Live Text Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process text' },
      { status: 500, headers: corsHeaders }
    );
  }
}
