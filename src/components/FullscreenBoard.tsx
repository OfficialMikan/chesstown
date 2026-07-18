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
    onFlip: () => void;
};

export function FullscreenBoard({ open, onClose, fen, lastMove, flipped, pos, onFlip }: Props) {
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

    const size = Math.min(window.innerWidth - 60, window.innerHeight - 80);

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
            <div onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
                <Board fen={fen} lastMove={lastMove} flipped={flipped} width={size}>
                    <ArrowsLayer
                        pv={pos?.pv ?? []}
                        flipped={flipped}
                        style="arrow"
                        pvColor="#96bc4b"
                        altColor="#6f6a62"
                        pvGradient={{ from: '#96bc4b', to: '#5c8bb0' }}
                        pvCustomGradient={false}
                        arrowWidth={20}
                        arrowOpacity={0.9}
                        showNumbers={true}
                        size={size}
                        bestUci={pos?.bestMoveUci ?? null}
                    />
                </Board>
                <button
                    onClick={onClose}
                    className="ghost"
                    style={{ position: 'absolute', top: -40, right: 0, fontSize: 14, padding: '6px 14px' }}
                >
                    × Close (Esc)
                </button>
                <div style={{ position: 'absolute', top: -40, left: 0, color: 'var(--text-dim)', fontSize: 12, fontFamily: 'var(--mono)' }}>
                    Press F to flip · Esc to close
                </div>
            </div>
        </div>
    );
}
