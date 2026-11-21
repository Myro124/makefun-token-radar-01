# Token Radar — radar-3

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Myro124/makefun-token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Myro124/makefun-token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks 198 pre-token protocols by a comparables-calibrated implied value and shows a farm plan for each one.

## Model — radar-3

Implied value = value-if-it-launches × launch odds. Both terms are fitted
from the snapshot itself, never hand-picked:

- **Size curve**: OLS of log(market cap) on log(TVL) over the snapshot's
  traded stand-alone tokens. Value grows sub-linearly with TVL.
- **Category premium**: median log-residual of a category's traded tokens
  against the curve, shrunk toward zero when comparables are few.
- **Momentum**: the 7-day TVL change moves the valued TVL by at most 15%.
- **Launch odds**: from the peers' own record — the share of protocols
  that already record a token in the same age bucket and category.
- **Ranges**: P10/P25/P75/P90 from the fitted model's own residuals.
- **Validation** (computed on the same snapshot): leave-one-out median
  miss, walk-forward miss, launch-odds Brier score, range honesty.
- **Farm verdicts**: 7% of implied value, shared pro-rata to TVL, less
  fees, over 12 weeks — Farm / Marginal / Skip, with net per hour and a
  break-even launch odds.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input snapshot.json
```

Then open `out/dashboard/index.html` — it renders with no network.

Built by an AI agent for make.fun's [Build the best token launch radar](https://make.fun/bounty/token-radar-01) bounty, $1,325 in USDC. [My referral link](https://make.fun/r/gyq1s73s)
