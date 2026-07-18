import { drawArrowPath, colorForMoveIndex } from '../lib/arrows';

type Props = {
    pv: string[];
    alternativeMoves?: { uci: string; san?: string }[];
    flipped: boolean;
    style: 'box' | 'arrow' | 'outline' | 'native';
    pvColor: string;
    altColor: string;
    pvGradient: { from: string; to: string };
    pvCustomGradient: boolean;
    arrowWidth: number;
    arrowOpacity: number;
    showNumbers: boolean;
    size: number;
    bestUci?: string | null;
};

const sq = (uci: string) => {
    const f = uci.charCodeAt(0) - 97 + (8 - parseInt(uci[1], 10)) * 8;
    const t = uci.charCodeAt(2) - 97 + (8 - parseInt(uci[3], 10)) * 8;
    return { f, t };
};

export function ArrowsLayer({
    pv, alternativeMoves = [], flipped, style, pvColor, altColor,
    pvGradient, pvCustomGradient, arrowWidth, arrowOpacity, showNumbers, size, bestUci,
}: Props) {
    const bestMoves = bestUci ? [bestUci] : pv.slice(0, 1);
    const continuationMoves = pv.slice(1, 5);
    const altUcis = alternativeMoves
        .map(a => a.uci)
        .filter(u => u && !bestMoves.includes(u) && !continuationMoves.includes(u))
        .slice(0, 3);

    return (
        <svg
            viewBox="0 0 100 100"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            preserveAspectRatio="none"
        >
            {style === 'arrow' && altUcis.map((u, i) => {
                const { f, t } = sq(u);
                const p = drawArrowPath(f, t, flipped, arrowWidth * 0.7, arrowOpacity * 0.5);
                if (!p) return null;
                return (
                    <g key={'alt-' + i}>
                        <line {...p.line} stroke={altColor} strokeLinecap="round" strokeDasharray="1.5,1" />
                        <polygon points={p.head} fill={altColor} opacity={arrowOpacity * 0.5} />
                    </g>
                );
            })}

            {style === 'arrow' && continuationMoves.map((u, i) => {
                const { f, t } = sq(u);
                const p = drawArrowPath(f, t, flipped, arrowWidth * 0.6, arrowOpacity * 0.6);
                if (!p) return null;
                const c = colorForMoveIndex(i + 1, continuationMoves.length, pvGradient, pvCustomGradient);
                return (
                    <g key={'pv-' + i} opacity={0.7}>
                        <line {...p.line} stroke={c} strokeLinecap="round" />
                        <polygon points={p.head} fill={c} opacity={arrowOpacity * 0.6} />
                        {showNumbers && (
                            <text x={(p.line.x1! + p.line.x2!) / 2} y={(p.line.y1! + p.line.y2!) / 2} dy="0.3em" textAnchor="middle" fontSize="2" fontWeight="700" fill="#fff" stroke="#000" strokeWidth="0.1">
                                {i + 2}
                            </text>
                        )}
                    </g>
                );
            })}

            {style === 'arrow' && bestMoves.map((u, i) => {
                const { f, t } = sq(u);
                const p = drawArrowPath(f, t, flipped, arrowWidth, arrowOpacity);
                if (!p) return null;
                return (
                    <g key={'best-' + i}>
                        <line {...p.line} stroke={pvColor} strokeLinecap="round" />
                        <polygon points={p.head} fill={pvColor} opacity={arrowOpacity} />
                        {showNumbers && (
                            <text x={(p.line.x1! + p.line.x2!) / 2} y={(p.line.y1! + p.line.y2!) / 2} dy="0.3em" textAnchor="middle" fontSize="2.4" fontWeight="700" fill="#000" stroke="#fff" strokeWidth="0.2">
                                1
                            </text>
                        )}
                    </g>
                );
            })}

            {style === 'box' && pv.slice(0, 3).map((m, i) => {
                const { f, t } = sq(m);
                return (
                    <g key={i} opacity={i === 0 ? 1 : 0.4}>
                        <rect x={(f & 7) * 12.5} y={(7 - (f >> 3)) * 12.5} width="12.5" height="12.5" fill={pvColor} opacity="0.35" />
                        <rect x={(t & 7) * 12.5} y={(7 - (t >> 3)) * 12.5} width="12.5" height="12.5" fill={pvColor} opacity="0.35" />
                    </g>
                );
            })}

            {style === 'outline' && pv.slice(0, 3).map((m, i) => {
                const { f, t } = sq(m);
                return (
                    <g key={i} fill="none" stroke={pvColor} strokeWidth="0.6" opacity={i === 0 ? 1 : 0.5}>
                        <rect x={(f & 7) * 12.5 + 0.5} y={((7 - (f >> 3)) * 12.5) + 0.5} width="11.5" height="11.5" />
                        <rect x={(t & 7) * 12.5 + 0.5} y={((7 - (t >> 3)) * 12.5) + 0.5} width="11.5" height="11.5" />
                    </g>
                );
            })}
        </svg>
    );
}
