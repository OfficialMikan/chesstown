export type Score = { type: 'cp'; value: number } | { type: 'mate'; value: number } | null;

export type Classification = {
    label: string;
    symbol: string;
    tier: 'brilliant' | 'great' | 'best' | 'good' | 'book' | 'inaccuracy' | 'mistake' | 'blunder';
    color: string;
};

export type PositionInfo = {
    fen: string;
    score: Score;
    cpWhitePov: number;
    bestMoveUci: string | null;
    bestSan: string | null;
    pv: string[];
    depth: number;
    nps: number;
    timeMs: number;
};

export type MoveInfo = {
    ply: number;
    loss: number;
    classification: Classification;
    bestSanBefore: string | null;
    playedSan: string;
    isUserMove: boolean;
};

export type EngineModelId = 'cloud' | 'local';
export type EngineModel = { id: EngineModelId; label: string; maxDepth: number };
