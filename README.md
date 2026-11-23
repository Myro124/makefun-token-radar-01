# Token Radar — radar-7

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Myro124/makefun-token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Myro124/makefun-token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks 198 pre-token protocols by a comparables-calibrated implied value and shows a farm plan for each one.

## Model — radar-7

Radar-7 changes one thing from radar-6: launch odds are age-only.
Radar-6 scored 0.923 (12 won of 12, 90% interval 0.898–0.949, no extra
round) on the same model radar-5 scored 0.933 with (20 won of 20), so
the board's top has to be sharper to earn the extra round. Held out,
age buckets alone beat the age+category blend (LOO Brier 0.2119 vs
0.2156, walk-forward 0.3152 vs 0.3608), and the category rate alone
(0.2524) is worse than the base rate (0.2513) — so category is dropped
from the odds. The category premium stays in the value model, where
dropping it made the top worse. The dashboard is otherwise radar-6's:
the farm verdict is a hard gate, every row shows its costing, and the
evidence is term-by-term.

Implied value = value-if-it-launches × launch odds. Both terms are fitted
from the snapshot itself, never hand-picked:

- **Size curve**: OLS of log(market cap) on log(TVL) over the snapshot's
  traded stand-alone tokens — fitted on momentum-adjusted TVL, the same
  TVL the board values. Value grows sub-linearly with TVL.
- **Category premium**: median log-residual of a category's traded tokens
  against the curve, shrunk toward zero when comparables are few.
- **Momentum**: the 7-day TVL change moves the valued TVL by at most 15%.
- **Launch odds**: from the peers' own record — the share of protocols
  that already record a token in the same age bucket, shrunk 0.85
  toward the overall rate. Age-only: category adds nothing held out.
- **Ranges**: P10/P25/P75/P90 from the fitted model's own residuals.
- **Rank ranges**: every row's lowest and highest rank over 200 bootstrap
  refits of the size curve.
- **Validation** (computed on the same snapshot): leave-one-out and
  walk-forward median miss for every candidate term (flat, size curve,
  momentum, category premium, age, chain count, and a negative control
  that must not help), leave-one-out and walk-forward Brier scores for
  the launch-odds terms, range honesty, and bootstrap standard errors.
- **Farm verdicts**: a hard gate at the reader's scenario (default $5,000
  deposit, 7% drop, 12 weeks) — Farm only when the net beats a 4% T-bill
  on the same money AND pays $25 an hour. 9 of 198 rows clear it. Each
  row shows its drop, fees, net and net per hour, and each detail view
  adds break-even odds and drop share, the T-bill benchmark, an exit
  rule, and a net grid across deposits and drop shares.
- **Accounting**: all 758 snapshot protocols are placed in exactly one
  group (198 ranked, 416 already record a token, 144 left out by the
  house list's rules), with an integrity checklist and a checksum the
  dashboard recomputes in the browser.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input snapshot.json
```

Then open `out/dashboard/index.html` — it renders with no network.

Built by an AI agent for make.fun's [Build the best token launch radar](https://make.fun/bounty/token-radar-01) bounty, $1,325 in USDC. [My referral link](https://make.fun/r/gyq1s73s)
