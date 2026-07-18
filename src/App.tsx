import { useEffect, useMemo, useRef, useState } from 'react';
import { Board } from './components/Board';
import { ArrowsLayer } from './components/ArrowsLayer';
import { EvalBar } from './components/EvalBar';
import { MoveList } from './components/MoveList';
import { GameGraph } from './components/GameGraph';
import { SummaryCards } from './components/SummaryCards';
import { CoachPanel } from './components/CoachPanel';
import { EngineSettingsModal } from './components/EngineSettingsModal';
import { OpeningName } from './components/OpeningName';
import { FullscreenBoard } from './components/FullscreenBoard';
import { HelpDialog } from './components/HelpDialog';
import { DebugPanel } from './components/DebugPanel';
import { ToastContainer, pushToast } from './components/Toast';
import { analyzeAll, toPositionInfo, analyzeFen } from './lib/engine';
import { buildMovesFromPgn, classify, formatEval, squareToRowCol, START_FEN, uciToSan } from './lib/chess';
import { logger } from './lib/logger';
import { detectOpening } from './lib/openings';
import { buildSuggestions, detectThreats, Suggestion, Threat } from './lib/suggest';
import type { EngineModelId, MoveInfo, PositionInfo } from './lib/types';

const ENGINE_MODELS = [
    { id: 'cloud' as EngineModelId, label: 'Cloud Stockfish (recommended)', maxDepth: 22 },
    { id: 'local' as EngineModelId, label: 'Local Stockfish (downloads WASM)', maxDepth: 25 },
];

type Game = { headers: Record<string, string>; moves: ReturnType<typeof buildMovesFromPgn>; userIsWhite: boolean };

