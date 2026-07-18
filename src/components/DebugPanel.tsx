import { useEffect, useState } from 'react';
import { logger, LogEntry } from '../lib/logger';
import { pushToast } from './Toast';

type Test = { ok: boolean; ms: number; error?: string };

export function DebugPanel() {
    const [open, setOpen] = useState(false);
    const [entries, setEntries] = useState<LogEntry[]>(logger.getEntries());
    const [filter, setFilter] = useState<'all' | 'error' | 'warn'>('all');
    const [running, setRunning] = useState(false);
    const [tests, setTests] = useState<Record<string, Test> | null>(null);

    useEffect(() => logger.subscribe(setEntries), []);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.ctrlKey && e.key === '`') { e.preventDefault(); setOpen(o => !o); } };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const runDiagnostic = async () => {
        setRunning(true);
        setTests(null);
        try {
            const r = await fetch('/api/test-engine', { method: 'POST' });
            if (!r.ok) { pushToast('Diagnostic endpoint failed: HTTP ' + r.status, 'error'); return; }
            const j = await r.json();
            setTests(j.tests);
            const summary = j.summary;
            pushToast(
                summary.allPassed ? `All ${summary.total} tests passed ✅` : `${summary.passed}/${summary.total} tests passed`,
                summary.allPassed ? 'success' : 'error'
            );
        } catch (e: any) {
            pushToast('Diagnostic failed: ' + e.message, 'error');
        } finally {
            setRunning(false);
        }
    };

    const filtered = entries.filter(e => filter === 'all' || e.level === filter);
    const errors = entries.filter(e => e.level === 'error').length;
    const warns = entries.filter(e => e.level === 'warn').length;

    return (
        <>
            <button
                onClick={() => setOpen(o => !o)}
                title="Debug (Ctrl+`)"
                style={{
                    position: 'fixed', bottom: 12, right: 12, zIndex: 9999,
                    background: errors > 0 ? 'var(--blunder)' : 'var(--panel-2)',
                    color: errors > 0 ? '#fff' : 'var(--text)',
                    border: '1px solid var(--line)', borderRadius: 20, padding: '6px 12px',
                    fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                }}
            >
                🔧 debug
                {errors > 0 && <span style={{ background: '#fff', color: 'var(--blunder)', borderRadius: 10, padding: '0 6px', fontSize: 10 }}>{errors}</span>}
                {warns > 0 && <span style={{ background: 'var(--mistake)', color: '#000', borderRadius: 10, padding: '0 6px', fontSize: 10 }}>{warns}</span>}
            </button>

            {open && (
                <div style={{
                    position: 'fixed', bottom: 56, right: 12, zIndex: 9999,
                    width: 520, maxHeight: '70vh', background: 'var(--panel)', border: '1px solid var(--line)',
                    borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--line)', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                            {(['all', 'warn', 'error'] as const).map(f => (
                                <button key={f} onClick={() => setFilter(f)} className={filter === f ? '' : 'ghost'} style={{ fontSize: 10, padding: '3px 8px' }}>{f}</button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={runDiagnostic} disabled={running} className="ghost" style={{ fontSize: 10, padding: '3px 8px' }}>
                                {running ? '⏳ running…' : '🩺 Run diagnostic'}
                            </button>
                            <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(filtered, null, 2)); }} className="ghost" style={{ fontSize: 10, padding: '3px 8px' }}>Copy</button>
                            <button onClick={() => logger.clear()} className="ghost" style={{ fontSize: 10, padding: '3px 8px' }}>Clear</button>
                            <button onClick={() => setOpen(false)} className="ghost" style={{ fontSize: 10, padding: '3px 8px' }}>×</button>
                        </div>
                    </div>

                    {tests && (
                        <div style={{ padding: 12, borderBottom: '1px solid var(--line)', fontSize: 12 }}>
                            <div className="eyebrow" style={{ marginBottom: 6 }}>ENGINE DIAGNOSTIC</div>
                            {Object.entries(tests).map(([name, t]) => (
                                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                                    <span style={{ fontFamily: 'var(--mono)' }}>{name}</span>
                                    <span style={{ color: t.ok ? 'var(--accent)' : 'var(--blunder)' }}>
                                        {t.ok ? '✅' : '❌'} {t.ms}ms {t.error ? `(${t.error.slice(0, 40)})` : ''}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{ flex: 1, overflowY: 'auto', fontFamily: 'var(--mono)', fontSize: 11, padding: 8 }}>
                        {filtered.length === 0 && <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 16 }}>No log entries.</div>}
                        {filtered.slice().reverse().map((e, i) => (
                            <div key={i} style={{ borderLeft: `3px solid ${levelColor(e.level)}`, paddingLeft: 8, marginBottom: 6 }}>
                                <div style={{ display: 'flex', gap: 8, color: 'var(--text-dim)' }}>
                                    <span style={{ color: levelColor(e.level), fontWeight: 700, textTransform: 'uppercase' }}>{e.level}</span>
                                    <span>{e.tag}</span>
                                    <span style={{ marginLeft: 'auto' }}>{new Date(e.ts).toLocaleTimeString()}</span>
                                </div>
                                <div style={{ color: 'var(--text)' }}>{e.msg}</div>
                                {e.data !== undefined && (
                                    <pre style={{ color: 'var(--text-dim)', margin: '2px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{typeof e.data === 'string' ? e.data : JSON.stringify(e.data, null, 2)}</pre>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}

function levelColor(l: string) {
    return l === 'error' ? 'var(--blunder)' : l === 'warn' ? 'var(--mistake)' : 'var(--accent)';
}
