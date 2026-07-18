import { Chess } from 'chess.js';

export const STANDARD_STARTING = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function parsePgnHeaders(pgn: string): Record<string, string> {
    const out: Record<string, string> = {};
    const re = /^\[(\w+)\s+"([^"]*)"\]\s*$/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(pgn.replace(/\r\n?/g, '\n')))) out[m[1]] = m[2];
    return out;
}

export function buildMovesFromPgn(pgn: string) {
    const cleaned = pgn
        .replace(/\r\n?/g, '\n')
        .replace(/\{[^}]*\}/g, '')
        .replace(/;[^}\n]*/g, '')
        .replace(/\$\d+/g, '');
    const loader = new Chess();
    try { loader.loadPgn(cleaned, { strict: false }); } catch { throw new Error("Couldn't parse this game's moves."); }
    if (loader.history().length === 0) throw new Error('This PGN has no moves.');
    const verbose = loader.history({ verbose: true });
    const replay = new Chess();
    return verbose.map((mv, i) => {
        const fenBefore = replay.fen();
        const applied = replay.move(mv.san);
        const fenAfter = replay.fen();
        return {
            ply: i + 1,
            moveNumber: Math.floor(i / 2) + 1,
            color: mv.color as 'w' | 'b',
            san: applied?.san ?? mv.san,
            from: mv.from,
            to: mv.to,
            fenBefore,
            fenAfter,
        };
    });
}

export function parsePgn(pgn: string) {
    const headers = parsePgnHeaders(pgn);
    const moves = buildMovesFromPgn(pgn);
    return { headers, moves, result: headers.Result || '*', initialFen: headers.FEN || STANDARD_STARTING };
}
