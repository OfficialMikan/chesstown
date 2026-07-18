import type { MoveInfo } from '../lib/types';

type Props = {
    moves: { ply: number; moveNumber: number; color: 'w' | 'b'; san: string }[];
    moveInfos: (MoveInfo | null)[];
    currentPly: number;
    onSelect: (ply: number) => void;
};

export function MoveList({ moves, moveInfos, currentPly, onSelect }: Props) {
    if (!moves.length) return <div className="card"><p style={{ color: 'var(--text-dim)' }}>No moves to display.</p></div>;
    const rows: JSX.Element[] = [];
    for (let i = 0; i < moves.length; i += 2) {
        const w = moves[i], b = moves[i + 1];
        const wInfo = moveInfos[i], bInfo = moveInfos[i + 1];
        rows.push(
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '38px 1fr 1fr', fontFamily: 'var(--mono)', fontSize: 13, borderBottom: '1px solid var(--line)' }}>
                <div style={{ color: 'var(--text-dim)', padding: '7px 10px' }}>{w.moveNumber}.</div>
                <Cell ply={i + 1} san={w.san} info={wInfo} active={currentPly === i + 1} onClick={onSelect} />
                {b
                    ? <Cell ply={i + 2} san={b.san} info={bInfo} active={currentPly === i + 2} onClick={onSelect} />
                    : <div style={{ borderLeft: '1px solid var(--line)' }} />}
            </div>
        );
    }
    return (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }} className="eyebrow">MOVE LIST</div>
            <div style={{ maxHeight: 340, overflowY: 'auto' }}>{rows}</div>
        </div>
    );
}

function Cell({ ply, san, info, active, onClick }: { ply: number; san: string; info: MoveInfo | null; active: boolean; onClick: (p: number) => void }) {
    return (
        <div
            onClick={() => onClick(ply)}
            style={{
                padding: '7px 10px',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                borderLeft: '1px solid var(--line)',
                position: 'relative',
                background: active ? 'var(--active-cell)' : 'transparent',
            }}
        >
            {active && <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--last-move)' }} />}
            <span style={{ color: info?.classification.color }}>{san}</span>
            {info?.classification.symbol && <span style={{ color: info.classification.color, fontWeight: 700, fontSize: 12 }}>{info.classification.symbol}</span>}
        </div>
    );
}
