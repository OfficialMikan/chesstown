export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogEntry = { ts: number; level: LogLevel; tag: string; msg: string; data?: any };

type Listener = (entries: LogEntry[]) => void;

class Logger {
    private entries: LogEntry[] = [];
    private max = 500;
    private listeners = new Set<Listener>();
    private installed = false;

    log(level: LogLevel, tag: string, msg: string, data?: any) {
        const entry: LogEntry = { ts: Date.now(), level, tag, msg, data };
        this.entries.push(entry);
        if (this.entries.length > this.max) this.entries.shift();
        const c = console[level === 'debug' ? 'log' : level] || console.log;
        c(`[${tag}] ${msg}`, data ?? '');
        this.listeners.forEach(l => l(this.entries));
    }
    debug(tag: string, msg: string, data?: any) { this.log('debug', tag, msg, data); }
    info(tag: string, msg: string, data?: any) { this.log('info', tag, msg, data); }
    warn(tag: string, msg: string, data?: any) { this.log('warn', tag, msg, data); }
    error(tag: string, msg: string, data?: any) { this.log('error', tag, msg, data); }
    getEntries() { return this.entries; }
    clear() { this.entries = []; this.listeners.forEach(l => l(this.entries)); }
    subscribe(l: Listener) { this.listeners.add(l); return () => { this.listeners.delete(l); }; }
    installGlobalHandlers() {
        if (this.installed) return;
        this.installed = true;
        window.addEventListener('error', (e) => this.error('window.error', e.message, { stack: e.error?.stack }));
        window.addEventListener('unhandledrejection', (e) => this.error('unhandledrejection', String(e.reason)));
    }
}

export const logger = new Logger();