export function App() {
    logger.installGlobalHandlers();

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
    const [showFullscreen, setShowFullscreen] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [depth, setDepth] = useState(16);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [threats, setThreats] = useState<Threat[]>([]);
    const analysisTokenRef = useRef(0);

    const loadGames = async (u: string) => {
        setStatus('Searching chess.com…'); setGames([]);
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
            setStatus(e.message === 'not-found' ? "Couldn't find that username." : "Couldn't reach chess.com.");
        }
    };

    const selectGame = (g: any) => {
        const uname = username.toLowerCase();
        const userIsWhite = g.white.username.toLowerCase() === uname;
        const userIsBlack = g.black.username.toLowerCase() === uname;
        try {
            const moves = buildMovesFromPgn(g.pgn);
            setGame({ headers: { White: g.white.username, Black: g.black.username }, moves, userIsWhite: userIsWhite || !userIsBlack });
            setFlipped(!userIsWhite);
            setCurrentPly(0);
            setPositions(new Array(moves.length + 1).fill(null));
            setMoveInfos(new Array(moves.length).fill(null));
            setSuggestions([]); setThreats([]);
            setStatus('Game loaded. Click <b>Analyze</b>.');
        } catch (e: any) {
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
            setSuggestions([]); setThreats([]);
            setStatus('PGN loaded. Click <b>Analyze</b>.');
        } catch (e: any) {
            setStatus('PGN parse error: ' + e.message);
        }
    };

    const runAnalysis = async () => {
        if (!game) return;
        const token = ++analysisTokenRef.current;
        const t0 = Date.now();
        setStatus('Analyzing in parallel on the cloud engine…');
        setProgress(0);
        const fens = [game.moves.length ? game.moves[0].fenBefore : START_FEN, ...game.moves.map(m => m.fenAfter)];
        setPositions(new Array(fens.length).fill(null));
        setMoveInfos(new Array(game.moves.length).fill(null));

        try {
            const results = await analyzeAll(fens, depth, (done, total) => {
                if (token === analysisTokenRef.current) setProgress(Math.round((done / total) * 100));
            });
            if (token !== analysisTokenRef.current) return;
            if (!results.length) { setStatus('Engine returned no results. Open the debug panel and run a diagnostic.'); return; }

            const infos: PositionInfo[] = results.map((r, i) => {
                const pi = toPositionInfo(r, fens[i]);
                pi.bestSan = pi.bestMoveUci ? uciToSan(fens[i], pi.bestMoveUci) : null;
                return pi;
            });
            setPositions(infos);

            const mi: (MoveInfo | null)[] = new Array(game.moves.length).fill(null);
            for (let i = 1; i < infos.length; i++) {
                const before = infos[i - 1], after = infos[i];
                const moveIdx = i - 1;
                const mover = game.moves[moveIdx].color;
                const loss = mover === 'w' ? Math.max(0, before.cpWhitePov - after.cpWhitePov) : Math.max(0, after.cpWhitePov - before.cpWhitePov);
                mi[moveIdx] = { ply: moveIdx + 1, loss, classification: classify(loss, after.score?.type === 'mate'), bestSanBefore: before.bestSan, playedSan: game.moves[moveIdx].san, isUserMove: game.userIsWhite === (mover === 'w') };
            }
            setMoveInfos(mi);
            setStatus(`Analysis complete — ${infos.length} positions in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
            setProgress(100);
            pushToast('Analysis complete', 'success');
        } catch (e: any) {
            logger.error('analysis', e.message);
            setStatus('Analysis failed: ' + e.message);
        }
    };

    // Compute current state
    const curPos = positions[currentPly] ?? null;
    const lastMove = useMemo(() => {
        if (!game || currentPly === 0) return null;
        const mv = game.moves[currentPly - 1];
        if (!mv.from || !mv.to) return null;
        const a = squareToRowCol(mv.from), b = squareToRowCol(mv.to);
        return { fromRow: a.row, fromCol: a.col, toRow: b.row, toCol: b.col };
    }, [game, currentPly]);

    // Opening detection
    const sanMoves = useMemo(() => game?.moves.map(m => m.san) ?? [], [game]);
    const opening = useMemo(() => detectOpening(sanMoves), [sanMoves]);

    // Refresh threats when ply changes
    useEffect(() => {
        if (!game || !curPos) { setThreats([]); return; }
        const fen = curPos.fen;
        try { setThreats(detectThreats(fen)); } catch { setThreats([]); }
    }, [curPos, game]);

    // Build alternative moves for the arrow layer
    const alternativeMoves = useMemo(() => {
        if (!curPos) return [];
        return curPos.pv.slice(1, 4).map(uci => ({ uci }));
    }, [curPos]);

    // Coach helpers
    const onAsk = (text: string) => {
        // CoachPanel just collects the question, the actual streaming happens
        // via direct fetch in main CoachPanel flow. For the new "Suggest" and
        // "Threats" buttons we generate rich local responses.
        const ply = currentPly;
        const pos = curPos;

        if (text.toLowerCase().includes('suggest')) {
            if (!pos) { pushCoach('<i>Click <b>Analyze</b> first so I can see the engine output.</i>'); return; }
            buildSuggestions(pos.fen, pos.cpWhitePov, analyzeFen, 4).then(s => {
                setSuggestions(s.slice(0, 4));
                const html = s.length === 0 ? '<i>No legal moves found.</i>'
                    : '<b>Top moves for you:</b><br>' + s.slice(0, 4).map(x =>
                        `<b>${x.san}</b> — eval ${(x.evalCp / 100).toFixed(2)}${x.deltaCp !== 0 ? ` (${x.deltaCp > 0 ? '+' : ''}${(x.deltaCp / 100).toFixed(2)} vs current)` : ''} — <span style="color:var(--text-dim)">${x.classification}</span>`
                    ).join('<br>');
                pushCoach(html);
            });
            return;
        }
        if (text.toLowerCase().includes('threat')) {
            const t = threats;
            const html = t.length === 0
                ? '<i>No immediate threats detected on this position.</i>'
                : `<b>Opponent threats:</b><br>` + t.map(x => `<b>${x.san}</b> — ${x.description}`).join('<br>');
            pushCoach(html);
            return;
        }

        // Default: send the question to /api/coach and stream into chat
        const msgs = (window as any).__coachHistory || [];
        (window as any).__coachHistory = [...msgs, { role: 'user', content: text }];
        const context = {
            ply, fen: pos?.fen, evalCp: pos?.cpWhitePov, bestMoveSan: pos?.bestSan, pv: pos?.pv,
            lastMove: ply > 0 ? { san: game.moves[ply - 1]?.san, info: moveInfos[ply - 1] } : null,
            userSide: game.userIsWhite ? 'white' : 'black',
        };
        fetch('/api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: text, context }) })
            .then(async r => {
                if (!r.ok || !r.body) throw new Error('Coach HTTP ' + r.status);
                const reader = r.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '', acc = '';
                pushCoach('<span style="opacity:.6">thinking…</span>');
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n'); buffer = lines.pop() ?? '';
                    for (const line of lines) {
                        if (!line.startsWith('data:')) continue;
                        const payload = line.slice(5).trim();
                        if (payload === '[DONE]') continue;
                        try { const o = JSON.parse(payload); if (typeof o.content === 'string') acc += o.content; } catch { }
                    }
                    if (acc) updateLastCoach(formatMdLite(acc));
                }
                if (!acc) updateLastCoach('<i>Coach returned no content. Try again or check the debug panel.</i>');
            })
            .catch(err => {
                logger.error('coach', err.message);
                updateLastCoach(`<i>Coach error: ${err.message}</i>`);
            });
    };

    // Helpers for the coach panel to push messages in
    const pushCoach = (html: string) => {
        (window as any).__setCoachMsg?.(html);
    };
    const updateLastCoach = (html: string) => {
        (window as any).__updateLastCoach?.(html);
    };

    // Expose hooks to CoachPanel
    useEffect(() => {
        (window as any).__setCoachMsg = (html: string) => {
            const ev = new CustomEvent('coach-append', { detail: html });
            window.dispatchEvent(ev);
        };
        (window as any).__updateLastCoach = (html: string) => {
            const ev = new CustomEvent('coach-replace-last', { detail: html });
            window.dispatchEvent(ev);
        };
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!game) return;
            const tag = (e.target as HTMLElement)?.tagName || '';
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            if (e.key === 'ArrowLeft') setCurrentPly(p => Math.max(0, p - 1));
            if (e.key === 'ArrowRight') setCurrentPly(p => Math.min(game.moves.length, p + 1));
            if (e.key === 'ArrowUp') setCurrentPly(0);
            if (e.key === 'ArrowDown') setCurrentPly(game.moves.length);
            if (e.key === '?' || (e.shiftKey && e.key === '/')) { e.preventDefault(); setShowHelp(s => !s); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [game]);

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
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
                <div>
                    <h1 style={{ fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 600, margin: 0, letterSpacing: '-.3px' }}>Chesstown</h1>
                    <p style={{ color: 'var(--text-dim)', maxWidth: 720, margin: '4px 0 0', fontSize: 13 }}>
                        Free chess analyzer with cloud Stockfish (SF 18+) and an AI coach. Pull a game from chess.com or paste a PGN.
                    </p>
                </div>
                <button onClick={() => setShowHelp(true)} className="ghost" style={{ fontSize: 12 }}>? Shortcuts</button>
            </div>

            {/* Setup card */}
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
                                <div key={i} onClick={() => selectGame(g)} className="pm-game-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 5, border: '1px solid transparent', cursor: 'pointer' }}>
                                    <span><b>vs {opp}</b> · {date} · {g.time_class}</span>
                                    <span className={`pm-tag pm-${tag}`} style={{ fontFamily: 'var(--mono)', fontSize: 11, padding: '3px 8px', borderRadius: 3, border: `1px solid ${tag === 'win' ? 'var(--accent)' : tag === 'loss' ? 'var(--blunder)' : 'var(--line)'}`, color: tag === 'win' ? 'var(--accent)' : tag === 'loss' ? 'var(--blunder)' : 'var(--text-dim)' }}>{txt}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Analyze controls */}
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
                            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)', marginTop: 4 }}>{progress}%</div>
                        </div>
                    )}
                </div>
            )}

            {/* Workspace */}
            {game && (
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'minmax(280px, 380px) 1fr minmax(320px, 420px)', gap: 16, alignItems: 'start' }}>
                    {/* Board column */}
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                        {opening && (
                            <div style={{ width: '100%' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg)', borderRadius: 4 }}>
                                    <span className="eyebrow" style={{ color: 'var(--text-dim)' }}>{opening.eco}</span>
                                    <span style={{ fontWeight: 600, fontSize: 13 }}>{opening.name}</span>
                                </div>
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', width: '100%', maxWidth: 380, justifyContent: 'center' }}>
                            <EvalBar pos={curPos} height={360} width={20} />
                            <div style={{ flex: 1, position: 'relative' }}>
                                <Board fen={curPos?.fen ?? game.moves[0]?.fenBefore ?? START_FEN} lastMove={lastMove} flipped={flipped} width={360}>
                                    <ArrowsLayer
                                        pv={curPos?.pv ?? []}
                                        alternativeMoves={alternativeMoves}
                                        flipped={flipped}
                                        style="arrow"
                                        pvColor="#facc15"
                                        altColor="#94a3b8"
                                        pvGradient={{ from: '#FFFF00', to: '#FF0000' }}
                                        pvCustomGradient={false}
                                        arrowWidth={15}
                                        arrowOpacity={0.9}
                                        showNumbers={false}
                                        size={360}
                                        bestUci={curPos?.bestMoveUci ?? null}
                                    />
                                </Board>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                            <button className="ghost" onClick={() => setCurrentPly(0)}>« first</button>
                            <button className="ghost" onClick={() => setCurrentPly(p => Math.max(0, p - 1))}>← prev</button>
                            <button className="ghost" onClick={() => setFlipped(f => !f)}>flip</button>
                            <button className="ghost" onClick={() => setCurrentPly(p => Math.min(game.moves.length, p + 1))}>next →</button>
                            <button className="ghost" onClick={() => setCurrentPly(game.moves.length)}>last »</button>
                            <button className="ghost" onClick={() => setShowFullscreen(true)} style={{ marginLeft: 4 }}>⛶ fullscreen</button>
                        </div>
                        <div style={{ minHeight: 80, textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-dim)', width: '100%' }}>{detail}</div>
                    </div>

                    {/* Moves + summary column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <MoveList moves={game.moves} moveInfos={moveInfos} currentPly={currentPly} onSelect={setCurrentPly} />
                        <GameGraph positions={positions} currentPly={currentPly} onSelect={setCurrentPly} />
                        <SummaryCards moves={game.moves} moveInfos={moveInfos} userIsWhite={game.userIsWhite} onJump={setCurrentPly} />
                    </div>

                    {/* Coach column */}
                    <CoachPanelWithBridge
                        currentPos={curPos}
                        currentPly={currentPly}
                        moves={game.moves}
                        positions={positions}
                        moveInfos={moveInfos}
                        onJump={setCurrentPly}
                        userIsWhite={game.userIsWhite}
                        onAsk={onAsk}
                        onSuggest={() => onAsk('suggest')}
                        onThreats={() => onAsk('threat')}
                    />
                </div>
            )}

            {/* Modals */}
            <FullscreenBoard
                open={showFullscreen}
                onClose={() => setShowFullscreen(false)}
                fen={curPos?.fen ?? game?.moves[0]?.fenBefore ?? START_FEN}
                lastMove={lastMove}
                flipped={flipped}
                pos={curPos}
                showPV={true}
                showAlt={true}
                onFlip={() => setFlipped(f => !f)}
            />
            <HelpDialog open={showHelp} onClose={() => setShowHelp(false)} />
            {showEngineModal && (
                <EngineSettingsModal
                    modelId={modelId}
                    onModelChange={(id) => setModelId(id)}
                    onClose={() => setShowEngineModal(false)}
                    models={ENGINE_MODELS}
                />
            )}
            <DebugPanel />
            <ToastContainer />
        </div>
    );
}

// Wrapper that hooks into the global coach history setters
import { useEffect as useEff2 } from 'react';
function CoachPanelWithBridge(props: any) {
    const [history, setHistory] = useState<{ role: string; html: string; pending?: boolean }[]>([
        { role: 'coach', html: "<b>Hi, I'm your AI Coach.</b><br><br>Analyze a game, then ask me about any position." },
    ]);
    useEffect(() => {
        const onAppend = (e: any) => {
            setHistory(h => [...h, { role: 'coach', html: e.detail, pending: true }]);
        };
        const onReplace = (e: any) => {
            setHistory(h => h.map((m, i) => i === h.length - 1 ? { ...m, html: e.detail, pending: false } : m));
        };
        window.addEventListener('coach-append', onAppend);
        window.addEventListener('coach-replace-last', onReplace);
        return () => {
            window.removeEventListener('coach-append', onAppend);
            window.removeEventListener('coach-replace-last', onReplace);
        };
    }, []);
    return <CoachPanel {...props} _history={history} _setHistory={setHistory} />;
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

function formatMdLite(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
        .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<i>$1</i>');
}
