import { Chess } from 'chess.js';
import type { Classification } from '../engine/types';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const PIECE_LOOKUP: Record<string, string> = {
    K: 'K', Q: 'Q', R: 'R', B: 'B', N: 'N', P: 'P', k: 'K', q: 'Q', r: 'R', b: 'B', n: 'N', p: 'P'
};

export const createChess = (fen?: string) => fen ? new Chess(fen) : new Chess();

export function fenToBoard(fen: string): (string | null)[][] {
    const rows = fen.split(' ')[0].split('/');
    return rows.map(row => {
        const r: (string | null)[] = [];
        for (const c of row) {
            if (/\d/.test(c)) for (let i = 0; i < +c; i++) r.push(null);
            else r.push(c);
        }
        return r;
    });
}

export function squareToRowCol(sq: string) {
    return { row: 7 - (+sq[1] - 1), col: sq.charCodeAt(0) - 97 };
}

export function scoreToCp(score: { type: 'cp' | 'mate'; value: number } | null): number {
    if (!score) return 0;
    if (score.type === 'cp') return score.value;
    return score.value >= 0 ? 100000 - score.value : -100000 - score.value;
}

export function uciToSan(fen: string, uci: string): string | null {
    if (!uci || uci.length < 4) return null;
    try {
        const c = createChess(fen);
        const from = uci.slice(0, 2), to = uci.slice(2, 4);
        const promotion = uci.length > 4 ? uci[4].toLowerCase() : undefined;
        const m = c.move({ from, to, promotion });
        return m?.san ?? null;
    } catch { return null; }
}

/** 7-tier classification following wintrchess/Chess.com conventions. */
export function classify(loss: number, isMate: boolean): Classification {
    if (isMate) return { label: 'Forced Mate', symbol: '', tier: 'best', color: 'var(--brilliant)' };
    if (loss <= 5) return { label: 'Best', symbol: '', tier: 'best', color: 'var(--accent-2)' };
    if (loss <= 20) return { label: 'Excellent', symbol: '', tier: 'great', color: 'var(--great)' };
    if (loss <= 50) return { label: 'Good', symbol: '', tier: 'good', color: 'var(--good)' };
    if (loss <= 100) return { label: 'Inaccuracy', symbol: '?!', tier: 'inaccuracy', color: 'var(--inaccuracy)' };
    if (loss <= 200) return { label: 'Mistake', symbol: '?', tier: 'mistake', color: 'var(--mistake)' };
    return { label: 'Blunder', symbol: '??', tier: 'blunder', color: 'var(--blunder)' };
}

export function formatEval(p: { fen: string; score: { type: 'cp' | 'mate'; value: number } | null; cpWhitePov: number } | null | undefined): string {
    if (!p || !p.score) return '—';
    if (p.score.type === 'mate') {
        const wtm = p.fen.split(' ')[1] === 'w';
        const v = wtm ? p.score.value : -p.score.value;
        return (v > 0 ? '#' : '#-') + Math.abs(v);
    }
    return (p.cpWhitePov >= 0 ? '+' : '') + (p.cpWhitePov / 100).toFixed(2);
}

export function parsePgnHeaders(pgn: string): Record<string, string> {
    const out: Record<string, string> = {};
    const re = /\[(\w+)\s+"([^"]*)"\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(pgn))) out[m[1]] = m[2];
    return out;
}

export function buildMovesFromPgn(pgn: string) {
    const cleaned = pgn.replace(/\{[^}]*\}/g, '').replace(/\$\d+/g, '');
    const loader = createChess();
    if (!loader.loadPgn(cleaned, { strict: false })) {
        throw new Error("Couldn't parse this game's moves.");
    }
    const verbose = loader.history({ verbose: true });
    const replay = createChess();
    const moves = verbose.map((mv, i) => {
        const fenBefore = replay.fen();
        const applied = replay.move(mv.san);
        const fenAfter = replay.fen();
        return {
            ply: i + 1,
            moveNumber: Math.floor(i / 2) + 1,
            color: mv.color as 'w' | 'b',
            san: applied?.san ?? mv.san,
            from: applied?.from ?? null,
            to: applied?.to ?? null,
            fenBefore,
            fenAfter,
        };
    });
    return moves;
}
