import { useState, useEffect } from 'react';

export type Theme = {
    boardLight: string;
    boardDark: string;
    highlight: string;
    lastMove: string;
    activeCell: string;
    arrow: string;
    pvStart: string;
    pvEnd: string;
    arrowStyle: 'box' | 'arrow' | 'outline' | 'native';
    pvCustomGradient: boolean;
    showPVNumbers: boolean;
    arrowWidth: number;
    arrowOpacity: number;
};

export const DEFAULT_THEME: Theme = {
    boardLight: '#eeeed2',
    boardDark: '#769656',
    highlight: '#facc15',
    lastMove: '#baca44',
    activeCell: '#312e2b',
    arrow: '#facc15',
    pvStart: '#FFFF00',
    pvEnd: '#FF0000',
    arrowStyle: 'arrow',
    pvCustomGradient: false,
    showPVNumbers: false,
    arrowWidth: 15,
    arrowOpacity: 0.85,
};

export const PRESETS: Record<string, Partial<Theme>> = {
    ChessCom: {
        boardLight: '#eeeed2', boardDark: '#769656',
        highlight: '#facc15', lastMove: '#baca44', activeCell: '#312e2b',
    },
    Lichess: {
        boardLight: '#f0d9b5', boardDark: '#b58863',
        highlight: '#facc15', lastMove: '#cdd26a', activeCell: '#3a3a3a',
    },
    Green: {
        boardLight: '#ebecd0', boardDark: '#779556',
        highlight: '#facc15', lastMove: '#f7ec5d', activeCell: '#312e2b',
    },
    Blue: {
        boardLight: '#dee3e6', boardDark: '#8ca2ad',
        highlight: '#facc15', lastMove: '#cdd26a', activeCell: '#1a2332',
    },
    Wood: {
        boardLight: '#e8c391', boardDark: '#a17149',
        highlight: '#facc15', lastMove: '#caa663', activeCell: '#2a1a10',
    },
};

export function ThemePanel({ value, onChange, onClose }: { value: Theme; onChange: (t: Theme) => void; onClose: () => void }) {
    const [t, setT] = useState<Theme>(value);

    useEffect(() => { onChange(t); }, [t, onChange]);

    const update = <K extends keyof Theme>(k: K, v: Theme[K]) => setT(prev => ({ ...prev, [k]: v }));
    const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(2px)' };

    return (
        <div style={overlay} onClick={onClose}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 8, width: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
                    <h3 style={{ margin: 0, fontSize: 14, color: 'var(--accent)', letterSpacing: '.04em' }}>BOARD THEME & ARROWS</h3>
                    <button onClick={onClose} className="ghost" style={{ padding: 0, width: 26, height: 26 }}>×</button>
                </div>

                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                        <div className="eyebrow" style={{ marginBottom: 8 }}>PRESETS</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                            {Object.entries(PRESETS).map(([name, p]) => (
                                <button key={name} onClick={() => setT(prev => ({ ...prev, ...p }))} className="ghost" style={{ fontSize: 11, padding: '6px 0' }}>{name}</button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="eyebrow" style={{ marginBottom: 8 }}>BOARD COLORS</div>
                        <ColorRow label="Light squares" value={t.boardLight} onChange={v => update('boardLight', v)} />
                        <ColorRow label="Dark squares" value={t.boardDark} onChange={v => update('boardDark', v)} />
                        <ColorRow label="Last move highlight" value={t.lastMove} onChange={v => update('lastMove', v)} />
                        <ColorRow label="Active cell" value={t.activeCell} onChange={v => update('activeCell', v)} />
                    </div>

                    <div>
                        <div className="eyebrow" style={{ marginBottom: 8 }}>ARROWS</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {(['box', 'arrow', 'outline', 'native'] as const).map(s => (
                                <button key={s} onClick={() => update('arrowStyle', s)} className={t.arrowStyle === s ? '' : 'ghost'} style={{ fontSize: 11, padding: '6px 10px' }}>{s}</button>
                            ))}
                        </div>
                        <ColorRow label="Arrow color" value={t.arrow} onChange={v => update('arrow', v)} />
                        <SliderRow label="Arrow width" min={5} max={30} value={t.arrowWidth} onChange={v => update('arrowWidth', v)} />
                        <SliderRow label="Arrow opacity" min={0.1} max={1} step={0.05} value={t.arrowOpacity} onChange={v => update('arrowOpacity', v)} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                            <input type="checkbox" checked={t.showPVNumbers} onChange={e => update('showPVNumbers', e.target.checked)} id="pvNums" />
                            <label htmlFor="pvNums" style={{ fontSize: 13 }}>Show move numbers on PV arrows</label>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                            <input type="checkbox" checked={t.pvCustomGradient} onChange={e => update('pvCustomGradient', e.target.checked)} id="pvGrad" />
                            <label htmlFor="pvGrad" style={{ fontSize: 13 }}>Custom PV gradient</label>
                        </div>
                        {t.pvCustomGradient && (
                            <>
                                <ColorRow label="PV start" value={t.pvStart} onChange={v => update('pvStart', v)} />
                                <ColorRow label="PV end" value={t.pvEnd} onChange={v => update('pvEnd', v)} />
                            </>
                        )}
                    </div>

                    <button onClick={() => setT(DEFAULT_THEME)} className="ghost">Reset to defaults</button>
                </div>
            </div>
        </div>
    );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: 13 }}>{label}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="text" value={value} onChange={e => onChange(e.target.value)} style={{ width: 90, fontFamily: 'var(--mono)', fontSize: 12, textAlign: 'center' }} />
                <input type="color" value={value} onChange={e => onChange(e.target.value)} style={{ width: 32, height: 26, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }} />
            </div>
        </div>
    );
}

function SliderRow({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step?: number; value: number; onChange: (v: number) => void }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: 13 }}>{label}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, marginLeft: 12 }}>
                <input type="range" min={min} max={max} step={step ?? 1} value={value} onChange={e => onChange(+e.target.value)} style={{ flex: 1 }} />
                <input type="number" min={min} max={max} step={step ?? 1} value={value} onChange={e => onChange(+e.target.value)} style={{ width: 60, fontFamily: 'var(--mono)', textAlign: 'center' }} />
            </div>
        </div>
    );
}
