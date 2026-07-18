// Move suggestion and threat detection. Uses chess.js to enumerate legal
// moves and the engine output to find candidate plays and opponent threats.

import { createChess } from './chess';
import type { PositionInfo } from './types';

export type Suggestion = {
    san: string;
    uci: string;
    evalCp: number;       // evaluation if THIS move is played
    deltaCp: number;      // how much better/worse than current
    pv: string[];         // continuation
    classification: 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder' | 'mate';
};

export type Threat = {
    san: string;
    uci: string;
    target: string | null;     // square being attacked, if any
    type: 'capture' | 'check' | 'mate' | 'fork' | 'pin' | 'attack';
    description: string;
};

export function enumerateLegalMoves(fen: string): { san: string; uci: string; fenAfter: string }[] {
    const c = createChess(fen);
    return c.moves({ verbose: true }).map(m => ({
        san: m.san,
        uci: m.from + m.to + (m.promotion ?? ''),
        fenAfter: c.fen(),
    }));
}

/** Compute suggestions by asking the engine for each legal move (or use top PV). */
export async function buildSuggestions(
    fen: string,
    currentEvalCp: number,
    evaluateFen: (fen: string) => Promise<PositionInfo | null>,
    concurrency = 4
): Promise<Suggestion[]> {
    const moves = enumerateLegalMoves(fen);
    if (!moves.length) return [];
    const out: (Suggestion | null)[] = new Array(moves.length).fill(null);
    let i = 0;
    const workers = Array.from({ length: Math.min(concurrency, moves.length) }, async () => {
        while (true) {
            const idx = i++;
            if (idx >= moves.length) return;
            const m = moves[idx];
            const info = await evaluateFen(m.fenAfter);
            if (!info) { out[idx] = null; continue; }
            const wtm = fen.split(' ')[1] === 'w';
            const evalCp = wtm ? info.cpWhitePov : -info.cpWhitePov;
            const deltaCp = wtm ? evalCp - currentEvalCp : currentEvalCp - evalCp;
            out[idx] = {
                san: m.san,
                uci: m.uci,
                evalCp,
                deltaCp,
                pv: info.pv,
                classification: classifySuggestion(deltaCp, info.score?.type === 'mate'),
            };
        }
    });
    await Promise.all(workers);
    return out.filter((s): s is Suggestion => s !== null).sort((a, b) => b.deltaCp - a.deltaCp);
}

function classifySuggestion(deltaCp: number, isMate: boolean): Suggestion['classification'] {
    if (isMate) return 'mate';
    if (deltaCp >= 300) return 'best';
    if (deltaCp >= -50) return 'good';
    if (deltaCp >= -150) return 'inaccuracy';
    if (deltaCp >= -300) return 'mistake';
    return 'blunder';
}

/** Detect opponent threats: things the opponent can do that hurt us. */
export function detectThreats(fen: string): Threat[] {
    const c = createChess(fen);
    const moves = c.moves({ verbose: true });
    const threats: Threat[] = [];

    // Captures of our highest-value pieces
    const pieceValue: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    const captures = moves
        .filter(m => m.captured)
        .map(m => ({ m, value: pieceValue[m.captured!] || 0 }))
        .sort((a, b) => b.value - a.value);

    for (const { m } of captures.slice(0, 3)) {
        const target = c.get(m.to as any);
        threats.push({
            san: m.san,
            uci: m.from + m.to + (m.promotion ?? ''),
            target: m.to,
            type: 'capture',
            description: `Captures your ${m.captured === 'p' ? 'pawn' : m.captured.toUpperCase()} on ${m.to}`,
        });
    }

    // Checks
    const checks = moves.filter(m => m.san.endsWith('+') || m.san.endsWith('#'));
    for (const m of checks.slice(0, 2)) {
        threats.push({
            san: m.san,
            uci: m.from + m.to + (m.promotion ?? ''),
            target: null,
            type: m.san.endsWith('#') ? 'mate' : 'check',
            description: m.san.endsWith('#') ? 'Forced mate' : `Gives check on ${m.to}`,
        });
    }

    return threats;
}
