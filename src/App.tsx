import { useEffect, useMemo, useRef, useState } from 'react';
import { Board } from './components/Board';
import { ArrowsLayer } from './components/ArrowsLayer';
import { EvalBar } from './components/EvalBar';
import { MoveList } from './components/MoveList';
import { GameGraph } from './components/GameGraph';
import { SummaryCards } from './components/SummaryCards';
import { CoachPanel } from './components/CoachPanel';
import { EngineSettingsModal } from './components/EngineSettingsModal';
import { WorkerPool } from './engine/workerPool';
import { getEngineById } from './engine/localEngines';
import { cacheDelete, cacheGet, cachePut } from './engine/cache';
import { buildMovesFromPgn, classify, formatEval, squareToRowCol, START_FEN, uciToSan } from './lib/chess';
import type { EngineModelId, MoveInfo, PositionInfo } from './engine/types';

type Game = {
    headers: Record<string, string>;
    moves: ReturnType<typeof buildMovesFromPgn>;
    userIsWhite: boolean;
};

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
    const [modelId, setModelId] = useState<EngineModelId>('sf18_05');
    const [engineStatus, setEngineStatus] = useState<'not_installed' | 'loading' | 'ready' | 'error'>('not_installed');
    const [engineStatusMsg, setEngineStatusMsg] = useState('');
    const [showEngineModal, setShowEngineModal] = useState(false);
    const [depth, setDepth] = useState(18);
    const [threadCount] = useState(() => Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 4) - 1 || 1)));
    const poolRef = useRef<WorkerPool | null>(null);
    const analysisTokenRef = useRef(0);

    const concurrency = threadCount;

    // Engine model settings
    const [modelOpts, setModelOpts] = useState(() => ({ ...getEngineById('sf18_05').defaults, hashMB: 64, skillLevel: 20, elo: 3190, limitStrength: false } as any));

    const ensurePool = async (id: EngineModelId) => {
        if (poolRef.current) poolRef.current.terminate();
        setEngineStatus('loading');
        setEngineStatusMsg(`Spinning up ${concurrency} Stockfish thread${concurrency === 1 ? '' : 's'}…`);
        const p = new WorkerPool(id, concurrency, (slotIdx, uci) => {
            // No-op here; we read best moves out of analyze() resolutions
        });
        poolRef.current = p;
        try { await p.waitReady(); setEngineStatus('ready'); setEngineStatusMsg(`${getEngineById(id).label} ready`); }
        catch (e: any) { setEngineStatus('error'); setEngineStatusMsg(e.message); }
    };

    // Load username's games
    const loadGames = async (u: string) => {
        setStatus('Searching chess.com…');
        setGames([]);
        try {
            const archivesRes = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(u.toLowerCase())}/games/archives`);
            if (!archivesRes.ok) throw new Error(archivesRes.status === 404 ? 'not-found' : 'http');
            const { archives } = await archivesRes.json();
            if (!archives?.length) { setStatus('No archives found.'); return; }
            const recent = archives.slice(-6).reverse();
            const collected: any[] = [];
            for (const url of recent) {
                const r = await fetch(url);
                if (!r.ok) continue;
                const data = await r.json();
                collected.push(...(data.games || []).filter((g: any) => g.rules === 'chess'));
                if (collected.length >= 20) break;
            }
            collected.sort((a, b) => b.end_time - a.end_time);
            setGames(collected.slice(0, 20));
            setStatus('');
        } catch (e: any) {
            setStatus(e.message === 'not-found' ? "Couldn't find that username." : "Couldn't reach chess.com.");
        }
    };

    const selectGame = (g: any) => {
        const uname = username.toLowerCase();
        const userIsWhite = g.white.username.toLowerCase() === uname;
        const userIsBlack = g.black.username.toLowerCase() === uname;
        const userIsWhiteFinal = userIsWhite || !userIsBlack;
        const moves = buildMovesFromPgn(g.pgn);
        setGame({ headers: { White: g.white.username, Black: g.black.username, Result: g.white.result === 'win' ? '1-0' : g.black.result === 'win' ? '0-1' : '1/2-1/2' }, moves, userIsWhite: userIsWhiteFinal });
        setFlipped(!userIsWhiteFinal);
        setCurrentPly(0);
        setPositions(new Array(moves.length + 1).fill(null));
        setMoveInfos(new Array(moves.length).fill(null));
        setStatus('Game loaded. Click <b>Analyze</b> to run the engine.');
    };

    // PGN paste path
    const pastePgn = async (pgn: string) => {
        try {
            const moves = buildMovesFromPgn(pgn);
            setGame({ headers: { White: '?', Black: '?' }, moves, userIsWhite: true });
            setFlipped(false);
            setCurrentPly(0);
            setPositions(new Array(moves.length + 1).fill(null));
            setMoveInfos(new Array(moves.length).fill(null));
            setStatus('PGN loaded. Click <b>Analyze</b>.');
        } catch (e: any) { setStatus('PGN parse error: ' + e.message); }
    };

    const runAnalysis = async () => {
        if (!game || !poolRef.current) return;
        const token = ++analysisTokenRef.current;
        setStatus(`Analyzing ${game.moves.length + 1} positions in parallel on ${concurrency} threads…`);
        const fens = [game.moves.length ? game.moves[0].fenBefore : START_FEN, ...game.moves.map(m => m.fenAfter)];
        setPositions(new Array(fens.length).fill(null));
        setMoveInfos(new Array(game.moves.length).fill(null));
        let done = 0;
        const promises = fens.map((fen, i) => poolRef.current!.analyze(fen, depth).then(info => {
            if (token !== analysisTokenRef.current) return;
            done++;
            setProgress(Math.round((done / fens.length) * 100));
            if (!info) return;
            // Convert best UCI to SAN
            const bestSan = info.bestMoveUci ? uciToSan(fen, info.bestMoveUci) : null;
            const enriched: PositionInfo = { ...info, bestSan };
            setPositions(prev => { const next = [...prev]; next[i] = enriched; return next; });
            if (i > 0) {
                const moveIdx = i - 1;
                const before = enriched; // placeholder, will compute loss in a follow-up
                const mover = game.moves[moveIdx].color;
                const prevPos = i > 0 ? null : null; // we have positions[i-1] but we're updating async
                // Loss computed when both before/after exist:
                const afterCp = enriched.cpWhitePov;
                // We need the previous slot; this works because positions[i-1] was already written by its own promise
                // but it may not be ready yet. Use the direct read from the captured enriched and re-pull from state:
                setPositions(prev => {
                    const beforePos = prev[i - 1];
                    if (!beforePos) return prev;
                    const loss = mover === 'w' ? Math.max(0, beforePos.cpWhitePov - afterCp) : Math.max(0, afterCp - beforePos.cpWhitePov);
                    const info2: MoveInfo = {
                        ply: moveIdx + 1,
                        loss,
                        classification: classify(loss, enriched.score?.type === 'mate'),
                        bestSanBefore: beforePos.bestSan,
                        playedSan: game.moves[moveIdx].san,
                        isUserMove: game.userIsWhite === (mover === 'w'),
                    };
                    setMoveInfos(mi => { const n = [...mi]; n[moveIdx] = info2; return n; });
                    return prev;
                });
            }
        }));
        await Promise.all(promises);
        if (token === analysisTokenRef.current) {
            setStatus(`Analysis complete — ${done} positions evaluated.`);
        }
    };

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
            return <div><div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>Starting position</div><div style={{ color: 'var(--text-dim)' }}>{curPos ? `eval: ${formatEval(curPos)}` : 'not analyzed yet'}</div></div>;
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
                Free chess analyzer with multi-threaded local Stockfish (5 versions, including SF 18.0.5 WASM) and an AI coach powered by Llama 3.3 70B. Pull a game from chess.com, paste a PGN, or analyze a FEN.
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
                                <div key={i} onClick={() => selectGame(g)} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 5, border: '1px solid transparent', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--panel-2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
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
                                {[10, 14, 18, 22].map(d => (
                                    <button key={d} onClick={() => setDepth(d)} style={{ background: depth === d ? 'var(--accent)' : 'transparent', color: depth === d ? '#0c0c0c' : 'var(--text-dim)', border: 'none', fontWeight: depth === d ? 600 : 500, padding: '6px 14px', borderRadius: 4 }}>{d === 10 ? 'Fast' : d === 14 ? 'Balanced' : d === 18 ? 'Deep' : 'Ultra'}</button>
                                ))}
                            </div>
                        </div>
                        <button onClick={runAnalysis} disabled={!poolRef.current || engineStatus !== 'ready'}>Analyze this game</button>
                        <button className="ghost" onClick={() => setShowEngineModal(true)}>Engine settings</button>
                    </div>
                    {progress > 0 && progress < 100 && (
                        <div style={{ flex: '1 1 200px', maxWidth: 300 }}>
                            <div style={{ height: 6, background: 'var(--line)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-2))', transition: 'width .2s' }} />
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)', marginTop: 4 }}>{progress}% · {concurrency} threads</div>
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
                    onModelChange={(id) => { setModelId(id); ensurePool(id); }}
                    onOptionsChange={setModelOpts}
                    onReinstall={async () => {
                        const m = getEngineById(modelId);
                        await cacheDelete(modelId + '_js');
                        await cacheDelete(modelId + '_wasm');
                        ensurePool(modelId);
                    }}
                    onUninstall={async () => {
                        await cacheDelete(modelId + '_js');
                        await cacheDelete(modelId + '_wasm');
                        if (poolRef.current) poolRef.current.terminate();
                        poolRef.current = null;
                        setEngineStatus('not_installed');
                        setEngineStatusMsg('');
                    }}
                    engineStatus={engineStatus}
                    engineStatusMsg={engineStatusMsg}
                    onClose={() => setShowEngineModal(false)}
                    onLoad={() => ensurePool(modelId)}
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
