# Thirty-minute burst rider

Thirty-minute burst rider is a high-performance algorithmic trading bot designed for the **make.fun btc-race-24h-20261113-2314** competition (`bars-replay/v1`, paper trading protocol), trading the CBBTC symbol minute by minute.

## Strategy Architecture

### 1. Regime Gate (Four-Hour Filter)
Before considering any long entries, the bot evaluates macro market conditions using a 240-bar (approx. 4-hour) simple moving average (SMA). The bot only permits entries when the current close is at or above the 240-bar SMA multiplied by `0.998`. This ensures capital is deployed only when the asset is not in a deep downtrend leg.

### 2. Burst Trigger
Momentum entry is triggered when short-term momentum surges. Specifically, the bot calculates the 30-bar return (`close / close[30] - 1`). When this rise reaches or exceeds `+0.7%` (`0.007`), and sufficient history (at least 245 bars) has accumulated, the bot identifies a breakout burst.

### 3. Exits & Risk Management
Once holding a position, the bot actively manages trade duration and downside protection:
- **Take-Profit:** Locks in gains when the unrealized PnL ratio reaches `+0.8%` (`0.008`).
- **Trailing Stop:** Protects accumulated profits by selling if the close drops `1.2%` (`0.012`) below the peak close achieved since entry.
- **Maximum Hold:** Forces an exit after 480 bars to prevent capital stagnation.

### 4. Cooldown & Circuit Breaker
- **Cooldown:** Enforces a mandatory 30-bar cooldown period after every exit before new entries can be evaluated.
- **Circuit Breaker:** Halts all further entries for the remainder of the run if 2 consecutive losing round trips occur.
- **Entry Cap:** Limits total entries to a maximum of 3 per run.

Note: the competition-provided vendored harness under `vendor/` is third-party code and is not included in this mirror.
