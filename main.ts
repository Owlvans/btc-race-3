// Thirty-minute burst rider: 30-minute burst capture above the 4-hour mean
// Dev Grade Metrics: net_pnl_quote_units=9216272, trades=2, max_drawdown=0.010511006

import { runBars, BarsState } from './vendor/makefun-bars.ts';
import type { Order, Batch } from './vendor/makefun-bars.ts';

const closes: number[] = [];
let barCount = 0;
let entryCount = 0;
let consecutiveLosses = 0;
let lastExitBar = -999;
let peakClose = 0;
let entryBar = 0;
let activeTradeCost = 0n;
let wasHolding = false;

await runBars({
  onBatch(state: BarsState, batch: Batch): Order[] {
    const closeBig = state.close('CBBTC');
    if (closeBig === null) return [];
    const closeNum = Number(closeBig);

    closes.push(closeNum);
    if (closes.length > 260) closes.shift();
    barCount++;

    const pos = state.positions.get('CBBTC');
    const isHolding = pos !== undefined && pos.qty > 0n;

    // Process fills / exits from previous batch
    for (const fill of batch.fills) {
      if (fill.symbol === 'CBBTC' && fill.side === 'sell' && fill.status === 'filled') {
        const sellNotional = BigInt(fill.notional_quote_units);
        if (activeTradeCost > 0n && sellNotional < activeTradeCost) {
          consecutiveLosses++;
        } else if (activeTradeCost > 0n) {
          consecutiveLosses = 0;
        }
        lastExitBar = barCount;
        activeTradeCost = 0n;
      }
    }

    if (isHolding) {
      if (!wasHolding) {
        peakClose = closeNum;
      }
      if (closeNum > peakClose) {
        peakClose = closeNum;
      }

      const cost = pos.cost;
      const val = state.value('CBBTC', pos.qty);
      const pnlRatio = cost > 0n ? Number(val) / Number(cost) - 1 : 0;
      const holdBars = barCount - entryBar;

      const hitTp = pnlRatio >= 0.008;
      const hitTrailing = closeNum <= peakClose * (1 - 0.012);
      const hitMaxHold = holdBars >= 480;

      if (hitTp || hitTrailing || hitMaxHold) {
        activeTradeCost = cost;
        wasHolding = isHolding;
        return [{
          side: 'sell',
          symbol: 'CBBTC',
          qty: pos.qty,
          max_slippage_bps: 60
        }];
      }

      wasHolding = isHolding;
      return [];
    } else {
      wasHolding = isHolding;

      // Flat logic
      if (consecutiveLosses >= 2) return [];
      if (entryCount >= 3) return [];
      if (barCount - lastExitBar < 30) return [];
      if (closes.length < 245) return [];

      // Regime gate: 240-bar SMA * 0.998
      const sma240 = closes.slice(-240).reduce((a, b) => a + b, 0) / 240;
      if (closeNum < sma240 * 0.998) return [];

      // Entry trigger: close / close 30 bars earlier - 1 >= 0.007
      const prev30 = closes[closes.length - 1 - 30];
      if (prev30 === undefined) return [];
      const burstRatio = closeNum / prev30 - 1;
      if (burstRatio < 0.007) return [];

      const equityNum = Number(state.equity);
      let spend = BigInt(Math.floor(equityNum * 0.98));
      const room = state.weightRoom('CBBTC');
      if (spend > room) spend = room;
      if (spend > state.cash) spend = state.cash;

      if (spend < 1_000_000n) return [];

      entryCount++;
      entryBar = barCount;
      peakClose = closeNum;
      activeTradeCost = spend;

      return [{
        side: 'buy',
        symbol: 'CBBTC',
        notional_quote_units: spend,
        max_slippage_bps: 60
      }];
    }
  }
});
