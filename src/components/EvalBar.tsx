import { winProbToBarPct } from '../lib/evalMath';
import type { PositionInfo } from '../lib/types';

export function EvalBar({ pos, height = 360, width = 22 }: { pos: PositionInfo | null; height?: number; width?: number }) {
    const cp = pos?.cpWhitePov ?? 0;
    const pct = pos ? winProbToBarPct(cp) : 50;
    const text = !pos ? '—' : (Math.abs(cp) >= 9900 ? (cp > 0 ? '#+M' : '#-M') : (cp >= 0 ? '+' : '') + (cp / 100).toFixed(2));
    return (
        <div style={{ position: 'relative', width, height, background: '#1a1a1a', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--line)' }}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: `${100 - pct}%`, background: 'linear-gradient(180deg, #1a1a1a 0%, #2a2a2a 100%)', transition: 'height 0.25s ease' }} />
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${pct}%`, background: 'linear-gradient(180deg, #ffffff 0%, #d8d4c2 100%)', transition: 'height 0.25s ease' }} />
            <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, mixBlendMode: 'difference', color: '#fff', pointerEvents: 'none' }}>
                {text}
            </div>
        </div>
    );
}
