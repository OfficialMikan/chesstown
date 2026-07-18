// Runs inside a dedicated Web Worker. Loads the Stockfish script (or asm.js
// string), instantiates it, and exposes a clean message API to the main thread.
import { cacheGet, cachePut } from './cache';

type EngineModel = {
    id: string;
    format: 'wasm' | 'asmjs';
    jsUrl: string;
    wasmUrl: string | null;
};

let engine: Worker | null = null;
let onUciInfo: ((line: string) => void) | null = null;
let onReady: (() => void) | null = null;

async function fetchText(url: string): Promise<string> {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
}

async function fetchBytes(url: string): Promise<Uint8Array> {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return new Uint8Array(await r.arrayBuffer());
}

async function buildEngine(model: EngineModel): Promise<Worker> {
    const cacheKeyJs = model.id + '_js';
    const cacheKeyWasm = model.id + '_wasm';

    if (model.format === 'asmjs') {
        let js = await cacheGet<string>(cacheKeyJs);
        if (!js) {
            js = await fetchText(model.jsUrl);
            await cachePut(cacheKeyJs, js);
        }
        const blob = new Blob([js], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        const w = new Worker(url);
        setTimeout(() => URL.revokeObjectURL(url), 200); // free the URL after the worker has booted
        return w;
    }

    // wasm: fetch both, patch self.fetch to return the embedded wasm bytes.
    let [js, wasm] = await Promise.all([
        cacheGet<string>(cacheKeyJs),
        cacheGet<ArrayBuffer>(cacheKeyWasm),
    ]);
    if (!js) { js = await fetchText(model.jsUrl); await cachePut(cacheKeyJs, js); }
    if (!wasm && model.wasmUrl) { wasm = (await fetchBytes(model.wasmUrl)).buffer as ArrayBuffer; await cachePut(cacheKeyWasm, wasm); }

    const wasmB64 = wasm ? btoa(String.fromCharCode(...new Uint8Array(wasm))) : '';

    const patch = `
self.fetch = function (url) {
  if (${JSON.stringify(model.wasmUrl)}.includes(String(url))) {
    return Promise.resolve({
      ok: true,
      arrayBuffer: () => Promise.resolve(Uint8Array.from(atob(${JSON.stringify(wasmB64)})), c => c.charCodeAt(0)).buffer),
    });
  }
  return originalFetch(url);
};
var originalFetch = self.fetch;
`;
    const blob = new Blob([patch + js], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const w = new Worker(url);
    setTimeout(() => URL.revokeObjectURL(url), 200);
    return w;
}

self.onmessage = async (e: MessageEvent) => {
    const msg = e.data;
    if (msg.type === 'load') {
        try {
            engine = await buildEngine(msg.model);
            engine.onmessage = (ev: MessageEvent) => {
                const line = typeof ev.data === 'string' ? ev.data : ev.data?.toString?.();
                if (!line) return;
                if (line === 'uciok' || line === 'readyok') onReady?.();
                onUciInfo?.(line);
                (self as any).postMessage({ type: 'log', line });
            };
            engine.onerror = (err) => (self as any).postMessage({ type: 'error', message: err.message });
            engine.postMessage('uci');
            (self as any).postMessage({ type: 'loaded' });
        } catch (err: any) {
            (self as any).postMessage({ type: 'error', message: err?.message ?? 'load failed' });
        }
        return;
    }
    if (msg.type === 'cmd' && engine) {
        engine.postMessage(msg.cmd);
    }
    if (msg.type === 'onInfo') {
        onUciInfo = (line) => (self as any).postMessage({ type: 'info', line });
    }
    if (msg.type === 'onReady') {
        onReady = () => (self as any).postMessage({ type: 'ready' });
    }
    if (msg.type === 'terminate' && engine) {
        engine.terminate();
        engine = null;
    }
};
