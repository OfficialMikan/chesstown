import type { MoveInfo } from '../engine/types';

export function SummaryCards({ moves, moveInfos, userIsWhite, onJump }: { moves: { ply: number; moveNumber: number; color: 'w' | 'b'; san: string }[]; moveInfos: (MoveInfo | null)[]; userIsWhite: boolean; onJump: (ply: number) => void }) {
    const stats = { w: { loss: 0, count: 0, b: 0, m: 0, i: 0, g: 0 }, b: { loss: 0, count: 0, b: 0, m: 0, i: 0, g: 0 } };
    const worst: { idx: number; san: string; moveNumber: number; color: 'w' | 'b'; loss: number; symbol: string; label: string; color: string }[] = [];
    moves.forEach((mv, i) => {
        const info = moveInfos[i]; if (!info) return;
        const s = stats[mv.color]; s.loss += info.loss; s.count++;
        if (info.classification.tier === 'blunder') s.b++;
        if (info.classification.tier === 'mistake') s.m++;
        if (info.classification.tier === 'inaccuracy') s.i++;
        if (info.loss >= 100) worst.push({ idx: i, san: mv.san, moveNumber: mv.moveNumber, color: mv.color, loss: info.loss, symbol: info.classification.symbol, label: info.classification.label, color: info.classification.color });
    });
    if (!stats.w.count && !stats.b.count) return null;
    worst.sort((a, b) => b.loss - a.loss);

    const card = (label: string, s: typeof stats.w, isUser: boolean) => (
        <div className="card" style={{ background: 'var(--bg)' }}>
            <h3 style={{ fontSize: 14, margin: '0 0 10px' }}>{label} {isUser && <span style={{ color: 'var(--accent)', fontSize: 11 }}>(you)</span>}</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}><span style={{ color: 'var(--text-dim)' }}>Avg. centipawn loss</span><span style={{ fontFamily: 'var(--mono)' }}>{s.count ? Math.round(s.loss / s.count) : 0}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}><span style={{ color: 'var(--text-dim)' }}>Blunders</span><span style={{ fontFamily: 'var(--mono)', color: 'var(--blunder)' }}>{s.b}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}><span style={{ color: 'var(--text-dim)' }}>Mistakes</span><span style={{ fontFamily: 'var(--mono)', color: 'var(--mistake)' }}>{s.m}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}><span style={{ color: 'var(--text-dim)' }}>Inaccuracies</span><span style={{ fontFamily: 'var(--mono)', color: 'var(--inaccuracy)' }}>{s.i}</span></div>
        </div>
    );

    return (
        <div className="card">
            <div className="eyebrow" style={{ marginBottom: 10 }}>THE VERDICT</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {card('White', stats.w, userIsWhite)}
                {card('Black', stats.b, !userIsWhite)}
            </div>
            {worst.length > 0 && (
                <>
                    <h3 style={{ fontSize: 14, margin: '14px 0 0' }}>Biggest turning points</h3>
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 13 }}>
                        {worst.slice(0, 5).map(w => (
                            <li key={w.idx} onClick={() => onJump(w.idx + 1)} style={{ padding: '8px 10px', borderTop: '1px solid var(--line)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                                <span><span style={{ color: 'var(--text-dim)' }}>{w.moveNumber}{w.color === 'w' ? '.' : '…'}</span> <span style={{ fontFamily: 'var(--mono)', color: w.color, fontWeight: 600 }}>{w.san}</span> <span style={{ color: w.color }}>{w.symbol}</span> <span style={{ color: 'var(--text-dim)' }}>— {w.label}</span></span>
                                <span style={{ color: 'var(--blunder)', fontFamily: 'var(--mono)', fontSize: 12 }}>−{Math.round(w.loss)}cp</span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}
