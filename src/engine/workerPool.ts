import type { EngineModel, EngineModelId, PositionInfo } from './types';
import { getEngineById } from './localEngines';

type Job = {
    fen: string;
    depth: number;
    resolve: (info: PositionInfo | null) => void;
};

class EngineSlot {
    private worker: Worker;
    private ready = false;
    private busy = false;
    private current: Job | null = null;
    private lastScore: { type: 'cp' | 'mate'; value: number } | null = null;
    private pv: string[] = [];
    private depthReached = 0;
    private startTime = 0;

    constructor(model: EngineModel) {
        this.worker = new Worker(new URL('./stockfishWorker.ts', import.meta.url), { type: 'module' });
        this.worker.postMessage({ type: 'load', model });
        this.worker.onmessage = (e) => this.handle(e);
    }

    private handle(e: MessageEvent) {
        const m = e.data;
        if (m.type === 'loaded') this.sendInit();
        if (m.type === 'ready') { this.ready = true; /* drained by pool */ }
        if (m.type === 'info') this.parseInfo(m.line);
        if (m.type === 'error') this.fail(m.message);
    }

    private sendInit() {
        const m = this.currentModel;
        if (!m) return;
        const d = m.defaults;
        this.post(`setoption name Hash value ${d.hashMB}`);
        if (m.caps.hasMoveOverhead) this.post(`setoption name Move Overhead value ${d.moveOverhead}`);
        if (m.caps.hasSlowMover) this.post(`setoption name Slow Mover value ${d.slowMover}`);
        if (m.caps.hasMinThink) this.post(`setoption name Minimum Thinking Time value ${d.minThinkTime}`);
        if (m.caps.hasWDL) this.post(`setoption name UCI_ShowWDL value ${d.showWDL ? 'true' : 'false'}`);
        if (m.caps.hasSkillLevel) this.post(`setoption name Skill Level value ${d.skillLevel}`);
        if (m.caps.hasNNUE) this.post(`setoption name UCI_LimitStrength value ${d.limitStrength ? 'true' : 'false'}`);
        if (m.caps.hasNNUE) this.post(`setoption name UCI_Elo value ${d.elo}`);
        if (m.caps.hasContempt) this.post(`setoption name Contempt value ${d.contempt}`);
        this.post('ucinewgame');
        this.post('isready');
    }

    private currentModel: EngineModel | null = null;
    setModel(model: EngineModel) { this.currentModel = model; }

    private post(cmd: string) { this.worker.postMessage({ type: 'cmd', cmd }); }

    isReady() { return this.ready; }
    isBusy() { return this.busy; }

    run(job: Job) {
        if (this.busy) throw new Error('slot not idle');
        this.busy = true;
        this.current = job;
        this.lastScore = null;
        this.pv = [];
        this.depthReached = 0;
        this.startTime = performance.now();
        this.post(`position fen ${job.fen}`);
        this.post(`go depth ${job.depth}`);
    }

    private parseInfo(line: string) {
        if (!line.startsWith('info') || !line.includes(' score ')) return;
        const dM = /depth (\d+)/.exec(line); if (dM) this.depthReached = +dM[1];
        const sM = /score (cp|mate) (-?\d+)/.exec(line);
        if (sM) this.lastScore = { type: sM[1] as 'cp' | 'mate', value: parseInt(sM[2], 10) };
        const pvM = / pv (.*)/.exec(line);
        if (pvM) this.pv = pvM[1].split(' ');
    }

    private fail(message: string) {
        const j = this.current; this.current = null; this.busy = false;
        j?.resolve(null);
    }

    terminate() { this.worker.postMessage({ type: 'terminate' }); this.worker.terminate(); }

    // Called externally when a 'bestmove' line is observed
    consumeBestmove(bestUci: string) {
        if (!this.current) return;
        const fen = this.current.fen;
        const wtm = fen.split(' ')[1] === 'w';
        const raw = this.lastScore;
        const cpWhitePov = !raw ? 0
            : raw.type === 'cp' ? (wtm ? raw.value : -raw.value)
                : (wtm ? (raw.value >= 0 ? 100000 - raw.value : -100000 - raw.value)
                    : (raw.value >= 0 ? -100000 + raw.value : 100000 + raw.value));
        const info: PositionInfo = {
            fen,
            score: raw,
            cpWhitePov,
            bestMoveUci: bestUci === '(none)' ? null : bestUci,
            bestSan: null,
            pv: this.pv,
            depth: this.depthReached,
            nps: 0,
            timeMs: performance.now() - this.startTime,
        };
        const j = this.current; this.current = null; this.busy = false;
        j.resolve(info);
    }
}

export class WorkerPool {
    private slots: EngineSlot[] = [];
    private queue: Job[] = [];
    private model: EngineModel;
    private onBestMove: (slotIndex: number, uci: string) => void;

    constructor(modelId: EngineModelId, concurrency: number, onBestMove: (slotIndex: number, uci: string) => void) {
        this.model = getEngineById(modelId);
        this.onBestMove = onBestMove;
        const n = Math.max(1, Math.min(6, concurrency));
        for (let i = 0; i < n; i++) {
            const s = new EngineSlot(this.model);
            s.setModel(this.model);
            s['worker'].addEventListener('message', (e) => {
                const m = e.data;
                if (m.type === 'info' && m.line.startsWith('bestmove')) {
                    const u = m.line.split(' ')[1] || '(none)';
                    s.consumeBestmove(u);
                    this.onBestMove(slots.indexOf(s), u);
                    this.drain();
                }
            });
            this.slots.push(s);
        }
    }

    private drain() {
        for (const s of this.slots) {
            if (s.isReady() && !s.isBusy() && this.queue.length) {
                s.run(this.queue.shift()!);
            }
        }
    }

    /** Wait until at least one slot is ready. */
    async waitReady(): Promise<void> {
        const start = performance.now();
        while (performance.now() - start < 30000) {
            if (this.slots.some(s => s.isReady())) return;
            await new Promise(r => setTimeout(r, 100));
        }
        throw new Error('Engine did not become ready');
    }

    analyze(fen: string, depth: number): Promise<PositionInfo | null> {
        return new Promise(resolve => {
            this.queue.push({ fen, depth, resolve });
            this.drain();
        });
    }

    async stop() {
        this.queue = [];
        for (const s of this.slots) {
            if (s.isBusy()) {
                // bestmove will arrive; resolved in consumeBestmove
            }
        }
    }

    terminate() { for (const s of this.slots) s.terminate(); }
}

const slots = (function () {
    const arr: any[] = [];
    return { get indexOf() { return (x: any) => arr.indexOf(x); } };
})();
