// Client-side engine client. Hits the Vercel serverless function at /api/analyze.
// The serverless function calls a public cloud Stockfish API.

import type { PositionInfo } from '../lib/types';

export type { PositionInfo } from './types';

export type AnalyzeRequest = { fen: string; depth?: number; multiPv?: number };
export type AnalyzeResponse = {
    fen: string;
    depth: number;
    bestMove: string | null;
    pv: string[];
    cp: number | null;
    mate: number | null;
    nps: number;
    timeMs: number;
};

const FEN_TO_RESULT = new Map<string, Promise<AnalyzeResponse>>();

export async function analyzeFen(fen: string, depth = 16): Promise<AnalyzeResponse> {
    const cacheKey = `${depth}:${fen}`;
    let p = FEN_TO_RESULT.get(cacheKey);
    if (p) return p;
    p = (async () => {
        const r = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fen, depth }),
        });
        if (!r.ok) throw new Error('analyze failed: ' + r.status);
        return r.json() as Promise<AnalyzeResponse>;
    })();
    FEN_TO_RESULT.set(cacheKey, p);
    return p;
}

export function analyzeAll(
    fens: string[],
    depth: number,
    onProgress?: (done: number, total: number) => void,
    concurrency = 6
): Promise<AnalyzeResponse[]> {
    const results: (AnalyzeResponse | null)[] = new Array(fens.length).fill(null);
    let next = 0;
    let done = 0;

    return new Promise((resolve) => {
        const worker = async () => {
            while (true) {
                const i = next++;
                if (i >= fens.length) return;
                try {
                    results[i] = await analyzeFen(fens[i], depth);
                } catch {
                    results[i] = null;
                }
                done++;
                onProgress?.(done, fens.length);
            }
        };
        const n = Math.max(1, Math.min(8, concurrency));
        const workers = Array.from({ length: n }, () => worker());
        Promise.all(workers).then(() => resolve(results.filter(Boolean) as AnalyzeResponse[]));
    });
}

export function toPositionInfo(r: AnalyzeResponse, fen: string): PositionInfo {
    const wtm = fen.split(' ')[1] === 'w';
    let cpWhitePov = 0;
    if (r.mate !== null) {
        cpWhitePov = wtm
            ? (r.mate >= 0 ? 100000 - r.mate : -100000 - r.mate)
            : (r.mate >= 0 ? -100000 + r.mate : 100000 + r.mate);
    } else if (r.cp !== null) {
        cpWhitePov = wtm ? r.cp : -r.cp;
    }
    return {
        fen,
        score: r.mate !== null ? { type: 'mate', value: r.mate } : (r.cp !== null ? { type: 'cp', value: r.cp } : null),
        cpWhitePov,
        bestMoveUci: r.bestMove,
        bestSan: null,
        pv: r.pv,
        depth: r.depth,
        nps: r.nps,
        timeMs: r.timeMs,
    };
}
