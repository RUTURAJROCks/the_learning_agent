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

You MUST return a JSON object containing a "keywords" key, which is an array of objects. Each object must represent an unfamiliar concept and have the following properties:
- "term": The exact name of the concept (properly capitalized, e.g., 'Axum', 'gRPC', 'Serde').
- "shortDescription": A clear, one-sentence definition explaining what it is in simple terms.
- "explanation": A detailed 2-3 sentence technical definition explaining how it fits into the video topic of "${topic}".
- "example": A short practical code snippet or design structure demonstrating how to use it in real life. If not applicable, omit it.

Ensure the response is a valid, raw JSON object. Do not include markdown code block formatting (like \`\`\`json).`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash:free',
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
