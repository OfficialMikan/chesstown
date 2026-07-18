// Vercel serverless Stockfish wrapper. Hits Lichess's public cloud eval API
// (real Stockfish, no auth, no key, free). Falls back to stockfish.online if
// Lichess rate-limits us.

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
};

async function callLichess(fen: string, depth: number, multiPv: number): Promise<EngineResult | null> {
    const t0 = Date.now();
    try {
        const r = await fetch('https://lichess.org/api/cloud-eval', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fen, multiPv }),
            signal: AbortSignal.timeout(20000),
        });
        if (!r.ok) return null;
        const j: any = await r.json();
        if (!j || typeof j.fen !== 'string') return null;
        const pvs: any[] = j.pvs || [];
        const top: any = pvs[0];
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
        };
    } catch {
        return null;
    }
}

async function callStockfishOnline(fen: string, depth: number): Promise<EngineResult | null> {
    const t0 = Date.now();
    try {
        const url = `https://stockfish.online/api/s/v2.php?fen=${encodeURIComponent(fen)}&depth=${Math.min(depth, 18)}`;
        const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
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
        };
    } catch {
        return null;
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const { fen, depth = 16, multiPv = 1 } = (req.body ?? {}) as { fen?: string; depth?: number; multiPv?: number };
    if (!fen || typeof fen !== 'string') return res.status(400).json({ error: 'fen required' });

    const clampedDepth = Math.min(Math.max(depth, 6), 22);

    // Try Lichess first, then stockfish.online
    let result = await callLichess(fen, clampedDepth, multiPv);
    if (!result) result = await callStockfishOnline(fen, clampedDepth);

    if (!result) return res.status(502).json({ error: 'all engines failed', fen });

    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.setHeader('X-Engine', result.nps ? 'lichess' : 'stockfish.online');
    return res.status(200).json(result);
}
