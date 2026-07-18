// ECO code → opening name. Covers the first ~6 plies of each major opening.
// Used to display "Italian Game" / "Sicilian Defense" etc. above the move list.

export type Opening = { eco: string; name: string; pgn: string };

// 60 most common openings. Add more as needed; the matcher falls back to "Unknown Opening"
export const OPENINGS: Opening[] = [
    { eco: 'B20', name: 'Sicilian Defense', pgn: '1. e4 c5' },
    { eco: 'B30', name: 'Sicilian Defense, Old Sicilian', pgn: '1. e4 c5 2. Nf3 Nc6 3. c3' },
    { eco: 'B33', name: 'Sicilian Sveshnikov', pgn: '1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 e5' },
    { eco: 'B90', name: 'Sicilian Najdorf', pgn: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6' },
    { eco: 'B12', name: 'Caro-Kann Defense', pgn: '1. e4 c6' },
    { eco: 'B10', name: 'Caro-Kann Defense', pgn: '1. e4 c6 2. Nc3' },
    { eco: 'C00', name: 'French Defense', pgn: '1. e4 e6' },
    { eco: 'C20', name: 'King\'s Pawn Opening', pgn: '1. e4 e5' },
    { eco: 'C50', name: 'Italian Game', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4' },
    { eco: 'C53', name: 'Italian Game, Classical', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5' },
    { eco: 'C54', name: 'Italian Game, Giuoco Piano', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3' },
    { eco: 'C55', name: 'Italian Game, Two Knights', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6' },
    { eco: 'C57', name: 'Italian Game, Fried Liver', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5' },
    { eco: 'C42', name: 'Petrov\'s Defense', pgn: '1. e4 e5 2. Nf3 Nf6' },
    { eco: 'C45', name: 'Scotch Game', pgn: '1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4' },
    { eco: 'C65', name: 'Ruy López', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5' },
    { eco: 'C70', name: 'Ruy López, Classical', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4' },
    { eco: 'C78', name: 'Ruy López, Closed', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6' },
    { eco: 'C88', name: 'Ruy López, Closed Anti-Berlin', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Bb3' },
    { eco: 'C20', name: 'King\'s Pawn Game', pgn: '1. e4 e5 2. Qh5' },
    { eco: 'B01', name: 'Scandinavian Defense', pgn: '1. e4 d5' },
    { eco: 'B00', name: 'Uncommon King\'s Pawn', pgn: '1. e4' },
    { eco: 'A00', name: 'Uncommon Opening', pgn: '1.' },
    { eco: 'D00', name: 'Queen\'s Pawn Game', pgn: '1. d4 d5' },
    { eco: 'D02', name: 'Queen\'s Pawn Game, London', pgn: '1. d4 d5 2. Nf3' },
    { eco: 'D06', name: 'Queen\'s Gambit', pgn: '1. d4 d5 2. c4' },
    { eco: 'D10', name: 'Queen\'s Gambit Declined, Slav', pgn: '1. d4 d5 2. c4 c6' },
    { eco: 'D30', name: 'Queen\'s Gambit Declined', pgn: '1. d4 d5 2. c4 e6 3. Nc3' },
    { eco: 'D37', name: 'Queen\'s Gambit Declined, Exchange', pgn: '1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. cxd5 exd5' },
    { eco: 'D85', name: 'Grünfeld Defense', pgn: '1. d4 Nf6 2. c4 g6 3. Nc3 d5' },
    { eco: 'E00', name: 'Catalan Opening', pgn: '1. d4 Nf6 2. c4 e6 3. g3' },
    { eco: 'E20', name: 'Nimzo-Indian Defense', pgn: '1. d4 Nf6 2. c4 e6 3. Nc3 Bb4' },
    { eco: 'E32', name: 'Nimzo-Indian, Classical', pgn: '1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2' },
    { eco: 'E60', name: 'King\'s Indian Defense', pgn: '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7' },
    { eco: 'E90', name: 'King\'s Indian, Classical', pgn: '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3' },
    { eco: 'A40', name: 'Modern Defense', pgn: '1. d4 g6' },
    { eco: 'A45', name: 'Queen\'s Pawn, London', pgn: '1. d4 Nf6 2. Nf3' },
    { eco: 'A04', name: 'Réti Opening', pgn: '1. Nf3' },
    { eco: 'A05', name: 'Réti Opening, King\'s Indian Attack', pgn: '1. Nf3 Nf6 2. g3' },
    { eco: 'A10', name: 'English Opening', pgn: '1. c4' },
    { eco: 'A13', name: 'English Opening, Closed', pgn: '1. c4 e6' },
    { eco: 'A30', name: 'English Opening, Symmetrical', pgn: '1. c4 c5' },
    { eco: 'A40', name: 'Modern Defense', pgn: '1. d4 g6 2. c4 Bg7' },
    { eco: 'B07', name: 'Pirc Defense', pgn: '1. e4 d6 2. d4 Nf6 3. Nc3 g6' },
    { eco: 'B22', name: 'Sicilian, Alapin', pgn: '1. e4 c5 2. c3' },
    { eco: 'B23', name: 'Sicilian, Closed', pgn: '1. e4 c5 2. Nc3' },
    { eco: 'B40', name: 'Sicilian Defense', pgn: '1. e4 c5 2. Nf3 e6' },
    { eco: 'B50', name: 'Sicilian Defense', pgn: '1. e4 c5 2. Nf3 d6' },
    { eco: 'B70', name: 'Sicilian Defense, Dragon', pgn: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6' },
    { eco: 'C00', name: 'French Defense', pgn: '1. e4 e6 2. d4 d5' },
    { eco: 'C01', name: 'French Defense, Exchange', pgn: '1. e4 e6 2. d4 d5 3. exd5' },
    { eco: 'C02', name: 'French Defense, Advance', pgn: '1. e4 e6 2. d4 d5 3. e5' },
    { eco: 'C11', name: 'French Defense, Classical', pgn: '1. e4 e6 2. d4 d5 3. Nc3 Nf6' },
    { eco: 'C15', name: 'French Defense, Winawer', pgn: '1. e4 e6 2. d4 d5 3. Nc3 Bb4' },
    { eco: 'C19', name: 'French Defense, Winawer, Poisoned Pawn', pgn: '1. e4 e6 2. d4 d5 3. Nc3 Bb4 4. e5 c5 5. a3 Bxc3+ 6. bxc3 Ne7 7. Qg4' },
    { eco: 'D50', name: 'Queen\'s Gambit Declined', pgn: '1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5' },
    { eco: 'C10', name: 'French Defense, Rubinstein', pgn: '1. e4 e6 2. d4 d5 3. Nc3 dxe4' },
    { eco: 'C41', name: 'Philidor Defense', pgn: '1. e4 e5 2. Nf3 d6' },
    { eco: 'A46', name: 'Queen\'s Pawn, London System', pgn: '1. d4 Nf6 2. Nf3 e6 3. Bf4' },
];

// Detect the opening from a PGN. Returns the longest matching prefix.
export function detectOpening(sanMoves: string[]): Opening | null {
    if (sanMoves.length === 0) return null;
    // Normalize: strip move numbers, "..." annotations
    const tokens: string[] = [];
    const re = /\d+\.(\.\.)?/g;
    for (const m of sanMoves.join(' ').replace(re, '').trim().split(/\s+/)) {
        if (!m) continue;
        if (m === '1-0' || m === '0-1' || m === '1/2-1/2' || m === '*') continue;
        tokens.push(m);
    }

    let best: Opening | null = null;
    let bestLen = 0;
    for (const op of OPENINGS) {
        // Compare first N plies of this opening's pgn against the game's tokens
        const opTokens: string[] = [];
        const opRe = /\d+\.(\.\.)?/g;
        for (const m of op.pgn.replace(opRe, '').trim().split(/\s+/)) {
            if (m) opTokens.push(m);
        }
        let matchLen = 0;
        for (let i = 0; i < Math.min(opTokens.length, tokens.length); i++) {
            if (opTokens[i] === tokens[i]) matchLen = i + 1;
            else break;
        }
        if (matchLen > bestLen) {
            bestLen = matchLen;
            best = op;
        }
    }
    return bestLen >= 2 ? best : null; // require at least 2 plies match
}
