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
    const { topic, priorKnowledge } = await req.json();

    if (!topic) {
      return NextResponse.json(
        { error: 'Topic is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY environment variable is not configured' },
        { status: 500, headers: corsHeaders }
      );
    }

    const systemPrompt = `You are an expert tutor. Your task is to generate a diagnostic quiz of exactly 5 multiple-choice questions to assess a user's knowledge about the topic: "${topic}".
The user described their prior knowledge as: "${priorKnowledge || 'None specified'}".

Each question MUST:
1. Target a single specific prerequisite or core technical concept relevant to "${topic}" (e.g. if the topic is "RAG in Rust", concepts might be "Vector Database", "Embeddings", "Rust Async/Await", "Smart Pointers", "Borrow Checker").
2. Have 4 plausible options, with exactly one correct option.
3. Be designed to differentiate between a beginner and an intermediate student.

You MUST return a JSON object containing a "questions" key, which is an array of exactly 5 objects. Each object must have the following properties:
- "concept": The specific technical concept/term tested (e.g., 'Smart Pointers', 'Vector database').
- "text": The question text.
- "options": An array of exactly 4 strings representing multiple-choice options.
- "correctAnswer": The exact correct answer (must match one of the items in 'options').

Ensure the response is a valid, raw JSON object. Do not include markdown code block formatting (like \`\`\`json).`;

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
    console.error('API Quiz Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate quiz' },
      { status: 500, headers: corsHeaders }
    );
  }
}
