import { useEffect, useState } from 'react';

type Toast = { id: number; msg: string; type: 'info' | 'error' | 'success' };

let nextId = 1;
const listeners = new Set<(toasts: Toast[]) => void>();
let toasts: Toast[] = [];

export function pushToast(msg: string, type: Toast['type'] = 'info') {
    const t = { id: nextId++, msg, type };
    toasts = [...toasts, t];
    listeners.forEach(l => l(toasts));
    setTimeout(() => {
        toasts = toasts.filter(x => x.id !== t.id);
        listeners.forEach(l => l(toasts));
    }, 4000);
}

export function ToastContainer() {
    const [list, setList] = useState<Toast[]>(toasts);
    useEffect(() => {
        const fn = (t: Toast[]) => setList(t);
        listeners.add(fn);
        return () => { listeners.delete(fn); };
    }, []);
    return (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 999999, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {list.map(t => (
                <div key={t.id} className="card" style={{
                    padding: '10px 16px', minWidth: 240, fontSize: 13,
                    background: t.type === 'error' ? 'rgba(229,138,133,0.15)' : t.type === 'success' ? 'rgba(129,182,76,0.15)' : 'var(--panel-2)',
                    borderColor: t.type === 'error' ? 'var(--blunder)' : t.type === 'success' ? 'var(--accent)' : 'var(--line)',
                }}>{t.msg}</div>
            ))}
        </div>
    );
}
