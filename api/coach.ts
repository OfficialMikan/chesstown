// Vercel serverless function. Streams from OpenRouter.
//
// Default model: `openrouter/free` — the meta-router that picks among the
// best currently-available free models (DeepSeek R1, Llama 3.3 70B, Qwen2.5
// 72B, Gemini 2.0 Flash, etc). Set COACH_MODEL in your Vercel env to pin
// a specific one if you want determinism.

import type { VercelRequest, VercelResponse } from '@vercel/node';

const SYSTEM_PROMPT = `You are an expert, friendly chess coach helping a player review a finished game.

INPUTS YOU WILL RECEIVE (JSON):
- ply: which move number the user is currently looking at
- fen: the current position in FEN
- evalCp: centipawn evaluation from White's perspective (positive = White better)
- scoreCp / mate: raw engine score, or forced-mate value
- bestMoveSan: the engine's top choice in Standard Algebraic Notation
- pv: the engine's principal variation as a list of SAN moves
- lastMove: { san, info: { loss, classification, bestSanBefore, playedSan } } if the user just played a move
- recentMoves: array of {ply, san, color, loss, classification, bestSanBefore} for the last 12 plies
- userSide: 'white' or 'black'

RULES:
1. Use ONLY the data above. Do not invent moves, threats, or evaluations. If bestMoveSan is null, say so.
2. Be concise: 2-4 short sentences. No headers. Plain text. Use **bold** for emphasis.
3. When explaining a mistake, name the specific move played, the specific better move (bestMoveSan), and what the position now looks like. Do not say "you should have done something" without naming it.
4. When asked for a plan, look at the engine's PV and explain the strategic idea (1 sentence).
5. For opening questions, talk about the position's structure, not the engine line.
6. Never begin with "I" — start with the move or the concept.
7. Acknowledge when a move is good or excellent; do not invent praise for blunders.

EXAMPLES:
- Move 18. e4. Eval: -2.50. Classification: Blunder (320cp). Best: Nxe4. PV: ["Nxe4","dxe4","Qxd6"]
- "**e4** hangs the knight on d4. After **Nxe4 dxe4 Qxd6** you're down a queen for two minor pieces with no compensation."

Return your answer as plain text. Do not wrap in JSON.`;

const DEFAULT_MODEL = 'openrouter/free';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.COACH_MODEL || DEFAULT_MODEL;

    if (!apiKey) {
        return res.status(500).json({ error: 'OPENROUTER_API_KEY not set on server' });
    }

    const { question, context, signal } = req.body ?? {};
    if (!question || !context) return res.status(400).json({ error: 'question and context required' });

    const userPrompt = `CONTEXT (JSON):
${JSON.stringify(context, null, 2)}

QUESTION: ${question}`;

    const start = Date.now();
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
                max_tokens: 500,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt },
                ],
            }),
        });

        if (!r.ok || !r.body) {
            const text = await r.text();
            console.error('upstream error', r.status, text);
            return res.status(502).json({ error: 'upstream', status: r.status, detail: text.slice(0, 500) });
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Model', model);

        const reader = r.body.getReader();
        const decoder = new TextDecoder();
        let totalChars = 0;
        let firstByte = 0;
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (!firstByte) firstByte = Date.now() - start;
            const chunk = decoder.decode(value, { stream: true });
            totalChars += chunk.length;
            res.write(chunk);
        }
        res.end();
        console.log(`coach stream done: model=${model} ttfb=${firstByte}ms total=${Date.now() - start}ms chars=${totalChars}`);
    } catch (err: any) {
        console.error('coach handler error', err);
        res.status(500).json({ error: err?.message ?? 'unknown' });
    }
}
