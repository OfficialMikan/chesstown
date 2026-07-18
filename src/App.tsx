import { useEffect, useMemo, useRef, useState } from 'react';
import { Board } from './components/Board';
import { ArrowsLayer } from './components/ArrowsLayer';
import { EvalBar } from './components/EvalBar';
import { MoveList } from './components/MoveList';
import { GameGraph } from './components/GameGraph';
import { SummaryCards } from './components/SummaryCards';
import { CoachPanel } from './components/CoachPanel';
import { EngineSettingsModal } from './components/EngineSettingsModal';
import { analyzeAll, toPositionInfo } from './lib/engine';
import { buildMovesFromPgn, classify, formatEval, squareToRowCol, START_FEN, uciToSan } from './lib/chess';
import { logger } from './lib/logger';
import type { EngineModelId, MoveInfo, PositionInfo } from './lib/types';

type Game = {
    headers: Record<string, string>;
    moves: ReturnType<typeof buildMovesFromPgn>;
    userIsWhite: boolean;
};

const ENGINE_MODELS: { id: EngineModelId; label: string; maxDepth: number }[] = [
    { id: 'cloud', label: 'Cloud Stockfish (recommended)', maxDepth: 22 },
    { id: 'sf18_05', label: 'Stockfish 18.0.5 (local, requires WASM)', maxDepth: 25 },
];

