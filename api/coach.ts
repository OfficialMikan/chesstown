// Vercel serverless LLM proxy. Tries several OpenRouter free models in order
// and uses the first one that returns real content (not just reasoning).
//
// We deliberately avoid reasoning-only models like Cohere's "code" variant
// because they put everything in reasoning_details and stream empty content.

import type { VercelRequest, VercelResponse } from '@vercel/node';

const SYSTEM_PROMPT = `You are a chess coach. Use ONLY the JSON context given. Be concise (2-4 sentences). Use **bold** for move names. Do not start with "I". If bestMoveSan is null, say "no engine suggestion available". Never invent moves.`;

const MODEL_CHAIN = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'qwen/qwen-2.5-72b-instruct:free',
    'mistralai/mistral-small-3.2-24b-instruct:free',
    'openrouter/free',
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OPENROUTER_API_KEY not set' });

    const { question, context } = (req.body ?? {}) as { question?: string; context?: any };
    if (!question || !context) return res.status(400).json({ error: 'question and context required' });

    const userPrompt = `CONTEXT (JSON):\n${JSON.stringify(context, null, 2)}\n\nQUESTION: ${question}`;
    const start = Date.now();

    // Try each model in order. Use the first that returns real content.
    for (const model of MODEL_CHAIN) {
        try {
            const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://chesstown.app',
                    'X-Title': 'Chesstown Coach',
                },
                body: JSON.stringify({
                    model,
                    stream: true,
                    temperature: 0.4,
                    max_tokens: 400,
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: userPrompt },
                    ],
                }),
            });

            if (!r.ok || !r.body) continue;

            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Model', model);

            // Parse SSE stream, extract only real content, drop reasoning
            const reader = r.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let totalContent = '';
            let totalReasoning = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';
                for (const line of lines) {
                    if (!line.startsWith('data:')) continue;
                    const payload = line.slice(5).trim();
                    if (payload === '[DONE]') {
                        // If the model returned nothing but reasoning, try next model
                        if (!totalContent.trim() && totalReasoning.trim()) {
                            res.removeHeader('Content-Type');
                            res.setHeader('Content-Type', 'text/event-stream');
                            res.write(`: reasoning-only\n\n`);
                            res.end();
                            return;
                        }
                        res.write('data: [DONE]\n\n');
                        res.end();
                        console.log(`coach OK model=${model} content=${totalContent.length} reasoning=${totalReasoning.length} time=${Date.now() - start}ms`);
                        return;
                    }
                    try {
                        const obj = JSON.parse(payload);
                        const choice = obj.choices?.[0];
                        const delta = choice?.delta ?? {};
                        // OpenAI-compatible models: content
                        if (typeof delta.content === 'string' && delta.content) {
                            totalContent += delta.content;
                            res.write(`data: ${JSON.stringify({ content: delta.content })}\n\n`);
                        }
                        // Some models (Cohere): reasoning_details, no content
                        if (Array.isArray(delta.reasoning_details)) {
                            for (const r of delta.reasoning_details) {
                                if (typeof r.text === 'string') totalReasoning += r.text;
                            }
                        }
                    } catch { /* ignore malformed line */ }
                }
            }
            return;
        } catch (e: any) {
            console.error(`coach failed for model=${model}`, e.message);
            continue;
        }
    }

    return res.status(502).json({ error: 'all models failed' });
}
