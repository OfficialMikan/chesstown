import { useEffect, useRef, useState } from 'react';
import { formatEval } from '../lib/chess';
import { logger } from '../lib/logger';
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
    onAsk: (question: string) => void;
    onSuggest: () => void;
    onThreats: () => void;
};

export function CoachPanel({ currentPos, currentPly, moves, positions, moveInfos, onJump, userIsWhite, onAsk, onSuggest, onThreats }: Props) {
    const [history, setHistory] = useState<Msg[]>([
        { role: 'coach', html: "<b>Hi, I'm your AI Coach.</b><br><br>Analyze a game, then ask me about any position. I see exactly what the engine sees." },
    ]);
    const [input, setInput] = useState('');
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [history]);

    const send = async (text: string) => {
        if (!text.trim()) return;
        setHistory(h => [...h, { role: 'user', html: text.replace(/</g, '&lt;') }, { role: 'coach', html: '<span style="opacity:.6">thinking…</span>', pending: true }]);
        setInput('');
        onAsk(text);
    };

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
                    <div
                        key={i}
                        className="card"
                        style={{
                            padding: '10px 13px',
                            background: m.role === 'user' ? 'var(--accent)' : 'var(--panel-2)',
                            color: m.role === 'user' ? '#0c0c0c' : 'var(--text)',
                            border: m.role === 'user' ? 'none' : '1px solid var(--line)',
                            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                            maxWidth: '92%',
                            fontSize: 13, lineHeight: 1.55, borderRadius: 10,
                            borderBottomRightRadius: m.role === 'user' ? 3 : 10,
                            borderBottomLeftRadius: m.role === 'coach' ? 3 : 10,
                            whiteSpace: 'pre-wrap', wordWrap: 'break-word',
                        }}
                        dangerouslySetInnerHTML={{ __html: m.html }}
                    />
                ))}
            </div>
            <div style={{ padding: '10px 14px', display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid var(--line)' }}>
                <button className="ghost" onClick={() => send('Explain this position and what the engine wants me to play.')} style={{ fontSize: 11, padding: '6px 12px', borderRadius: 14 }}>Ask about this position</button>
                <button className="ghost" onClick={() => send('What was my biggest mistake in this game?')} style={{ fontSize: 11, padding: '6px 12px', borderRadius: 14 }}>Biggest mistake</button>
                <button className="ghost" onClick={onSuggest} style={{ fontSize: 11, padding: '6px 12px', borderRadius: 14 }}>💡 Suggest moves</button>
                <button className="ghost" onClick={onThreats} style={{ fontSize: 11, padding: '6px 12px', borderRadius: 14 }}>⚠️ Threats</button>
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
