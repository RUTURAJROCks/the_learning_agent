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
    const { term, context } = await req.json();

    if (!term) {
      return NextResponse.json(
        { error: 'Term is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY environment variable is not configured' },
        { status: 500, headers: corsHeaders }
      );
    }

    const systemPrompt = `You are a technical tutor.
Provide a clear technical explanation and a short, practical coding example for the term: "${term}".
The context of the user's learning session is: "${context || 'General technical learning'}".

You MUST return a JSON object with the following properties:
- "explanation": A detailed, 2-3 sentence paragraph technical definition.
- "example": A short, practical code snippet or step-by-step example illustrating the term. If not applicable, omit it.

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
    console.error('API Explain Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to explain term' },
      { status: 500, headers: corsHeaders }
    );
  }
}
