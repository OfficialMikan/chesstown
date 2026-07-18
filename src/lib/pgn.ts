// PGN parsing utilities. Wraps chess.js v1.x and provides a flat list of
// moves with FEN snapshots and parsed headers. chess.js v1 changed load_pgn
// → loadPgn and returns `this`, so we treat it as void and check history().

import { Chess } from 'chess.js';

export type ParsedMove = {
    ply: number;            // 1-indexed; 1 = first move
    moveNumber: number;     // 1-indexed; 1 = first pair
    color: 'w' | 'b';
    san: string;            // Standard Algebraic Notation
    uci: string;            // UCI representation (from + to + promotion)
    from: string;
    to: string;
    fenBefore: string;
    fenAfter: string;
    piece: string;          // moved piece letter, e.g. 'N' for knight
    captured?: string;
    promotion?: string;
    flags: string;
};

export type ParsedPgn = {
    headers: Record<string, string>;
    moves: ParsedMove[];
    result: string;         // '1-0' | '0-1' | '1/2-1/2' | '*'
    initialFen: string;
};

export const STANDARD_STARTING = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function safeChess(fen?: string): Chess {
    if (typeof Chess !== 'function') {
        throw new Error('chess.js failed to load (no Chess constructor)');
    }
    return fen ? new Chess(fen) : new Chess();
}

export function parsePgnHeaders(pgn: string): Record<string, string> {
    const out: Record<string, string> = {};
    const clean = pgn.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const re = /^\[(\w+)\s+"([^"]*)"\]\s*$/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(clean))) out[m[1]] = m[2];
    return out;
}

export function buildMovesFromPgn(pgn: string): ParsedMove[] {
    const cleaned = pgn
        .replace(/^\uFEFF/, '')
        .replace(/\r\n?/g, '\n')
        .replace(/\{[^}]*\}/g, '')
        .replace(/;[^}\n]*/g, '')
        .replace(/\$\d+/g, '');

    const loader = safeChess();
    try {
        loader.loadPgn(cleaned, { strict: false });
    } catch {
        throw new Error("Couldn't parse this game's moves.");
    }
    if (loader.history().length === 0) {
        throw new Error("This PGN has no moves.");
    }

    const verbose = loader.history({ verbose: true });
    const replay = safeChess();
    const moves: ParsedMove[] = [];

    for (let i = 0; i < verbose.length; i++) {
        const mv = verbose[i];
        const fenBefore = replay.fen();
        const applied = replay.move(mv.san);
        const fenAfter = replay.fen();
        moves.push({
            ply: i + 1,
            moveNumber: Math.floor(i / 2) + 1,
            color: (mv.color as 'w' | 'b'),
            san: applied?.san ?? mv.san,
            uci: mv.from + mv.to + (mv.promotion ?? ''),
            from: mv.from,
            to: mv.to,
            fenBefore,
            fenAfter,
            piece: mv.piece.toUpperCase(),
            captured: mv.captured ?? undefined,
            promotion: mv.promotion ?? undefined,
            flags: mv.flags,
        });
    }
    return moves;
}

export function parsePgn(pgn: string): ParsedPgn {
    const headers = parsePgnHeaders(pgn);
    const moves = buildMovesFromPgn(pgn);
    const result = headers.Result || '*';
    const initialFen = headers.FEN || STANDARD_STARTING;
    return { headers, moves, result, initialFen };
}

export function extractSanSequence(pgn: string): string {
    return pgn
        .replace(/\{[^}]*\}/g, '')
        .replace(/\[.*?\]\s*/g, '')
        .replace(/\$\d+/g, '')
        .replace(/\d+\.(\.\.)?/g, '')
        .replace(/[01]-[01]|\*|1\/2-1\/2/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
