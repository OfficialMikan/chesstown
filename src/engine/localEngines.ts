import type { EngineModel } from './types';

export const LOCAL_ENGINES: EngineModel[] = [
    {
        id: 'sf18_05',
        label: 'Stockfish 18.0.5',
        format: 'wasm',
        jsUrl: 'https://unpkg.com/stockfish@18.0.5/bin/stockfish-18-single.js',
        wasmUrl: 'https://unpkg.com/stockfish@18.0.5/bin/stockfish-18-single.wasm',
        maxDepth: 25,
        caps: { hasHash: true, hasMoveOverhead: true, hasSlowMover: false, hasSkillLevel: true, hasNNUE: true, hasWDL: true, hasContempt: false, hasMinThink: true },
        defaults: { hashMB: 64, moveOverhead: 100, skillLevel: 20, limitStrength: false, elo: 3190, showWDL: false, minThinkTime: 20 },
    },
    {
        id: 'sf16_00',
        label: 'Stockfish 16.0',
        format: 'wasm',
        jsUrl: 'https://unpkg.com/stockfish@16.0.0/src/stockfish-nnue-16-single.js',
        wasmUrl: 'https://unpkg.com/stockfish@16.0.0/src/stockfish-nnue-16-single.wasm',
        maxDepth: 25,
        caps: { hasHash: true, hasMoveOverhead: true, hasSlowMover: false, hasSkillLevel: true, hasNNUE: true, hasWDL: true, hasContempt: false, hasMinThink: true },
        defaults: { hashMB: 64, moveOverhead: 100, skillLevel: 20, limitStrength: false, elo: 3190, showWDL: false, minThinkTime: 20 },
    },
    {
        id: 'sf11_00',
        label: 'Stockfish 11.0',
        format: 'wasm',
        jsUrl: 'https://unpkg.com/stockfish@11.0.0/src/stockfish.js',
        wasmUrl: 'https://unpkg.com/stockfish@11.0.0/src/stockfish.wasm',
        maxDepth: 20,
        caps: { hasHash: true, hasMoveOverhead: false, hasSlowMover: true, hasSkillLevel: true, hasNNUE: false, hasWDL: false, hasContempt: true, hasMinThink: true },
        defaults: { hashMB: 32, slowMover: 100, skillLevel: 20, contempt: 24, minThinkTime: 20 },
    },
    {
        id: 'sf10_02',
        label: 'Stockfish 10.0.2 (asm.js)',
        format: 'asmjs',
        jsUrl: 'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js',
        wasmUrl: null,
        maxDepth: 20,
        caps: { hasHash: true, hasMoveOverhead: false, hasSlowMover: true, hasSkillLevel: true, hasNNUE: false, hasWDL: false, hasContempt: true, hasMinThink: true },
        defaults: { hashMB: 32, slowMover: 100, skillLevel: 20, contempt: 24, minThinkTime: 20 },
    },
    {
        id: 'sf9_00',
        label: 'Stockfish 9.0.0 (asm.js)',
        format: 'asmjs',
        jsUrl: 'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/9.0.0/stockfish.js',
        wasmUrl: null,
        maxDepth: 18,
        caps: { hasHash: true, hasMoveOverhead: false, hasSlowMover: true, hasSkillLevel: true, hasNNUE: false, hasWDL: false, hasContempt: true, hasMinThink: true },
        defaults: { hashMB: 16, slowMover: 100, skillLevel: 20, contempt: 24, minThinkTime: 20 },
    },
];

export const getEngineById = (id: string) =>
    LOCAL_ENGINES.find(e => e.id === id) ?? LOCAL_ENGINES[0];
