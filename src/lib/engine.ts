import type { PositionInfo } from './types';

export type AnalyzeResponse = {
    fen: string;
    depth: number;
    bestMove: string | null;
    pv: string[];
    cp: number | null;       // raw engine centipawns, white POV (signed)
    mate: number | null;
    cpWhitePov: number;      // from the perspective of the side to move (signed)
    nps: number;
    timeMs: number;
    source: string;
};

const FEN_TO_RESULT = new Map<string, Promise<AnalyzeResponse | null>>();
const INFLIGHT = new Set<string>();

export async function analyzeFen(fen: string, depth = 16): Promise<AnalyzeResponse | null> {
    const key = `${depth}:${fen}`;
    const cached = FEN_TO_RESULT.get(key);
    if (cached) return cached;
    if (INFLIGHT.has(key)) return null;
    INFLIGHT.add(key);
    const p = (async () => {
        try {
            const r = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fen, depth }),
            });
            if (!r.ok) {
                console.error('analyze HTTP', r.status, await r.text().catch(() => ''));
                return null;
            }
            const j = (await r.json()) as Omit<AnalyzeResponse, 'cpWhitePov'>;
            if (!j.bestMove) return null;
            const wtm = j.fen.split(' ')[1] === 'w';
            let cpWhitePov = 0;
            if (j.mate !== null) {
                cpWhitePov = wtm
                    ? (j.mate >= 0 ? 100000 - j.mate : -100000 - j.mate)
                    : (j.mate >= 0 ? -100000 + j.mate : 100000 + j.mate);
            } else if (j.cp !== null) {
                cpWhitePov = wtm ? j.cp : -j.cp;
            }
            const full: AnalyzeResponse = { ...j, cpWhitePov };
            FEN_TO_RESULT.set(key, Promise.resolve(full));
            return full;
        } catch (e: any) {
            console.error('analyze fetch failed', e);
            return null;
        } finally {
            INFLIGHT.delete(key);
        }
    })();
    FEN_TO_RESULT.set(key, p);
    return p;
}

export function clearAnalysisCache() {
    FEN_TO_RESULT.clear();
    INFLIGHT.clear();
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
                const r = await analyzeFen(fens[i], depth);
                if (r) results[i] = r;
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
    return {
        fen,
        score: r.mate !== null ? { type: 'mate', value: r.mate } : (r.cp !== null ? { type: 'cp', value: r.cp } : null),
        cpWhitePov: r.cpWhitePov,
        bestMoveUci: r.bestMove,
        bestSan: null,
        pv: r.pv,
        depth: r.depth,
        nps: r.nps,
        timeMs: r.timeMs,
    };
}
