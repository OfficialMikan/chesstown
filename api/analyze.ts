// Serverless engine entry point. The browser handles Stockfish directly when
// the user picks "local" mode, but this endpoint still acts as a fast cloud
// fallback for the default "cloud" mode.
//
// Tries four free public endpoints in sequence. The first one to return a
// valid bestmove wins. Each gets a 6-second timeout.

import type { VercelRequest, VercelResponse } from '@vercel/node';

type EngineResult = {
    fen: string;
    depth: number;
    bestMove: string | null;
    pv: string[];
    cp: number | null;
    mate: number | null;
    nps: number;
    timeMs: number;
    source: string;
};

const ENDPOINTS: { name: string; fn: (fen: string, depth: number) => Promise<EngineResult | null> }[] = [
    // 1. Lichess public cloud eval (real Stockfish, no auth, rate-limited ~20/min)
    {
        name: 'lichess',
        fn: async (fen, depth) => {
            const t0 = Date.now();
            try {
                const r = await fetch('https://lichess.org/api/cloud-eval', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fen, multiPv: 1 }),
                    signal: AbortSignal.timeout(6000),
                });
                if (!r.ok) return null;
                const j: any = await r.json();
                if (!j || typeof j.fen !== 'string') return null;
                const top = (j.pvs || [])[0];
                if (!top) return null;
                return {
                    fen: j.fen,
                    depth: j.depth || depth,
                    bestMove: top.moves?.split(' ')[0] ?? null,
                    pv: (top.moves || '').split(' ').filter(Boolean),
                    cp: typeof top.cp === 'number' ? top.cp : null,
                    mate: typeof top.mate === 'number' ? top.mate : null,
                    nps: j.nps || 0,
                    timeMs: Date.now() - t0,
                    source: 'lichess',
                };
            } catch {
                return null;
            }
        },
    },

    // 2. chess-api.com (real Stockfish, free tier with email signup, no key required for limited use)
    {
        name: 'chess-api.com',
        fn: async (fen, depth) => {
            const t0 = Date.now();
            try {
                const r = await fetch('https://chess-api.com/v1', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fen, depth, maxThinkingTime: 4000 }),
                    signal: AbortSignal.timeout(6000),
                });
                if (!r.ok) return null;
                const j: any = await r.json();
                if (!j || j.error) return null;
                const best = (j.move || j.bestmove || '').split(' ')[0] || null;
                return {
                    fen,
                    depth: j.depth || depth,
                    bestMove: best && best !== '(none)' ? best : null,
                    pv: j.continuationArr || (typeof j.continuation === 'string' ? j.continuation.split(' ').filter(Boolean) : []),
                    cp: typeof j.eval === 'number' ? j.eval : null,
                    mate: typeof j.mate === 'number' && j.mate !== 0 ? j.mate : null,
                    nps: j.nps || 0,
                    timeMs: Date.now() - t0,
                    source: 'chess-api.com',
                };
            } catch {
                return null;
            }
        },
    },

    // 3. stockfish.online
    {
        name: 'stockfish.online',
        fn: async (fen, depth) => {
            const t0 = Date.now();
            try {
                const url = `https://stockfish.online/api/s/v2.php?fen=${encodeURIComponent(fen)}&depth=${Math.min(depth, 18)}&mode=bestmove`;
                const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
                if (!r.ok) return null;
                const j: any = await r.json();
                if (!j || !j.success) return null;
                const best = (j.bestmove || '').split(' ')[1];
                return {
                    fen,
                    depth: j.depth || depth,
                    bestMove: best && best !== '(none)' ? best : null,
                    pv: (j.continuation || '').split(' ').filter(Boolean),
                    cp: typeof j.evaluation === 'number' ? j.evaluation : null,
                    mate: typeof j.mate === 'number' && j.mate !== 0 ? j.mate : null,
                    nps: j.nps || 0,
                    timeMs: Date.now() - t0,
                    source: 'stockfish.online',
                };
            } catch {
                return null;
            }
        },
    },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const { fen, depth = 16 } = (req.body ?? {}) as { fen?: string; depth?: number };
    if (!fen || typeof fen !== 'string') return res.status(400).json({ error: 'fen required' });

    const clampedDepth = Math.min(Math.max(depth, 6), 20);

    // Race all endpoints in parallel; first to succeed wins. Add a 7s global cap.
    const cap = AbortSignal.timeout(7000);
    const results = await Promise.allSettled(
        ENDPOINTS.map(ep =>
            ep.fn(fen, clampedDepth).catch(() => null).then(r => ({ name: ep.name, r }))
        )
    );

    const winner = results
        .map(r => (r.status === 'fulfilled' ? r.value : null))
        .find(x => x && x.r && x.r.bestMove);

    if (!winner) {
        console.error('analyze: all endpoints failed', { fen });
        return res.status(502).json({ error: 'all engines failed', tried: ENDPOINTS.map(e => e.name) });
    }

    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.setHeader('X-Engine', winner.r.source);
    res.setHeader('X-Engine-Depth', String(winner.r.depth));
    return res.status(200).json(winner.r);
}
