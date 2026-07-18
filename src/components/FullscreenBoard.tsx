import { useEffect } from 'react';
import { Board } from './Board';
import { ArrowsLayer } from './ArrowsLayer';
import type { PositionInfo } from '../lib/types';

type Props = {
    open: boolean;
    onClose: () => void;
    fen: string;
    lastMove: { fromRow: number; fromCol: number; toRow: number; toCol: number } | null;
    flipped: boolean;
    pos: PositionInfo | null;
    showPV: boolean;
    showAlt: boolean;
    onFlip: () => void;
};

export function FullscreenBoard({ open, onClose, fen, lastMove, flipped, pos, showPV, showAlt, onFlip }: Props) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'f') onFlip();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose, onFlip]);

    if (!open) return null;

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 99999,
                background: 'rgba(0,0,0,0.92)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 20,
            }}
        >
            <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
                <Board fen={fen} lastMove={lastMove} flipped={flipped} width={Math.min(window.innerWidth - 60, window.innerHeight - 60)}>
                    <ArrowsLayer
                        pv={pos?.pv ?? []}
                        flipped={flipped}
                        style="arrow"
                        pvColor="#facc15"
                        altColor="#94a3b8"
                        pvGradient={{ from: '#FFFF00', to: '#FF0000' }}
                        pvCustomGradient={false}
                        arrowWidth={20}
                        arrowOpacity={0.9}
                        showNumbers={true}
                        size={600}
                    />
                </Board>
                <button
                    onClick={onClose}
                    className="ghost"
                    style={{ position: 'absolute', top: -40, right: 0, fontSize: 14, padding: '6px 14px' }}
                >
                    ✕ Close (Esc)
                </button>
                <div style={{ position: 'absolute', top: -40, left: 0, color: 'var(--text-dim)', fontSize: 12, fontFamily: 'var(--mono)' }}>
                    Press F to flip · Esc to close
                </div>
            </div>
        </div>
    );
}
