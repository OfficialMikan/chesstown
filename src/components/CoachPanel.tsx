import { logger } from '../lib/logger';
import { useEffect, useRef, useState } from 'react';
import type { PositionInfo, MoveInfo } from '../lib/types';
import { templateBiggestMistake, templateExplainPosition } from '../lib/coachTemplates';
import { formatEval } from '../lib/chess';

type Msg = { role: 'user' | 'coach'; html: string; pending?: boolean };

type Props = {
    currentPos: PositionInfo | null;
    currentPly: number;
    moves: { ply: number; moveNumber: number; color: 'w' | 'b'; san: string }[];
    positions: (PositionInfo | null)[];
    moveInfos: (MoveInfo | null)[];
    onJump: (ply: number) => void;
    userIsWhite: boolean;
};

export function CoachPanel({ currentPos, currentPly, moves, positions, moveInfos, onJump, userIsWhite }: Props) {
    const [history, setHistory] = useState<Msg[]>([
        { role: 'coach', html: '<b>Hi, I\'m your AI Coach.</b><br><br>Analyze a game, then ask me about any position. I see exactly what the engine sees, so my advice is grounded in real eval, not vibes.' },
    ]);
    const [input, setInput] = useState('');
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }, [history]);

    const send = async (text: string) => {
        if (!text.trim()) return;
        const userMsg: Msg = { role: 'user', html: text.replace(/</g, '&lt;') };
        const pending: Msg = { role: 'coach', html: '<span style="opacity:.6">thinking…</span>', pending: true };
        setHistory(h => [...h, userMsg, pending]);
        setInput('');

        const context = buildContext(currentPos, currentPly, moves, positions, moveInfos, userIsWhite);

        try {
            const res = await fetch('/api/coach', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: text, context }),
            });
            if (!res.ok || !res.body) throw new Error('Coach API error: ' + res.status);
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let acc = '';
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';
                for (const line of lines) {
                    if (!line.startsWith('data:')) continue;
                    const payload = line.slice(5).trim();
                    if (payload === '[DONE]') continue;
                    try {
                        const obj = JSON.parse(payload);
                        if (typeof obj.content === 'string') acc += obj.content;
                    } catch { /* ignore */ }
                }
                if (acc) {
                    setHistory(h => h.map((m, i) => i === h.length - 1 ? { ...m, html: formatMdLite(acc) } : m));
                }
            }
            if (!acc) {
                setHistory(h => h.map((m, i) => i === h.length - 1 ? { ...m, html: '<i>Coach returned no content. Try again or check the debug drawer for details.</i>' } : m));
            }
        } catch (err: any) {
            const reply = offlineReply(text, { currentPos, currentPly, moves, positions, moveInfos, onJump });
            setHistory(h => h.map((m, i) => i === h.length - 1 ? { ...m, html: reply, pending: false } : m));
            logger.error('coach', err.message);
        }


        const askHere = () => send('Explain this position and what the engine wants me to play.');
        const askBiggest = () => send('What was my biggest mistake in this game?');

        return (
            <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', height: 680, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', background: 'var(--panel-2)' }}>
                    <div className="eyebrow" style={{ marginBottom: 6 }}>AI COACH</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Now viewing</span>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600 }}>
                            Move {currentPly} <span style={{ display: 'inline-block', padding: '2px 8px', background: 'var(--bg)', borderRadius: 10, fontSize: 12, color: 'var(--accent)' }}>{formatEval(currentPos)}</span>
                        </span>
                    </div>
                </div>
                <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {history.map((m, i) => (
                        <div key={i} className="card" style={{
                            padding: '10px 13px',
                            background: m.role === 'user' ? 'var(--accent)' : 'var(--panel-2)',
                            color: m.role === 'user' ? '#0c0c0c' : 'var(--text)',
                            border: m.role === 'user' ? 'none' : '1px solid var(--line)',
                            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                            maxWidth: '92%',
                            fontSize: 13,
                            lineHeight: 1.55,
                            borderRadius: 10,
                            borderBottomRightRadius: m.role === 'user' ? 3 : 10,
                            borderBottomLeftRadius: m.role === 'coach' ? 3 : 10,
                            whiteSpace: 'pre-wrap',
                            wordWrap: 'break-word',
                        }} dangerouslySetInnerHTML={{ __html: m.html }} />
                    ))}
                </div>
                <div style={{ padding: '10px 14px', display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid var(--line)' }}>
                    <button className="ghost" onClick={askHere} style={{ fontSize: 11, padding: '6px 12px', borderRadius: 14 }}>Ask about this position</button>
                    <button className="ghost" onClick={askBiggest} style={{ fontSize: 11, padding: '6px 12px', borderRadius: 14 }}>Explain my biggest mistake</button>
                </div>
                <div style={{ padding: '12px 14px', display: 'flex', gap: 6, borderTop: '1px solid var(--line)' }}>
                    <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                        placeholder="Ask the coach anything…"
                        style={{ flex: 1, minWidth: 0 }}
                    />
                    <button onClick={() => send(input)} style={{ background: 'var(--accent)', color: '#0c0c0c', fontWeight: 600, fontSize: 12, padding: '9px 16px' }}>Send</button>
                </div>
            </div>
        );
    }

    // --- helpers ---

    function buildContext(pos: PositionInfo | null, ply: number, moves: any[], positions: (PositionInfo | null)[], infos: (MoveInfo | null)[], userIsWhite: boolean) {
        return {
            ply,
            fen: pos?.fen,
            evalCp: pos?.cpWhitePov,
            scoreCp: pos?.score?.type === 'cp' ? pos.score.value : null,
            mate: pos?.score?.type === 'mate' ? pos.score.value : null,
            bestMoveUci: pos?.bestMoveUci,
            bestMoveSan: pos?.bestSan,
            pv: pos?.pv,
            depth: pos?.depth,
            lastMove: ply > 0 ? { san: moves[ply - 1]?.san, info: infos[ply - 1] } : null,
            userSide: userIsWhite ? 'white' : 'black',
        };
    }

    function offlineReply(text: string, ctx: any): string {
        const lower = text.toLowerCase();
        if (/biggest|worst|blunder|mistake/.test(lower)) {
            let worstIdx = -1, worstLoss = 0;
            ctx.moveInfos.forEach((m: MoveInfo | null, i: number) => {
                if (m && m.loss > worstLoss) { worstLoss = m.loss; worstIdx = i; }
            });
            if (worstIdx < 0) return 'No analysis yet — hit <b>Analyze</b> first.';
            const reply = templateBiggestMistake({
                idx: worstIdx, san: ctx.moves[worstIdx].san, info: ctx.moveInfos[worstIdx],
                before: ctx.positions[worstIdx], after: ctx.positions[worstIdx + 1],
            });
            ctx.onJump(worstIdx + 1);
            return reply;
        }
        return templateExplainPosition(ctx.currentPos, ctx.currentPly, ctx.lastMove);
    }

    function formatMdLite(s: string): string {
        // Tiny markdown: **bold**, *italic*, line breaks, escape HTML
        return s
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
            .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<i>$1</i>');
    }
