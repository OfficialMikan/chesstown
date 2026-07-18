// Diagnostic endpoint. Tests all engine sources, returns a pass/fail report.
// Used by the in-app DebugPanel "Run full diagnostic" button.

import type { VercelRequest, VercelResponse } from '@vercel/node';

const TEST_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

async function timeIt<T>(fn: () => Promise<T>): Promise<{ ok: boolean; ms: number; result?: T; error?: string }> {
    const t0 = Date.now();
    try {
        const result = await fn();
        return { ok: true, ms: Date.now() - t0, result };
    } catch (e: any) {
        return { ok: false, ms: Date.now() - t0, error: e?.message ?? 'unknown' };
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const report: Record<string, any> = {
        timestamp: new Date().toISOString(),
        fen: TEST_FEN,
        tests: {} as Record<string, any>,
    };

    // Test Lichess
    report.tests.lichess = await timeIt(async () => {
        const r = await fetch('https://lichess.org/api/cloud-eval', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fen: TEST_FEN, multiPv: 1 }),
            signal: AbortSignal.timeout(5000),
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
    });

    // Test chess-api.com
    report.tests.chessApiCom = await timeIt(async () => {
        const r = await fetch('https://chess-api.com/v1', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fen: TEST_FEN, depth: 10, maxThinkingTime: 2000 }),
            signal: AbortSignal.timeout(5000),
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
    });

    // Test stockfish.online
    report.tests.stockfishOnline = await timeIt(async () => {
        const r = await fetch(`https://stockfish.online/api/s/v2.php?fen=${encodeURIComponent(TEST_FEN)}&depth=10&mode=bestmove`, {
            signal: AbortSignal.timeout(5000),
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
    });

    // Test chess.com
    report.tests.chessCom = await timeIt(async () => {
        const r = await fetch('https://api.chess.com/pub/player/hikaru/games/archives');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
    });

    // Test OpenRouter
    const apiKey = process.env.OPENROUTER_API_KEY;
    report.tests.openRouter = apiKey
        ? await timeIt(async () => {
            const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'openrouter/free',
                    messages: [{ role: 'user', content: 'say "ok"' }],
                    max_tokens: 5,
                }),
                signal: AbortSignal.timeout(8000),
            });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        })
        : { ok: false, ms: 0, error: 'OPENROUTER_API_KEY not set' };

    // Summary
    const passed = Object.values(report.tests).filter((t: any) => t.ok).length;
    const total = Object.keys(report.tests).length;
    report.summary = { passed, total, allPassed: passed === total };

    return res.status(200).json(report);
}
