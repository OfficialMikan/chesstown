import { useMemo } from 'react';
import { detectOpening } from '../lib/openings';

type Props = { sanMoves: string[] };

export function OpeningName({ sanMoves }: Props) {
    const opening = useMemo(() => detectOpening(sanMoves), [sanMoves]);
    if (!opening) return null;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg)', borderRadius: 4, marginBottom: 8 }}>
            <span className="eyebrow" style={{ color: 'var(--text-dim)' }}>{opening.eco}</span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{opening.name}</span>
        </div>
    );
}
