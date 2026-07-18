import { useEffect, useRef, useState } from 'react';
import { formatEval } from '../lib/chess';
import { logger } from '../lib/logger';
import { buildSuggestions, detectThreats } from '../lib/suggest';
import { analyzeFen } from '../lib/engine';
import type { MoveInfo, PositionInfo } from '../lib/types';

type Msg = { role: 'user' | 'coach'; html: string; pending?: boolean };

type Props = {
    currentPos: PositionInfo | null;
    currentPly: number;
    moves: { ply: number; moveNumber: number; color: 'w' | 'b'; san: string }[];
    positions: (PositionInfo | null)[];
    moveInfos: (MoveInfo | null)[];
    onJump: (ply: number) => void;
    userIsWhite: boolean;
    threats: { san: string; description: string }[];
};

function formatMdLite(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
        .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<i>$1</i>');
}

export function CoachPanel(props: Props) {
    const { currentPos, currentPly, moves, positions, moveInfos, onJump, userIsWhite, threats } = props;
    const [history, setHistory] = useState<Msg[]>([
        { role: 'coach', html: "<b>Hi, I'm your AI Coach.</b><br><br>Analyze a game, then ask me about any position. I see exactly what the engine sees." },
    ]);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [history]);

    const updateLast = (html: string) => {
        setHistory(h => h.map((m, i) => i === h.length - 1 ? { ...m, html, pending: false } : m));
    };
    const append = (role: 'user' | 'coach', html: string, pending = false) => {
        setHistory(h => [...h, { role, html, pending }]);
    };

    const ask = async (question: string) => {
        if (streaming || !question.trim()) return;
        append('user', question.replace(/</g, '&lt;'));
        append('coach', '<span style="opacity:.6">thinking…</span>', true);
        setStreaming(true);
        try {
            const context = {
                ply: currentPly,
                fen: currentPos?.fen,
                evalCp: currentPos?.cpWhitePov,
                bestMoveSan: currentPos?.bestSan,
                pv: currentPos?.pv,
                lastMove: currentPly > 0 ? { san: moves[currentPly - 1]?.san, info: moveInfos[currentPly - 1] } : null,
                userSide: userIsWhite ? 'white' : 'black',
            };
            const r = await fetch('/api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, context }) });
            if (!r.ok || !r.body) throw new Error('HTTP ' + r.status);
            const reader = r.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '', acc = '';
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
                if (acc) updateLast(formatMdLite(acc));
            }
            if (!acc) updateLast('<i>Coach returned no text. Try again, or open the debug panel and run a diagnostic.</i>');
        } catch (e: any) {
            logger.error('coach', e.message);
            updateLast(`<i>Coach error: ${e.message}</i>`);
        } finally {
            setStreaming(false);
        }
    };

    const suggest = async () => {
        if (!currentPos) { append('coach', '<i>Click <b>Analyze</b> first.</i>'); return; }
        append('coach', '<span style="opacity:.6">computing suggestions…</span>', true);
        const sugg = await buildSuggestions(currentPos.fen, currentPos.cpWhitePov, async (fen: string) => {
            const r = await analyzeFen(fen, 16);
            if (!r) return null;
            const wtm = fen.split(' ')[1] === 'w';
            const cp = wtm ? r.cpWhitePov : -r.cpWhitePov;
            return { fen, score: r.mate !== null ? { type: 'mate', value: r.mate } : (r.cp !== null ? { type: 'cp', value: r.cp } : null), cpWhitePov: cp, bestMoveUci: r.bestMove, bestSan: null, pv: r.pv, depth: r.depth, nps: r.nps, timeMs: r.timeMs };
        }, 4);
        const top = sugg.slice(0, 4);
        if (!top.length) { updateLast('<i>No suggestions available.</i>'); return; }
        const html = '<b>Top moves for you:</b><br>' + top.map(s =>
            `<b>${s.san}</b> — eval ${(s.evalCp / 100).toFixed(2)}${s.deltaCp !== 0 ? ` (${s.deltaCp > 0 ? '+' : ''}${(s.deltaCp / 100).toFixed(2)} vs current)` : ''} — <span style="color:var(--text-dim)">${s.classification}</span>`
        ).join('<br>');
        updateLast(html);
    };

    const showThreats = () => {
        if (!threats.length) { append('coach', '<i>No immediate opponent threats detected.</i>'); return; }
        const html = '<b>Opponent threats:</b><br>' + threats.map(t => `<b>${t.san}</b> — ${t.description}`).join('<br>');
        append('coach', html);
    };

    return (
        <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', height: 680, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', background: 'var(--panel-2)' }}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>AI COACH</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Now viewing</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600 }}>
                        Move {currentPly} <span style={{ display: 'inline-block', padding: '2px 8px', background: 'var(--ink)', borderRadius: 10, fontSize: 12, color: 'var(--accent)' }}>{formatEval(currentPos)}</span>
                    </span>
                </div>
            </div>
            <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {history.map((m, i) => (
                    <div key={i} className="card" style={{
                        padding: '10px 13px',
                        background: m.role === 'user' ? 'var(--accent)' : 'var(--panel-2)',
                        color: m.role === 'user' ? '#ffffff' : 'var(--text)',
                        border: m.role === 'user' ? 'none' : '1px solid var(--line)',
                        alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '92%', fontSize: 13, lineHeight: 1.55, borderRadius: 10,
                        borderBottomRightRadius: m.role === 'user' ? 3 : 10,
                        borderBottomLeftRadius: m.role === 'coach' ? 3 : 10,
                        whiteSpace: 'pre-wrap', wordWrap: 'break-word',
                    }} dangerouslySetInnerHTML={{ __html: m.html }} />
                ))}
            </div>
            <div style={{ padding: '10px 14px', display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid var(--line)' }}>
                <button className="ghost" onClick={() => ask('Explain this position and what the engine wants me to play.')} style={{ fontSize: 11, padding: '6px 12px', borderRadius: 14 }}>Ask about this position</button>
                <button className="ghost" onClick={() => ask('What was my biggest mistake in this game?')} style={{ fontSize: 11, padding: '6px 12px', borderRadius: 14 }}>Biggest mistake</button>
                <button className="ghost" onClick={suggest} style={{ fontSize: 11, padding: '6px 12px', borderRadius: 14 }}>Suggest moves</button>
                <button className="ghost" onClick={showThreats} style={{ fontSize: 11, padding: '6px 12px', borderRadius: 14 }}>Threats</button>
            </div>
            <div style={{ padding: '12px 14px', display: 'flex', gap: 6, borderTop: '1px solid var(--line)' }}>
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input); setInput(''); } }}
                    placeholder="Ask the coach anything…"
                    disabled={streaming}
                    style={{ flex: 1, minWidth: 0 }}
                />
                <button onClick={() => { ask(input); setInput(''); }} disabled={streaming} style={{ background: 'var(--accent)', color: '#ffffff', fontWeight: 600, fontSize: 12, padding: '9px 16px' }}>Send</button>
            </div>
        </div>
    );
}
