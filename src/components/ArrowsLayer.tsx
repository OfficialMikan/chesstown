import { drawArrowPath, colorForMoveIndex } from '../lib/arrows';

type Props = {
    pv: string[];            // UCI moves
    flipped: boolean;
    style: 'box' | 'arrow' | 'outline' | 'native';
    color: string;
    pvGradient: { from: string; to: string };
    pvCustomGradient: boolean;
    arrowWidth: number;
    arrowOpacity: number;
    showNumbers: boolean;
    size: number;
};

const sq = (uci: string) => {
    const f = uci.charCodeAt(0) - 97 + (8 - parseInt(uci[1], 10)) * 8;
    const t = uci.charCodeAt(2) - 97 + (8 - parseInt(uci[3], 10)) * 8;
    return { f, t };
};

export function ArrowsLayer({ pv, flipped, style, color, pvGradient, pvCustomGradient, arrowWidth, arrowOpacity, showNumbers, size }: Props) {
    if (!pv.length) return null;
    const moves = pv.slice(0, 5);
    return (
        <svg
            viewBox="0 0 100 100"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            preserveAspectRatio="none"
        >
            {style === 'box' && moves.map((m, i) => {
                const { f, t } = sq(m);
                const opacity = arrowOpacity * (1 - i * 0.15);
                return (
                    <g key={i} opacity={opacity}>
                        <rect x={(f & 7) * 12.5} y={((7 - (f >> 3)) * 12.5)} width="12.5" height="12.5" fill={color} opacity="0.35" />
                        <rect x={(t & 7) * 12.5} y={((7 - (t >> 3)) * 12.5)} width="12.5" height="12.5" fill={color} opacity="0.35" />
                    </g>
                );
            })}
            {style === 'arrow' && moves.map((m, i) => {
                const { f, t } = sq(m);
                const p = drawArrowPath(f, t, flipped, arrowWidth, arrowOpacity);
                if (!p) return null;
                const c = colorForMoveIndex(i, moves.length, pvGradient, pvCustomGradient);
                return (
                    <g key={i} opacity={arrowOpacity}>
                        <line {...p.line} stroke={c} strokeLinecap="round" />
                        <polygon points={p.head} fill={c} />
                        {showNumbers && (
                            <text x={(p.line.x1! + p.line.x2!) / 2} y={(p.line.y1! + p.line.y2!) / 2} dy="0.3em" textAnchor="middle" fontSize="2.2" fontWeight="700" fill="#fff" stroke="#000" strokeWidth="0.1">
                                {i + 1}
                            </text>
                        )}
                    </g>
                );
            })}
            {style === 'outline' && moves.map((m, i) => {
                const { f, t } = sq(m);
                const c = colorForMoveIndex(i, moves.length, pvGradient, pvCustomGradient);
                const opacity = arrowOpacity;
                return (
                    <g key={i} fill="none" stroke={c} strokeWidth="0.6" opacity={opacity}>
                        <rect x={(f & 7) * 12.5 + 0.5} y={((7 - (f >> 3)) * 12.5) + 0.5} width="11.5" height="11.5" />
                        <rect x={(t & 7) * 12.5 + 0.5} y={((7 - (t >> 3)) * 12.5) + 0.5} width="11.5" height="11.5" />
                    </g>
                );
            })}
        </svg>
    );
}
