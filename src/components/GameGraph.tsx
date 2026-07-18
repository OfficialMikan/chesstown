import type { PositionInfo } from '../lib/types';

export function GameGraph({ positions, currentPly, onSelect }: { positions: (PositionInfo | null)[]; currentPly: number; onSelect: (p: number) => void }) {
    const valid = positions.filter((p): p is PositionInfo => !!p);
    if (!valid.length) {
        return <div className="card" style={{ padding: 0, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>Run analysis to see the evaluation graph</div>;
    }
    const w = 600, h = 96, mid = h / 2;
    const n = valid.length;
    const clamp = (v: number) => Math.max(-1000, Math.min(1000, v));
    const pts = valid.map((p, i) => ({
        x: n === 1 ? 0 : (i / (n - 1)) * w,
        y: mid - (clamp(p.cpWhitePov) / 1000) * mid,
    }));
    const areaPts = `M0,${mid} L${pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')} L${w},${mid} Z`;
    const linePts = `M${pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')}`;
    return (
        <div className="card" style={{ padding: 12, marginTop: 12 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>ADVANTAGE OVER THE GAME</div>
            <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: 96, cursor: 'pointer' }} onClick={(e) => {
                const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
                const idx = Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1))));
                onSelect(idx);
            }}>
                <line x1="0" y1={mid} x2={w} y2={mid} stroke="var(--line)" />
                <path d={areaPts} fill="var(--accent-2)" opacity="0.15" />
                <path d={linePts} fill="none" stroke="var(--accent)" strokeWidth="1.8" />
                {currentPly < n && valid[currentPly] && (() => {
                    const x = n === 1 ? 0 : (currentPly / (n - 1)) * w;
                    const y = mid - (clamp(valid[currentPly].cpWhitePov) / 1000) * mid;
                    return <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r="3.8" fill="var(--accent-2)" stroke="var(--panel)" strokeWidth="1.5" />;
                })()}
            </svg>
        </div>
    );
}
