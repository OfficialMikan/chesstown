import { useEffect, useRef, ReactNode } from 'react';
import { fenToBoard } from '../lib/chess';

type Props = {
    fen: string;
    lastMove?: { fromRow: number; fromCol: number; toRow: number; toCol: number } | null;
    flipped: boolean;
    width?: number;
    children?: ReactNode;
};

export function Board({ fen, lastMove, flipped, width = 360, children }: Props) {
    const ref = useRef<SVGSVGElement>(null);
    const sqRefs = useRef<SVGRectElement[][]>([]);
    const hlRefs = useRef<SVGRectElement[][]>([]);
    const pieceRefs = useRef<SVGUseElement[][]>([]);

    useEffect(() => {
        const svg = ref.current!;
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        const ns = 'http://www.w3.org/2000/svg';
        sqRefs.current = []; hlRefs.current = []; pieceRefs.current = [];
        const s = 360 / 8;
        for (let r = 0; r < 8; r++) {
            const sqRow: SVGRectElement[] = [], hlRow: SVGRectElement[] = [], pRow: SVGUseElement[] = [];
            for (let c = 0; c < 8; c++) {
                const rect = document.createElementNS(ns, 'rect');
                rect.setAttribute('x', String(c * s));
                rect.setAttribute('y', String(r * s));
                rect.setAttribute('width', String(s));
                rect.setAttribute('height', String(s));
                svg.appendChild(rect);
                sqRow.push(rect);

                const hl = document.createElementNS(ns, 'rect');
                hl.setAttribute('x', String(c * s));
                hl.setAttribute('y', String(r * s));
                hl.setAttribute('width', String(s));
                hl.setAttribute('height', String(s));
                hl.setAttribute('fill', '#baca44');
                hl.setAttribute('opacity', '0');
                hl.setAttribute('pointer-events', 'none');
                svg.appendChild(hl);
                hlRow.push(hl);

                const use = document.createElementNS(ns, 'use');
                use.setAttribute('x', String(c * s));
                use.setAttribute('y', String(r * s));
                use.setAttribute('width', String(s));
                use.setAttribute('height', String(s));
                svg.appendChild(use);
                pRow.push(use);
            }
            sqRefs.current.push(sqRow);
            hlRefs.current.push(hlRow);
            pieceRefs.current.push(pRow);
        }
    }, []);

    useEffect(() => {
        const board = fenToBoard(fen);
        const s = 360 / 8;
        for (let vr = 0; vr < 8; vr++) {
            for (let vc = 0; vc < 8; vc++) {
                const br = flipped ? 7 - vr : vr;
                const bc = flipped ? 7 - vc : vc;
                const dark = ((7 - br) + bc) % 2 === 0;
                sqRefs.current[vr][vc].setAttribute('fill', dark ? '#769656' : '#eeeed2');
                const isLast = !!lastMove && (
                    (lastMove.fromRow === br && lastMove.fromCol === bc) ||
                    (lastMove.toRow === br && lastMove.toCol === bc)
                );
                hlRefs.current[vr][vc].setAttribute('opacity', isLast ? '0.6' : '0');
                const piece = board[br][bc];
                const pn = pieceRefs.current[vr][vc];
                if (piece) {
                    const isWhite = piece === piece.toUpperCase();
                    pn.setAttribute('href', `/pieces/cburnett/${isWhite ? 'w' : 'b'}${piece.toUpperCase()}.svg`);
                    pn.setAttribute('color', isWhite ? '#ffffff' : '#1a1a1a');
                } else {
                    pn.removeAttribute('href');
                }
            }
        }
    }, [fen, lastMove, flipped]);

    return (
        <div style={{ position: 'relative', display: 'block', width: '100%' }}>
            <svg
                ref={ref}
                viewBox="0 0 360 360"
                xmlns="http://www.w3.org/2000/svg"
                aria-label="Chess board"
                style={{ display: 'block', width: '100%', background: '#eeeed2', borderRadius: 5, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
            />
            {children}
        </div>
    );
}
