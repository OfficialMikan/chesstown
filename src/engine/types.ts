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
    loss: number;          // centipawn loss from mover's perspective
    classification: Classification;
    bestSanBefore: string | null;
    playedSan: string;
    isUserMove: boolean;
};

export type EngineModelId = 'sf18_05' | 'sf16_00' | 'sf11_00' | 'sf10_02' | 'sf9_00';

export type EngineModel = {
    id: EngineModelId;
    label: string;
    format: 'wasm' | 'asmjs';
    jsUrl: string;
    wasmUrl: string | null;
    maxDepth: number;
    defaults: {
        hashMB: number;
        moveOverhead?: number;
        slowMover?: number;
        skillLevel?: number;
        limitStrength?: boolean;
        elo?: number;
        showWDL?: boolean;
        contempt?: number;
        minThinkTime: number;
    };
    caps: {
        hasHash: boolean;
        hasMoveOverhead: boolean;
        hasSlowMover: boolean;
        hasSkillLevel: boolean;
        hasNNUE: boolean;
        hasWDL: boolean;
        hasContempt: boolean;
        hasMinThink: boolean;
    };
};