export function App() {
    const [username, setUsername] = useState('');
    const [games, setGames] = useState<any[]>([]);
    const [game, setGame] = useState<Game | null>(null);
    const [positions, setPositions] = useState<(PositionInfo | null)[]>([]);
    const [moveInfos, setMoveInfos] = useState<(MoveInfo | null)[]>([]);
    const [currentPly, setCurrentPly] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [status, setStatus] = useState('');
    const [progress, setProgress] = useState(0);
    const [modelId, setModelId] = useState<EngineModelId>('cloud');
    const [showEngineModal, setShowEngineModal] = useState(false);
    const [depth, setDepth] = useState(16);
    const analysisTokenRef = useRef(0);

    // --- chess.com games ---
    const loadGames = async (u: string) => {
        setStatus('Searching chess.com…');
        setGames([]);
        try {
            const r = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(u.toLowerCase())}/games/archives`);
            if (!r.ok) throw new Error(r.status === 404 ? 'not-found' : 'http');
            const { archives } = await r.json();
            if (!archives?.length) { setStatus('No archives found.'); return; }
            const recent = archives.slice(-6).reverse();
            const collected: any[] = [];
            for (const url of recent) {
                const rr = await fetch(url);
                if (!rr.ok) continue;
                const data = await rr.json();
                collected.push(...(data.games || []).filter((g: any) => g.rules === 'chess'));
                if (collected.length >= 20) break;
            }
            collected.sort((a, b) => b.end_time - a.end_time);
            setGames(collected.slice(0, 20));
            setStatus('');
        } catch (e: any) {
            logger.error('loadGames', e.message);
            setStatus(e.message === 'not-found' ? "Couldn't find that username." : "Couldn't reach chess.com.");
        }
    };

    const selectGame = (g: any) => {
        const uname = username.toLowerCase();
        const userIsWhite = g.white.username.toLowerCase() === uname;
        const userIsBlack = g.black.username.toLowerCase() === uname;
        const userIsWhiteFinal = userIsWhite || !userIsBlack;
        try {
            const moves = buildMovesFromPgn(g.pgn);
            setGame({ headers: { White: g.white.username, Black: g.black.username }, moves, userIsWhite: userIsWhiteFinal });
            setFlipped(!userIsWhiteFinal);
            setCurrentPly(0);
            setPositions(new Array(moves.length + 1).fill(null));
            setMoveInfos(new Array(moves.length).fill(null));
            setStatus('Game loaded. Click <b>Analyze</b>.');
        } catch (e: any) {
            logger.error('selectGame', e.message);
            setStatus('PGN parse error: ' + e.message);
        }
    };

    const pastePgn = (pgn: string) => {
        try {
            const moves = buildMovesFromPgn(pgn);
            setGame({ headers: { White: '?', Black: '?' }, moves, userIsWhite: true });
            setFlipped(false);
            setCurrentPly(0);
            setPositions(new Array(moves.length + 1).fill(null));
            setMoveInfos(new Array(moves.length).fill(null));
            setStatus('PGN loaded. Click <b>Analyze</b>.');
        } catch (e: any) {
            logger.error('pastePgn', e.message);
            setStatus('PGN parse error: ' + e.message);
        }
    };

    // --- analysis (cloud engine) ---
    const runAnalysis = async () => {
        const startMs = Date.now();
        if (!game) return;
        const token = ++analysisTokenRef.current;
        setStatus('Analyzing in parallel on the cloud…');
        setProgress(0);
        const fens = [game.moves.length ? game.moves[0].fenBefore : START_FEN, ...game.moves.map(m => m.fenAfter)];
        setPositions(new Array(fens.length).fill(null));
        setMoveInfos(new Array(game.moves.length).fill(null));

        try {
            const results = await analyzeAll(fens, depth, (done, total) => {
                if (token === analysisTokenRef.current) setProgress(Math.round((done / total) * 100));
            });

            if (token !== analysisTokenRef.current) return;
            if (!results || results.length === 0) {
                setStatus('Analysis returned no results. Click 🔧 debug to see why.');
                logger.error('analysis', 'no results returned', { fens: fens.length, depth });
                return;
            }

            const infos: PositionInfo[] = results.map((r, i) => {
                const pi = toPositionInfo(r, fens[i]);
                pi.bestSan = pi.bestMoveUci ? uciToSan(fens[i], pi.bestMoveUci) : null;
                return pi;
            });
            setPositions(infos);

            const mi: (MoveInfo | null)[] = new Array(game.moves.length).fill(null);
            for (let i = 1; i < infos.length; i++) {
                const before = infos[i - 1];
                const after = infos[i];
                const moveIdx = i - 1;
                const mover = game.moves[moveIdx].color;
                const loss = mover === 'w' ? Math.max(0, before.cpWhitePov - after.cpWhitePov) : Math.max(0, after.cpWhitePov - before.cpWhitePov);
                mi[moveIdx] = {
                    ply: moveIdx + 1,
                    loss,
                    classification: classify(loss, after.score?.type === 'mate'),
                    bestSanBefore: before.bestSan,
                    playedSan: game.moves[moveIdx].san,
                    isUserMove: game.userIsWhite === (mover === 'w'),
                };
            }
            setMoveInfos(mi);
            setStatus(`Analysis complete — ${infos.length} positions evaluated.`);
            setProgress(100);
            logger.info('analysis', `done: ${infos.length} positions in ~${Date.now() - startMs}ms`, { depth });
        } catch (e: any) {
            logger.error('analysis', e.message, { stack: e.stack });
            setStatus('Analysis failed: ' + e.message);
        }

    };

    // Keyboard navigation
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!game) return;
            const tag = (e.target as HTMLElement)?.tagName || '';
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            if (e.key === 'ArrowLeft') setCurrentPly(p => Math.max(0, p - 1));
            if (e.key === 'ArrowRight') setCurrentPly(p => Math.min(game.moves.length, p + 1));
            if (e.key === 'ArrowUp') setCurrentPly(0);
            if (e.key === 'ArrowDown') setCurrentPly(game.moves.length);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [game]);

    const curPos = positions[currentPly] ?? null;
    const lastMove = useMemo(() => {
        if (!game || currentPly === 0) return null;
        const mv = game.moves[currentPly - 1];
        if (!mv.from || !mv.to) return null;
        const a = squareToRowCol(mv.from), b = squareToRowCol(mv.to);
        return { fromRow: a.row, fromCol: a.col, toRow: b.row, toCol: b.col };
    }, [game, currentPly]);

    const detail = (() => {
        if (!game) return null;
        if (currentPly === 0) {
            return <div><div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>Starting position</div><div style={{ color: 'var(--text-dim)' }}>{curPos ? `eval: ${formatEval(curPos)}` : 'click Analyze'}</div></div>;
        }
        const mv = game.moves[currentPly - 1];
        const mi = moveInfos[currentPly - 1];
        return (
            <div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>
                    {mv.moveNumber}{mv.color === 'w' ? '.' : '…'} {mv.san}
                    {mi && mi.classification.symbol && <span style={{ color: mi.classification.color, marginLeft: 6 }}>{mi.classification.symbol}</span>}
                </div>
                {curPos && <div style={{ color: 'var(--accent)', fontFamily: 'var(--mono)' }}>eval: {formatEval(curPos)}</div>}
                {mi && <div style={{ color: 'var(--text-dim)' }}>{mi.classification.label}{mi.loss > 10 ? ` (−${Math.round(mi.loss)}cp)` : ''}</div>}
                {mi?.bestSanBefore && mi.bestSanBefore !== mv.san && <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>engine liked: <b style={{ color: 'var(--text)' }}>{mi.bestSanBefore}</b></div>}
            </div>
        );
    })();

    return (
        <div style={{ maxWidth: 1480, margin: '0 auto', padding: '24px 16px' }}>
            <h1 style={{ fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 600, margin: 0, letterSpacing: '-.3px' }}>Chesstown</h1>
            <p style={{ color: 'var(--text-dim)', maxWidth: 720, marginTop: 6 }}>
                Free chess analyzer with cloud Stockfish (SF 18+) and an AI coach powered by Llama 3.3 70B. Pull a game from chess.com, paste a PGN, or analyze a FEN.
            </p>

            <div className="card" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 240px' }}>
                        <div className="eyebrow" style={{ marginBottom: 6 }}>CHESS.COM USERNAME</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. hikaru" />
                            <button onClick={() => loadGames(username)}>Find games</button>
                            <button className="ghost" onClick={() => { setUsername('hikaru'); loadGames('hikaru'); }}>try: hikaru</button>
                        </div>
                    </div>
                    <div style={{ flex: '1 1 240px' }}>
                        <div className="eyebrow" style={{ marginBottom: 6 }}>OR PASTE A PGN</div>
                        <PgnPaste onPaste={pastePgn} />
                    </div>
                </div>
                {status && <div style={{ color: 'var(--text-dim)', fontSize: 13 }} dangerouslySetInnerHTML={{ __html: status }} />}
                {games.length > 0 && (
                    <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                        {games.map((g, i) => {
                            const uname = username.toLowerCase();
                            const opp = (g.white.username.toLowerCase() === uname) ? g.black.username : g.white.username;
                            const userResult = (g.white.username.toLowerCase() === uname) ? g.white.result : g.black.result;
                            const oppResult = (g.white.username.toLowerCase() === uname) ? g.black.result : g.white.result;
                            let tag = 'draw', txt = 'Draw';
                            if (userResult === 'win') { tag = 'win'; txt = 'Win'; }
                            else if (oppResult === 'win') { tag = 'loss'; txt = 'Loss'; }
                            const date = new Date(g.end_time * 1000).toLocaleDateString();
                            return (
                                <div key={i} onClick={() => selectGame(g)} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 5, border: '1px solid transparent', cursor: 'pointer' }}>
                                    <span><b>vs {opp}</b> · {date} · {g.time_class}</span>
                                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, padding: '3px 8px', borderRadius: 3, border: `1px solid ${tag === 'win' ? 'var(--accent)' : tag === 'loss' ? 'var(--blunder)' : 'var(--line)'}`, color: tag === 'win' ? 'var(--accent)' : tag === 'loss' ? 'var(--blunder)' : 'var(--text-dim)' }}>{txt}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {game && (
                <div className="card" style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                            <div className="eyebrow" style={{ marginBottom: 6 }}>ENGINE DEPTH</div>
                            <div style={{ display: 'inline-flex', gap: 4, padding: 3, background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--line)' }}>
                                {[12, 16, 20].map(d => (
                                    <button key={d} onClick={() => setDepth(d)} style={{ background: depth === d ? 'var(--accent)' : 'transparent', color: depth === d ? '#0c0c0c' : 'var(--text-dim)', border: 'none', fontWeight: depth === d ? 600 : 500, padding: '6px 14px', borderRadius: 4 }}>{d === 12 ? 'Fast' : d === 16 ? 'Balanced' : 'Deep'}</button>
                                ))}
                            </div>
                        </div>
                        <button onClick={runAnalysis}>Analyze this game</button>
                        <button className="ghost" onClick={() => setShowEngineModal(true)}>Engine settings</button>
                    </div>
                    {progress > 0 && progress < 100 && (
                        <div style={{ flex: '1 1 200px', maxWidth: 300 }}>
                            <div style={{ height: 6, background: 'var(--line)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-2))', transition: 'width .2s' }} />
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)', marginTop: 4 }}>{progress}% · cloud engine</div>
                        </div>
                    )}
                </div>
            )}

            {game && (
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'minmax(280px, 380px) 1fr minmax(320px, 420px)', gap: 16, alignItems: 'start' }}>
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', width: '100%', maxWidth: 380 }}>
                            <EvalBar pos={curPos} />
                            <div style={{ flex: 1 }}>
                                <Board fen={curPos?.fen ?? game.moves[0]?.fenBefore ?? START_FEN} lastMove={lastMove} flipped={flipped}>
                                    <ArrowsLayer
                                        pv={curPos?.pv ?? []}
                                        flipped={flipped}
                                        style="arrow"
                                        color="#facc15"
                                        pvGradient={{ from: '#FFFF00', to: '#FF0000' }}
                                        pvCustomGradient={false}
                                        arrowWidth={15}
                                        arrowOpacity={0.85}
                                        showNumbers={false}
                                        size={360}
                                    />
                                </Board>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button className="ghost" onClick={() => setCurrentPly(0)}>« first</button>
                            <button className="ghost" onClick={() => setCurrentPly(p => Math.max(0, p - 1))}>← prev</button>
                            <button className="ghost" onClick={() => setFlipped(f => !f)}>flip</button>
                            <button className="ghost" onClick={() => setCurrentPly(p => Math.min(game.moves.length, p + 1))}>next →</button>
                            <button className="ghost" onClick={() => setCurrentPly(game.moves.length)}>last »</button>
                        </div>
                        <div style={{ minHeight: 80, textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-dim)', width: '100%' }}>{detail}</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <MoveList moves={game.moves} moveInfos={moveInfos} currentPly={currentPly} onSelect={setCurrentPly} />
                        <GameGraph positions={positions} currentPly={currentPly} onSelect={setCurrentPly} />
                        <SummaryCards moves={game.moves} moveInfos={moveInfos} userIsWhite={game.userIsWhite} onJump={setCurrentPly} />
                    </div>

                    <CoachPanel
                        currentPos={curPos}
                        currentPly={currentPly}
                        moves={game.moves}
                        positions={positions}
                        moveInfos={moveInfos}
                        onJump={setCurrentPly}
                        userIsWhite={game.userIsWhite}
                    />
                </div>
            )}

            {showEngineModal && (
                <EngineSettingsModal
                    modelId={modelId}
                    onModelChange={(id) => setModelId(id)}
                    onClose={() => setShowEngineModal(false)}
                    models={ENGINE_MODELS}
                />
            )}
        </div>
    );
}

function PgnPaste({ onPaste }: { onPaste: (pgn: string) => void }) {
    const [val, setVal] = useState('');
    return (
        <div style={{ display: 'flex', gap: 8 }}>
            <input value={val} onChange={e => setVal(e.target.value)} placeholder="paste PGN here…" style={{ flex: 1 }} />
            <button className="ghost" onClick={() => { if (val.trim()) { onPaste(val); setVal(''); } }}>Load PGN</button>
        </div>
    );
}
