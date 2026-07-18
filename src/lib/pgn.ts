// PGN parsing utilities. Wraps chess.js v1.x with a safe fallback for the
// legacy global constructor, then extracts a flat list of moves with FEN
// snapshots and a parsed headers dict.

import { Chess } from 'chess.js';

export type ParsedMove = {
    ply: number;            // 1-indexed; 1 = first move
    moveNumber: number;     // 1-indexed; 1 = first pair
    color: 'w' | 'b';
    san: string;            // Standard Algebraic Notation
    uci: string;            // UCI representation
    from: string;           // origin square
    to: string;             // destination square
    fenBefore: string;
    fenAfter: string;
    piece: string;          // moved piece letter, e.g. 'N' for knight
    captured?: string;      // piece captured, if any
    promotion?: string;     // 'q', 'r', 'b', 'n'
    flags: string;          // chess.js flags string
    nag?: number[];         // numeric annotation glyphs (! ?, ??, etc.)
};

export type ParsedPgn = {
    headers: Record<string, string>;
    moves: ParsedMove[];
    result: string;         // '1-0' | '0-1' | '1/2-1/2' | '*'
    initialFen: string;
};

const STANDARD_STARTING = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function safeChess(fen?: string): Chess {
    if (typeof Chess !== 'function') {
        throw new Error('chess.js failed to load (no Chess constructor)');
    }
    return fen ? new Chess(fen) : new Chess();
}

export function parsePgnHeaders(pgn: string): Record<string, string> {
    const out: Record<string, string> = {};
    // Strip BOM, normalize line endings
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
        // strip comments and NAGs but keep move text
        .replace(/\{[^}]*\}/g, '')
        .replace(/;[^}\n]*/g, '')
        .replace(/\$\d+/g, '');

    const loader = safeChess();
    const ok = loader.loadPgn(cleaned, { strict: false });
    if (!ok) throw new Error("Couldn't parse this game's moves.");

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

/**
 * Extract a SAN sequence (e.g. "1. e4 e5 2. Nf3 Nc6") from arbitrary PGN-like
 * text. Used to validate the user pasted something reasonable.
 */
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
