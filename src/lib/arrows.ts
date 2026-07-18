// Convert a board square (0..63) to a percentage coord on the SVG
export function sqCoord(sq: number, flipped: boolean): { x: number; y: number } {
    const file = sq & 7;
    const rank = sq >> 3;
    if (flipped) return { x: ((7 - file) * 100) / 8 + 6.25, y: (rank * 100) / 8 + 6.25 };
    return { x: (file * 100) / 8 + 6.25, y: ((7 - rank) * 100) / 8 + 6.25 };
}

export type ArrowStyle = 'box' | 'arrow' | 'outline' | 'native';

export function drawArrowPath(from: number, to: number, flipped: boolean, width = 15, opacity = 0.85) {
    const a = sqCoord(from, flipped);
    const b = sqCoord(to, flipped);
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (!len) return null;
    const ux = dx / len, uy = dy / len;
    const scale = width / 15;
    const headLen = 4 * scale, headWidth = 3 * scale, lineW = 1.2 * scale;
    const endX = b.x - ux * headLen;
    const endY = b.y - uy * headLen;
    const px = -uy, py = ux;
    return {
        line: { x1: a.x, y1: a.y, x2: endX, y2: endY, strokeWidth: lineW },
        head: `${b.x},${b.y} ${endX + px * (headWidth / 2)},${endY + py * (headWidth / 2)} ${endX - px * (headWidth / 2)},${endY - py * (headWidth / 2)}`,
        opacity,
    };
}

export function colorForMoveIndex(i: number, n: number, gradient: { from: string; to: string }, custom = false) {
    if (!custom) return 'rgba(255, 255, 0, 0.85)';
    const f = n === 1 ? 0 : i / (n - 1);
    const hex = (h: string) => parseInt(h.slice(1), 16);
    const a = hex(gradient.from), b = hex(gradient.to);
    const mix = (x: number) => Math.round((a >> ((2 - x) * 8) & 0xff) * (1 - f) + (b >> ((2 - x) * 8) & 0xff) * f);
    return `rgb(${mix(0)}, ${mix(1)}, ${mix(2)})`;
}
