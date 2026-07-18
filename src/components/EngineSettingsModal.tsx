import { useState } from 'react';
import { LOCAL_ENGINES, getEngineById } from '../engine/localEngines';
import type { EngineModelId } from '../engine/types';

type Props = {
    modelId: EngineModelId;
    onModelChange: (id: EngineModelId) => void;
    onOptionsChange: (opts: { hashMB: number; skillLevel: number; elo: number; limitStrength: boolean }) => void;
    onReinstall: () => void;
    onUninstall: () => void;
    engineStatus: 'not_installed' | 'loading' | 'ready' | 'error';
    engineStatusMsg: string;
    onClose: () => void;
    onLoad: () => void;
};

export function EngineSettingsModal({ modelId, onModelChange, onOptionsChange, onReinstall, onUninstall, engineStatus, engineStatusMsg, onClose, onLoad }: Props) {
    const m = getEngineById(modelId);
    const [opts, setOpts] = useState({ ...m.defaults, hashMB: m.defaults.hashMB, skillLevel: m.defaults.skillLevel ?? 20, elo: m.defaults.elo ?? 3190, limitStrength: m.defaults.limitStrength ?? false });
    const apply = (next: typeof opts) => { setOpts(next); onOptionsChange(next); };
    return (
        <div style={overlay}>
            <div style={modalBox}>
                <div style={header}>
                    <h3 style={{ margin: 0, fontSize: 14, color: 'var(--accent)', letterSpacing: '.04em' }}>LOCAL ENGINE SETTINGS</h3>
                    <button onClick={onClose} className="ghost" style={{ padding: 0, width: 26, height: 26 }}>×</button>
                </div>
                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                        <div className="eyebrow" style={{ marginBottom: 6 }}>ENGINE MODEL</div>
                        <select value={modelId} onChange={e => onModelChange(e.target.value as EngineModelId)} style={fullSelect}>
                            {LOCAL_ENGINES.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                        </select>
                        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
                            Format: {m.format === 'asmjs' ? 'asm.js' : 'WASM'} · Max depth: {m.maxDepth}
                        </div>
                    </div>

                    <div>
                        <div className="eyebrow" style={{ marginBottom: 6 }}>STATUS</div>
                        <div style={{ fontWeight: 700, color: statusColor(engineStatus) }}>{statusLabel(engineStatus)}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-dim)', minHeight: 16 }}>{engineStatusMsg}</div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                            <button onClick={onLoad} disabled={engineStatus === 'ready' || engineStatus === 'loading'} style={{ background: '#27ae60', color: '#fff' }}>Install / Load</button>
                            <button onClick={onReinstall} style={{ background: '#2980b9', color: '#fff' }}>Reinstall</button>
                            <button onClick={onUninstall} style={{ background: '#c0392b', color: '#fff' }}>Uninstall</button>
                        </div>
                    </div>

                    <div>
                        <div className="eyebrow" style={{ marginBottom: 6 }}>ENGINE OPTIONS</div>
                        <Row label="Hash (MB)">
                            <input type="number" min={1} max={2048} value={opts.hashMB} onChange={e => apply({ ...opts, hashMB: +e.target.value || 16 })} style={numInput} />
                        </Row>
                        {m.caps.hasSkillLevel && (
                            <Row label="Skill Level (0–20)">
                                <input type="range" min={0} max={20} value={opts.skillLevel} onChange={e => apply({ ...opts, skillLevel: +e.target.value })} style={{ flex: 1 }} />
                                <input type="number" min={0} max={20} value={opts.skillLevel} onChange={e => apply({ ...opts, skillLevel: +e.target.value || 20 })} style={numInput} />
                            </Row>
                        )}
                        {m.caps.hasNNUE && (
                            <>
                                <Row label="Limit to Elo">
                                    <input type="checkbox" checked={opts.limitStrength} onChange={e => apply({ ...opts, limitStrength: e.target.checked })} />
                                </Row>
                                {opts.limitStrength && (
                                    <Row label="Target Elo (1320–3190)">
                                        <input type="number" min={1320} max={3190} value={opts.elo} onChange={e => apply({ ...opts, elo: +e.target.value || 3190 })} style={numInput} />
                                    </Row>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>{label}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' }}>{children}</div>
    </div>
);

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(2px)' };
const modalBox: React.CSSProperties = { background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 8, width: 480, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' };
const header: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--line)' };
const fullSelect: React.CSSProperties = { width: '100%', padding: '8px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: 5 };
const numInput: React.CSSProperties = { width: 70, padding: '4px 6px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: 4, textAlign: 'center' };

function statusColor(s: string) { return s === 'ready' ? 'var(--accent)' : s === 'loading' ? '#ffaa00' : s === 'error' ? 'var(--blunder)' : 'var(--blunder)'; }
function statusLabel(s: string) { return ({ ready: '✅ Ready', loading: '⏳ Loading…', not_installed: '❌ Not Installed', error: '⚠️ Error' } as any)[s] ?? s; }
