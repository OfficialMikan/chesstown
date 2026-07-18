type Props = { open: boolean; onClose: () => void };

const SHORTCUTS: [string, string][] = [
    ['← / →', 'Previous / next move'],
    ['↑ / ↓', 'Jump to start / end of game'],
    ['F', 'Flip board (in fullscreen)'],
    ['?', 'Toggle this help dialog'],
    ['Esc', 'Close fullscreen / dialogs'],
    ['Ctrl + `', 'Toggle debug drawer'],
];

export function HelpDialog({ open, onClose }: Props) {
    if (!open) return null;
    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={e => e.stopPropagation()} className="card" style={{ maxWidth: 460, padding: 24 }}>
                <h2 style={{ margin: '0 0 16px', fontFamily: 'var(--serif)' }}>Keyboard shortcuts</h2>
                <table style={{ width: '100%', fontSize: 13 }}>
                    <tbody>
                        {SHORTCUTS.map(([key, desc]) => (
                            <tr key={key}>
                                <td style={{ padding: '6px 0', fontFamily: 'var(--mono)', color: 'var(--accent)', width: 100 }}>{key}</td>
                                <td style={{ padding: '6px 0', color: 'var(--text-dim)' }}>{desc}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <button onClick={onClose} className="ghost" style={{ marginTop: 16 }}>Close</button>
            </div>
        </div>
    );
}
