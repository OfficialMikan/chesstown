import { useState } from 'react';
import type { EngineModelId } from '../lib/types';

type Model = { id: EngineModelId; label: string; maxDepth: number };

type Props = {
    modelId: EngineModelId;
    onModelChange: (id: EngineModelId) => void;
    onClose: () => void;
    models: Model[];
};

export function EngineSettingsModal({ modelId, onModelChange, onClose, models }: Props) {
    const m = models.find(x => x.id === modelId) ?? models[0];
    const [selected, setSelected] = useState(modelId);

    const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(2px)' };
    const modalBox: React.CSSProperties = { background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 8, width: 480, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' };
    const header: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--line)' };
    const fullSelect: React.CSSProperties = { width: '100%', padding: '8px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: 5 };

    return (
        <div style={overlay} onClick={onClose}>
            <div onClick={e => e.stopPropagation()} style={modalBox}>
                <div style={header}>
                    <h3 style={{ margin: 0, fontSize: 14, color: 'var(--accent)', letterSpacing: '.04em' }}>ENGINE SETTINGS</h3>
                    <button onClick={onClose} className="ghost" style={{ padding: 0, width: 26, height: 26 }}>×</button>
                </div>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                        <div className="eyebrow" style={{ marginBottom: 6 }}>ENGINE</div>
                        <select value={selected} onChange={e => { setSelected(e.target.value as EngineModelId); onModelChange(e.target.value as EngineModelId); }} style={fullSelect}>
                            {models.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                        </select>
                        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-dim)' }}>
                            {m.id === 'cloud' && '☁️ Cloud Stockfish runs on Vercel servers, no download required. Works on any device including phones.'}
                            {m.id !== 'cloud' && '⚠️ Local engines require a WebAssembly download and may fail on low-memory devices.'}
                        </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: 12, background: 'var(--bg)', borderRadius: 5 }}>
                        <b>How it works:</b> Each position is sent to <code>/api/analyze</code> which calls a public Stockfish cloud endpoint and returns the eval + best move. Positions are cached on Vercel's edge for 24h.
                    </div>
                </div>
            </div>
        </div>
    );
}
