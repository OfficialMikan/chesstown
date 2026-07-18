export function cpToWinProbability(cp: number): number {
    return 1 / (1 + Math.pow(10, -cp / 400));
}

export function winProbToBarPct(cp: number, cap = 1000): number {
    const c = Math.max(-cap, Math.min(cap, cp));
    return 50 + (c / cap) * 50;
}
