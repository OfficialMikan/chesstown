import type { PositionInfo, MoveInfo } from '../engine/types';
import { formatEval } from './chess';

export function templateExplainPosition(pos: PositionInfo | null, ply: number, lastMove: { san: string; info: MoveInfo } | null): string {
    if (!pos) return `I need the game analyzed first. Press <b>Analyze</b> so I can see the engine output.`;
    const evalStr = formatEval(pos);
    const cp = pos.cpWhitePov;
    let trend = 'the position is roughly equal';
    if (cp > 300) trend = 'White is completely winning';
    else if (cp > 80) trend = 'White is clearly better';
    else if (cp < -300) trend = 'Black is completely winning';
    else if (cp < -80) trend = 'Black is clearly better';

    let html = `<b>Move ${ply}</b> — ${trend}. Engine eval: <b>${evalStr}</b>.`;
    if (pos.bestSan) html += ` The engine wants to play <b>${pos.bestSan}</b>.`;
    if (lastMove) {
        const tier = lastMove.info.classification.tier;
        const sym = lastMove.info.classification.symbol;
        html += `<br><br>You just played <b>${lastMove.san}</b>${sym ? ` <span style="color:${lastMove.info.classification.color}">${sym}</span>` : ''} — <b>${lastMove.info.classification.label}</b>`;
        if (lastMove.info.loss > 10) html += `, losing about <b>${Math.round(lastMove.info.loss)}cp</b>.`;
        if (lastMove.info.bestSanBefore && lastMove.info.bestSanBefore !== lastMove.san) {
            html += ` The engine preferred <b>${lastMove.info.bestSanBefore}</b>.`;
        }
    }
    return html;
}

export function templateBiggestMistake(worst: { idx: number; san: string; info: MoveInfo; before: PositionInfo; after: PositionInfo } | null): string {
    if (!worst) return `Either you played a perfect game, or no analysis is available yet.`;
    const { san, info, before, after } = worst;
    let html = `<b>Biggest turning point:</b> <b>${san}</b> — <span style="color:${info.classification.color}">${info.classification.label}</span>, costing <b>${Math.round(info.loss)}cp</b>.`;
    html += `<br>Eval swung from <b>${formatEval(before)}</b> to <b>${formatEval(after)}</b>.`;
    if (info.bestSanBefore) html += `<br>Engine's choice: <b>${info.bestSanBefore}</b>.`;
    return html;
}
