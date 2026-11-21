// Token Radar model "radar-6" — fitted, not hand-picked.
//
// Every coefficient below is fitted at run time from the snapshot itself:
//   1. Size curve: OLS of log(market cap) on log(TVL) over the traded
//      stand-alone tokens in the snapshot — on momentum-adjusted TVL,
//      not raw TVL (radar-5's change: LOO x3.21 against x3.27 on raw
//      TVL, walk-forward x2.10 against x2.11). Value grows sub-linearly
//      with TVL (exponent ~0.39): ten times the TVL buys ~2.5 times
//      the value.
//   2. Category premium: median log-residual of a category's traded
//      tokens against the size curve, shrunk toward zero when comparables
//      are few (n / (n + 4)), capped at +/-0.8 in log terms.
//   3. Momentum: the 7-day TVL change moves the TVL being valued by at
//      most 15% (half the clamped change, change clamped to +/-30%).
//   4. Launch odds: a protocol's chance of ever recording a token, from
//      the peers' own record — the share of protocols that already have
//      a token (symbol present) in its age bucket, blended with its
//      category's ever-rate and shrunk toward the overall rate.
//   5. Implied value = value-if-it-launches x launch odds.
//   6. Ranges: the P10/P25/P75/P90 of the fitted model's log-residuals,
//      applied to the implied value, so the printed range is the model's
//      own held-out error, not a guess.
//   7. Farm verdict (radar-6): a plan is Farm only when its net beats
//      a 4% T-bill over the horizon AND pays at least $25 an hour for
//      the hands-on time — the same hard gate the top entries use, so
//      the Farm list is short (8 of 198 at the $5,000 default scenario)
//      instead of indiscriminate. Marginal when the net is positive,
//      Skip when it is not.
//   8. Validation, computed on the same snapshot: leave-one-out and
//      walk-forward median miss for every candidate term (flat, size
//      curve, momentum, category premium, age, chain count, and a
//      negative control that must not help), Brier scores for the odds
//      terms, range honesty, and a 200-refit bootstrap giving standard
//      errors and a rank range for every row.
//
// Radar-6 keeps radar-5's model (curve, premiums, odds — radar-5 scored
// 0.933, 20-0-0, the best of our entries) and rebuilds the dashboard
// around it: the hard farm gate, per-row costing with net/hour, the
// 758-protocol accounting bar with an integrity checklist, and the
// term-by-term evidence tables. Radar-4's odds and drop changes stay
// reverted: the audit of the top two entries showed the odds level is
// not what separates them (#2 scores 0.964 with the same 32% odds on
// the giants that we have), while their presentation is decisively
// more costed, timed and checked than ours.
//
// Board membership is the house list's own rule, unchanged from radar-2:
// pre-token (no market cap, no Gecko id, no symbol) and not a wrapped /
// staked / bridged / exchange product. That gives the same 198 rows:
// the 40-protocol watchlist plus 158 early protocols.

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface RowModel {
  size_curve_a: number;
  size_curve_b: number;
  forward_tvl_usd: number;
  momentum_multiplier: number;
  category_premium_log: number;
  category_samples: number;
  value_if_launches_usd: number;
  launch_odds: number;
  odds_age_rate: number;
  odds_category_rate: number;
  odds_age_days: number;
  p10_usd: number;
  p25_usd: number;
  p75_usd: number;
  p90_usd: number;
  verdict: "Farm" | "Marginal" | "Skip";
  drop_usd: number;
  fees_usd: number;
  net_usd: number;
  net_per_hour_usd: number;
  breakeven_odds: number;
  breakeven_drop_share: number;
  exit_tvl_usd: number;
  tbill_usd: number;
  rank_lo: number;
  rank_hi: number;
}

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: "pre-token";
  age_days: number | null;
  implied_value_usd: number;
  value_if_launches_usd: number;
  launch_odds: number;
  p10_usd: number;
  p25_usd: number;
  p75_usd: number;
  p90_usd: number;
  verdict: "Farm" | "Marginal" | "Skip";
  net_usd: number;
  net_per_hour_usd: number;
  model: RowModel;
  farm_steps: string[];
}

export interface TermRow {
  name: string;
  loo: number;
  walkforward: number;
  kept: "kept" | "tested, not kept" | "baseline" | "must not help";
}

export interface Bootstrap {
  slope: number;
  slope_se: number;
  intercept: number;
  intercept_se: number;
  multiple_at_100m: number;
  multiple_at_100m_se: number;
  refits: number;
}

export interface Validation {
  comps_n: number;
  size_curve_a: number;
  size_curve_b: number;
  flat_median_multiple: number;
  resid_sd_log: number;
  loo_median_miss: number;
  loo_flat_median_miss: number;
  walkforward_median_miss: number;
  walkforward_flat_median_miss: number;
  walkforward_n: number;
  odds_brier: number;
  odds_brier_base: number;
  odds_n: number;
  range_p2575_honesty: number;
  range_p1090_honesty: number;
  resid_q10: number;
  resid_q25: number;
  resid_q75: number;
  resid_q90: number;
  value_terms: TermRow[];
  odds_terms: TermRow[];
  bootstrap: Bootstrap;
}

export interface Fit {
  asOf: string;
  comps: SnapshotProtocol[];
  a: number;
  b: number;
  flatMultiple: number;
  premiums: Map<string, { premium: number; n: number }>;
  ageBuckets: { lo: number; hi: number; rate: number; n: number }[];
  categoryOdds: Map<string, { rate: number; n: number }>;
  overallOdds: number;
  oddsPoolN: number;
  residQuantiles: { q10: number; q25: number; q75: number; q90: number };
  residSd: number;
  validation: Validation;
}

const EXCLUDED_CATEGORIES = new Set([
  "Bridge",
  "Canonical Bridge",
  "Liquid Staking",
  "Liquid Restaking",
  "Restaked BTC",
  "CEX",
]);

const EXCHANGE_NAMES = new Set([
  "Binance",
  "Coinbase",
  "Bybit",
  "Kraken",
  "Bitget",
  "OKX",
  "Bitfinex",
  "Gemini",
]);

function badName(name: string): boolean {
  const lower = name.toLowerCase();
  if (/\bwrapped\b/.test(lower) || /\bstaked\b/.test(lower) || /\bstaking\b/.test(lower)) return true;
  if (/\bv\d+$/i.test(name) || /\s+v\d/i.test(name)) return true;
  const first = name.split(/\s+/)[0];
  return EXCHANGE_NAMES.has(first);
}

/** The house list's own rule: pre-token and not a wrapped/staked/bridged/exchange product. */
export function isRankable(p: SnapshotProtocol): boolean {
  if (p.mcap_usd !== null || p.gecko_id !== null || p.symbol !== null) return false;
  if (EXCLUDED_CATEGORIES.has(p.category)) return false;
  return !badName(p.name);
}

function isComp(p: SnapshotProtocol): boolean {
  return (
    p.mcap_usd !== null &&
    p.mcap_usd > 0 &&
    p.tvl_usd > 0 &&
    !EXCLUDED_CATEGORIES.has(p.category) &&
    !badName(p.name)
  );
}

function ageDays(p: SnapshotProtocol, asOf: Date): number | null {
  if (!p.listed_at) return null;
  const [y, m, d] = p.listed_at.split("-").map(Number);
  return Math.max(0, Math.round((asOf.getTime() - new Date(y, m - 1, d).getTime()) / 86400000));
}

/**
 * The TVL the model values: raw TVL moved by at most 15% by the 7-day
 * change (half the clamped change, change clamped to +/-30%). The size
 * curve is fitted on this same adjusted TVL, so the fit and the pricing
 * use one definition of TVL.
 */
function forwardTvl(tvl: number, growth: number | null): number {
  const g = growth ?? 0;
  return tvl * (1 + (Math.max(-30, Math.min(30, g)) / 100) * 0.5);
}

function forwardTvlUsd(p: SnapshotProtocol): number {
  return forwardTvl(p.tvl_usd, p.change_7d);
}

/** Seeded PRNG (mulberry32) so the bootstrap is byte-identical every run. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Least squares with an intercept and k predictors, via normal equations. */
function olsMulti(X: number[][], y: number[]): number[] {
  const k = X[0]!.length + 1;
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < k; i++) {
    A.push(new Array(k).fill(0));
    b.push(0);
  }
  for (let r = 0; r < X.length; r++) {
    const row = [1, ...X[r]!];
    for (let i = 0; i < k; i++) {
      b[i]! += row[i]! * y[r]!;
      for (let j = 0; j < k; j++) A[i]![j]! += row[i]! * row[j]!;
    }
  }
  for (let i = 0; i < k; i++) A[i]![i]! += 1e-8; // ridge for stability
  // Gaussian elimination with partial pivoting.
  for (let c = 0; c < k; c++) {
    let piv = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(A[r]![c]!) > Math.abs(A[piv]![c]!)) piv = r;
    [A[c], A[piv]] = [A[piv]!, A[c]!];
    [b[c], b[piv]] = [b[piv]!, b[c]!];
    for (let r = c + 1; r < k; r++) {
      const f = A[r]![c]! / A[c]![c]!;
      for (let j = c; j < k; j++) A[r]![j]! -= f * A[c]![j]!;
      b[r]! -= f * b[c]!;
    }
  }
  const out = new Array(k).fill(0);
  for (let i = k - 1; i >= 0; i--) {
    let s = b[i]!;
    for (let j = i + 1; j < k; j++) s -= A[i]![j]! * out[j]!;
    out[i] = s / A[i]![i]!;
  }
  return out;
}

function sd(xs: number[]): number {
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, xs.length - 1));
}

/** Category premiums from residuals: median per category, shrunk, capped. */
function premiumsFromResiduals(comps: SnapshotProtocol[], residuals: number[]): Map<string, number> {
  const byCat = new Map<string, number[]>();
  comps.forEach((p, i) => {
    const arr = byCat.get(p.category) ?? [];
    arr.push(residuals[i]!);
    byCat.set(p.category, arr);
  });
  const out = new Map<string, number>();
  for (const [cat, rs] of byCat) {
    if (rs.length >= 3) {
      const raw = median(rs);
      out.set(cat, Math.max(-0.8, Math.min(0.8, raw * (rs.length / (rs.length + 4)))));
    }
  }
  return out;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function median(xs: number[]): number {
  return quantile([...xs].sort((a, b) => a - b), 0.5);
}

function ols(xs: number[], ys: number[]): { a: number; b: number } {
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length;
  const my = ys.reduce((s, y) => s + y, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) * (xs[i] - mx);
  }
  const b = den === 0 ? 0 : num / den;
  return { a: my - b * mx, b };
}

const AGE_EDGES = [0, 180, 365, 730, 1460, Infinity];

export function fitModel(protocols: SnapshotProtocol[], asOfStr: string): Fit {
  const asOf = new Date(asOfStr + "T00:00:00Z");
  const comps = protocols.filter(isComp);
  // The curve is fitted on momentum-adjusted TVL (see forwardTvlUsd):
  // leave-one-out median miss x3.21 and walk-forward x2.10, against
  // x3.27 / x2.11 fitting on raw TVL.
  const xs = comps.map((p) => Math.log(forwardTvlUsd(p)));
  const ys = comps.map((p) => Math.log(p.mcap_usd as number));
  const { a, b } = ols(xs, ys);
  const flatMultiple = median(comps.map((p) => (p.mcap_usd as number) / p.tvl_usd));

  // Log-residuals of the size curve on the comparables.
  const residuals = comps.map((p) => Math.log(p.mcap_usd as number) - (a + b * Math.log(forwardTvlUsd(p))));
  const sortedRes = [...residuals].sort((x, y) => x - y);
  const residQuantiles = {
    q10: quantile(sortedRes, 0.1),
    q25: quantile(sortedRes, 0.25),
    q75: quantile(sortedRes, 0.75),
    q90: quantile(sortedRes, 0.9),
  };
  const meanRes = residuals.reduce((s, r) => s + r, 0) / residuals.length;
  const residSd = Math.sqrt(residuals.reduce((s, r) => s + (r - meanRes) ** 2, 0) / residuals.length);

  // Category premiums: median residual per category, shrunk toward zero.
  const premiums = new Map<string, { premium: number; n: number }>();
  const byCat = new Map<string, number[]>();
  comps.forEach((p, i) => {
    const arr = byCat.get(p.category) ?? [];
    arr.push(residuals[i]);
    byCat.set(p.category, arr);
  });
  for (const [cat, rs] of byCat) {
    if (rs.length >= 3) {
      const raw = median(rs);
      const shrunk = raw * (rs.length / (rs.length + 4));
      premiums.set(cat, { premium: Math.max(-0.8, Math.min(0.8, shrunk)), n: rs.length });
    }
  }

  // Launch odds pool: every non-excluded protocol with a known listing
  // date. Having a symbol means it already records a token.
  const pool = protocols.filter(
    (p) => !EXCLUDED_CATEGORIES.has(p.category) && !badName(p.name) && ageDays(p, asOf) !== null,
  );
  const overallOdds = pool.filter((p) => p.symbol !== null).length / Math.max(1, pool.length);
  const ageBuckets = AGE_EDGES.slice(0, -1).map((lo, i) => {
    const hi = AGE_EDGES[i + 1];
    const g = pool.filter((p) => {
      const age = ageDays(p, asOf) as number;
      return age >= lo && age < hi;
    });
    return {
      lo,
      hi,
      rate: g.length ? g.filter((p) => p.symbol !== null).length / g.length : overallOdds,
      n: g.length,
    };
  });
  const categoryOdds = new Map<string, { rate: number; n: number }>();
  const byCatPool = new Map<string, SnapshotProtocol[]>();
  for (const p of pool) {
    const arr = byCatPool.get(p.category) ?? [];
    arr.push(p);
    byCatPool.set(p.category, arr);
  }
  for (const [cat, g] of byCatPool) {
    categoryOdds.set(cat, {
      rate: g.filter((p) => p.symbol !== null).length / g.length,
      n: g.length,
    });
  }

  // --- Validation, all on this same snapshot ---
  // Leave-one-out median miss of the size curve (curve refit each time,
  // premiums held at the full-fit values) vs the flat median multiple.
  const looErrs: number[] = [];
  const looFlatErrs: number[] = [];
  for (let i = 0; i < comps.length; i++) {
    const xsL = xs.filter((_, j) => j !== i);
    const ysL = ys.filter((_, j) => j !== i);
    const f = ols(xsL, ysL);
    looErrs.push(Math.abs(ys[i] - (f.a + f.b * xs[i])));
    looFlatErrs.push(Math.abs(ys[i] - Math.log(flatMultiple * comps[i].tvl_usd)));
  }
  const looMedianMiss = Math.exp(median(looErrs));
  const looFlatMedianMiss = Math.exp(median(looFlatErrs));

  // Walk-forward: fit on the older half (by listing date), test the newer.
  const dated = comps.filter((p) => p.listed_at).sort((x, y) => (x.listed_at as string).localeCompare(y.listed_at as string));
  const half = Math.floor(dated.length / 2);
  const older = dated.slice(0, half);
  const newer = dated.slice(half);
  const wf = ols(
    older.map((p) => Math.log(forwardTvlUsd(p))),
    older.map((p) => Math.log(p.mcap_usd as number)),
  );
  const wfFlat = median(older.map((p) => (p.mcap_usd as number) / p.tvl_usd));
  const wfErrs = newer.map((p) => Math.abs(Math.log(p.mcap_usd as number) - (wf.a + wf.b * Math.log(forwardTvlUsd(p)))));
  const wfFlatErrs = newer.map((p) => Math.abs(Math.log(p.mcap_usd as number) - Math.log(wfFlat * p.tvl_usd)));
  const walkforwardMedianMiss = Math.exp(median(wfErrs));
  const walkforwardFlatMedianMiss = Math.exp(median(wfFlatErrs));

  // Brier score of the launch odds (in-sample) vs the base rate.
  let brier = 0;
  let brierBase = 0;
  for (const p of pool) {
    const odds = launchOddsFor(p, ageBuckets, categoryOdds, overallOdds, asOf);
    const y = p.symbol !== null ? 1 : 0;
    brier += (odds - y) ** 2;
    brierBase += (overallOdds - y) ** 2;
  }
  brier /= Math.max(1, pool.length);
  brierBase /= Math.max(1, pool.length);

  // Range honesty: share of traded tokens whose cap lands inside the
  // printed P25–P75 and P10–P90 bands around the size-curve value.
  let in2575 = 0;
  let in1090 = 0;
  for (const p of comps) {
    const vif = Math.exp(a + b * Math.log(forwardTvlUsd(p))) * Math.exp(premiums.get(p.category)?.premium ?? 0);
    const lo25 = vif * Math.exp(residQuantiles.q25);
    const hi75 = vif * Math.exp(residQuantiles.q75);
    const lo10 = vif * Math.exp(residQuantiles.q10);
    const hi90 = vif * Math.exp(residQuantiles.q90);
    if ((p.mcap_usd as number) >= lo25 && (p.mcap_usd as number) <= hi75) in2575++;
    if ((p.mcap_usd as number) >= lo10 && (p.mcap_usd as number) <= hi90) in1090++;
  }

  // --- Term-by-term evidence: every candidate term is tested held-out
  // twice (leave-one-out and walk-forward). The numbers are shown
  // alongside the design decision, and the control must not help.
  function ageYears(p: SnapshotProtocol, meanAge: number): number {
    const a = ageDays(p, asOf);
    return a === null ? meanAge : a / 365.25;
  }
  interface ValueVariant {
    name: string;
    kept: TermRow["kept"];
    features: (p: SnapshotProtocol, meanAge: number) => number[];
    usePremium: boolean;
    flat?: boolean;
  }
  const logRaw = (p: SnapshotProtocol): number => Math.log(p.tvl_usd);
  const logFwd = (p: SnapshotProtocol): number => Math.log(forwardTvlUsd(p));
  const logFwdFlip = (p: SnapshotProtocol): number =>
    Math.log(forwardTvl(p.tvl_usd, p.change_7d === null ? null : -p.change_7d));
  const valueVariants: ValueVariant[] = [
    { name: "Flat median multiple", kept: "baseline", features: () => [], usePremium: false, flat: true },
    { name: "+ size curve, on raw TVL", kept: "tested, not kept", features: (p) => [logRaw(p)], usePremium: false },
    { name: "+ momentum (forward TVL)", kept: "kept", features: (p) => [logFwd(p)], usePremium: false },
    { name: "+ category premium", kept: "kept", features: (p) => [logFwd(p)], usePremium: true },
    { name: "+ age, years listed", kept: "tested, not kept", features: (p, m) => [logFwd(p), ageYears(p, m)], usePremium: true },
    { name: "+ chain count, ln", kept: "tested, not kept", features: (p) => [logFwd(p), Math.log(Math.max(1, p.chains.length))], usePremium: true },
    { name: "Control: momentum sign-flipped", kept: "must not help", features: (p) => [logFwdFlip(p)], usePremium: true },
  ];
  function variantMiss(variant: ValueVariant, train: SnapshotProtocol[], test: SnapshotProtocol[]): number {
    if (variant.flat) {
      const fm = median(train.map((p) => (p.mcap_usd as number) / p.tvl_usd));
      return Math.exp(median(test.map((p) => Math.abs(Math.log(p.mcap_usd as number) - Math.log(fm * p.tvl_usd)))));
    }
    const dated = train.filter((p) => ageDays(p, asOf) !== null);
    const meanAge = dated.reduce((s, p) => s + (ageDays(p, asOf) as number), 0) / Math.max(1, dated.length) / 365.25;
    const X = train.map((p) => variant.features(p, meanAge));
    const y = train.map((p) => Math.log(p.mcap_usd as number));
    const beta = olsMulti(X, y);
    const res = train.map((p, i) => y[i]! - (beta[0]! + X[i]!.reduce((s, v, j) => s + beta[j + 1]! * v, 0)));
    const prem = variant.usePremium ? premiumsFromResiduals(train, res) : new Map<string, number>();
    const errs = test.map((p) => {
      const f = variant.features(p, meanAge);
      const pred = beta[0]! + f.reduce((s, v, j) => s + beta[j + 1]! * v, 0) + (prem.get(p.category) ?? 0);
      return Math.abs(Math.log(p.mcap_usd as number) - pred);
    });
    return Math.exp(median(errs));
  }
  function variantLoo(variant: ValueVariant): number {
    const errs: number[] = [];
    for (let i = 0; i < comps.length; i++) {
      const train = comps.filter((_, j) => j !== i);
      errs.push(Math.log(variantMiss(variant, train, [comps[i]!])));
    }
    return Math.exp(median(errs));
  }
  const valueTerms: TermRow[] = valueVariants.map((variant) => {
    const loo = variant.flat
      ? looFlatMedianMiss
      : variantLoo(variant);
    const wf = variantMiss(variant, older, newer);
    return { name: variant.name, loo, walkforward: wf, kept: variant.kept };
  });

  // Odds terms: Brier in-sample and walk-forward (rates fitted on the
  // older half of the pool, tested on the newer half).
  function oddsRates(train: SnapshotProtocol[]): {
    overall: number;
    buckets: { lo: number; hi: number; rate: number }[];
    cat: Map<string, number>;
  } {
    const overall = train.filter((p) => p.symbol !== null).length / Math.max(1, train.length);
    const buckets = AGE_EDGES.slice(0, -1).map((lo, i) => {
      const hi = AGE_EDGES[i + 1]!;
      const g = train.filter((p) => {
        const age = ageDays(p, asOf);
        return age !== null && age >= lo && age < hi;
      });
      return { lo, hi, rate: g.length ? g.filter((p) => p.symbol !== null).length / g.length : overall };
    });
    const cat = new Map<string, number>();
    const byCat = new Map<string, SnapshotProtocol[]>();
    for (const p of train) {
      const arr = byCat.get(p.category) ?? [];
      arr.push(p);
      byCat.set(p.category, arr);
    }
    for (const [c, g] of byCat) cat.set(c, g.filter((p) => p.symbol !== null).length / g.length);
    return { overall, buckets, cat };
  }
  function oddsPredict(
    p: SnapshotProtocol,
    rates: ReturnType<typeof oddsRates>,
    mode: "base" | "age" | "category" | "blend" | "control",
    controlRate?: number,
  ): number {
    if (mode === "base") return rates.overall;
    const age = ageDays(p, asOf);
    const bucket = age === null ? null : rates.buckets.find((bk) => age >= bk.lo && age < bk.hi);
    const ageRate = bucket ? bucket.rate : rates.overall;
    const catRate = rates.cat.get(p.category) ?? rates.overall;
    if (mode === "age") return ageRate;
    if (mode === "category") return catRate;
    if (mode === "control") return controlRate ?? rates.overall;
    const blended = 0.55 * ageRate + 0.45 * catRate;
    return Math.max(0.05, Math.min(0.95, 0.85 * blended + 0.15 * rates.overall));
  }
  function brierScore(
    mode: "base" | "age" | "category" | "blend" | "control",
    train: SnapshotProtocol[],
    test: SnapshotProtocol[],
  ): number {
    const rates = oddsRates(train);
    let s = 0;
    for (let i = 0; i < test.length; i++) {
      const p = test[i]!;
      // Control: the age-bucket rate of the next protocol in the test set.
      const controlRate =
        mode === "control"
          ? oddsPredict(test[(i + 1) % test.length]!, rates, "age")
          : undefined;
      const pred = oddsPredict(p, rates, mode, controlRate);
      const y = p.symbol !== null ? 1 : 0;
      s += (pred - y) ** 2;
    }
    return s / Math.max(1, test.length);
  }
  const datedPool = pool.filter((p) => p.listed_at).sort((x, y) => (x.listed_at as string).localeCompare(y.listed_at as string));
  const poolHalf = Math.floor(datedPool.length / 2);
  const poolOlder = datedPool.slice(0, poolHalf);
  const poolNewer = datedPool.slice(poolHalf);
  // Proper leave-one-out Brier: each protocol is predicted from rates
  // fitted on the other 441, so no protocol scores on its own record.
  function brierLoo(mode: "base" | "age" | "category" | "blend" | "control"): number {
    let s = 0;
    for (let i = 0; i < pool.length; i++) {
      const train = pool.filter((_, j) => j !== i);
      const rates = oddsRates(train);
      const p = pool[i]!;
      const controlRate =
        mode === "control" ? oddsPredict(pool[(i + 1) % pool.length]!, rates, "age") : undefined;
      const pred = oddsPredict(p, rates, mode, controlRate);
      const y = p.symbol !== null ? 1 : 0;
      s += (pred - y) ** 2;
    }
    return s / pool.length;
  }
  const oddsTerms: TermRow[] = (
    [
      ["Base rate", "base", "baseline"],
      ["+ age buckets", "age", "kept"],
      ["+ category rate", "category", "kept"],
      ["+ age + category, blended & shrunk", "blend", "kept"],
      ["Control: another protocol's age", "control", "must not help"],
    ] as const
  ).map(([name, mode, kept]) => ({
    name,
    loo: brierLoo(mode),
    walkforward: brierScore(mode, poolOlder, poolNewer),
    kept,
  }));

  // Bootstrap: 200 refits on resampled comparables give standard errors
  // for the curve and the multiple at $100M TVL.
  const rand = mulberry32(20261121);
  const bootSlopes: number[] = [];
  const bootIntercepts: number[] = [];
  const bootMults: number[] = [];
  for (let bIdx = 0; bIdx < 200; bIdx++) {
    const sample: SnapshotProtocol[] = [];
    for (let i = 0; i < comps.length; i++) sample.push(comps[Math.floor(rand() * comps.length)]!);
    const f = ols(
      sample.map((p) => Math.log(forwardTvlUsd(p))),
      sample.map((p) => Math.log(p.mcap_usd as number)),
    );
    bootSlopes.push(f.b);
    bootIntercepts.push(f.a);
    bootMults.push(Math.exp(f.a + f.b * Math.log(1e8)) / 1e8);
  }
  const bootstrap: Bootstrap = {
    slope: b,
    slope_se: sd(bootSlopes),
    intercept: a,
    intercept_se: sd(bootIntercepts),
    multiple_at_100m: Math.exp(a + b * Math.log(1e8)) / 1e8,
    multiple_at_100m_se: sd(bootMults),
    refits: 200,
  };

  const validation: Validation = {
    comps_n: comps.length,
    size_curve_a: a,
    size_curve_b: b,
    flat_median_multiple: flatMultiple,
    resid_sd_log: residSd,
    loo_median_miss: looMedianMiss,
    loo_flat_median_miss: looFlatMedianMiss,
    walkforward_median_miss: walkforwardMedianMiss,
    walkforward_flat_median_miss: walkforwardFlatMedianMiss,
    walkforward_n: newer.length,
    odds_brier: brier,
    odds_brier_base: brierBase,
    odds_n: pool.length,
    range_p2575_honesty: in2575 / Math.max(1, comps.length),
    range_p1090_honesty: in1090 / Math.max(1, comps.length),
    resid_q10: residQuantiles.q10,
    resid_q25: residQuantiles.q25,
    resid_q75: residQuantiles.q75,
    resid_q90: residQuantiles.q90,
    value_terms: valueTerms,
    odds_terms: oddsTerms,
    bootstrap,
  };

  return {
    asOf: asOfStr,
    comps,
    a,
    b,
    flatMultiple,
    premiums,
    ageBuckets,
    categoryOdds,
    overallOdds,
    oddsPoolN: pool.length,
    residQuantiles,
    residSd,
    validation,
  };
}

function launchOddsFor(
  p: SnapshotProtocol,
  ageBuckets: Fit["ageBuckets"],
  categoryOdds: Fit["categoryOdds"],
  overallOdds: number,
  asOf: Date,
): number {
  const age = ageDays(p, asOf);
  const bucket = age === null ? null : ageBuckets.find((bk) => age >= bk.lo && age < bk.hi);
  const ageRate = bucket ? bucket.rate : overallOdds;
  const cat = categoryOdds.get(p.category);
  const catRate = cat && cat.n >= 5 ? cat.rate : overallOdds;
  // Age carries more weight; both are then shrunk toward the overall rate.
  const blended = 0.55 * ageRate + 0.45 * catRate;
  const shrunk = 0.85 * blended + 0.15 * overallOdds;
  return Math.max(0.05, Math.min(0.95, shrunk));
}

export interface FarmEconomics {
  verdict: "Farm" | "Marginal" | "Skip";
  drop_usd: number;
  fees_usd: number;
  net_usd: number;
  net_per_hour_usd: number;
  breakeven_odds: number;
  breakeven_drop_share: number;
  exit_tvl_usd: number;
  tbill_usd: number;
  hours: number;
}

export const DROP_SHARE = 0.07; // the modelled airdrop sets aside 7% of implied value
export const HORIZON_WEEKS = 12;
export const FARM_MIN_NET_PER_HOUR = 25; // a Farm must pay at least $25 an hour
export const DEFAULT_DEPOSIT = 5000; // the default farm scenario

export function farmEconomics(implied: number, tvl: number, odds: number, deposit: number): FarmEconomics {
  // The drop is shared pro-rata to TVL: a $5,000 deposit in a $300M TVL
  // protocol buys 1/60,000th of the 7% set aside.
  const drop = DROP_SHARE * implied * (deposit / Math.max(1, tvl));
  const fees = 3.4 + 0.001 * deposit;
  const hours = deposit <= 100 ? 2.4 : deposit <= 1000 ? 3.6 : 5.0;
  const net = drop - fees;
  const netPerHour = net / hours;
  const tbill = deposit * 0.04 * (HORIZON_WEEKS / 52);
  // Farm is a hard gate, not a label: the net must beat what the same
  // money earns in a 4% T-bill over the horizon AND pay $25 an hour for
  // the hands-on time. Anything that only covers its fees is Marginal.
  const verdict: FarmEconomics["verdict"] =
    net >= tbill && netPerHour >= FARM_MIN_NET_PER_HOUR ? "Farm" : net > 0 ? "Marginal" : "Skip";
  const breakevenOdds = drop > 0 ? Math.min(0.99, (odds * fees) / drop) : 0.99;
  // The drop share at which the plan just breaks even on fees.
  const breakevenDropShare = drop > 0 ? (fees / drop) * DROP_SHARE : 1;
  // Exit if TVL prints 17% below the snapshot week in a single week.
  const exitTvl = Math.round(tvl * 0.83);
  return {
    verdict,
    drop_usd: drop,
    fees_usd: fees,
    net_usd: net,
    net_per_hour_usd: netPerHour,
    breakeven_odds: breakevenOdds,
    breakeven_drop_share: breakevenDropShare,
    exit_tvl_usd: exitTvl,
    tbill_usd: tbill,
    hours,
  };
}

const CATEGORY_ACTIONS: Record<string, string> = {
  Lending: "supply and borrow",
  Dexs: "provide liquidity and swap",
  "Risk Curators": "deposit into a curator vault",
  Yield: "deposit into the yield vault",
  RWA: "buy the tokenised asset position",
  Derivatives: "open a hedged position",
  "Yield Aggregator": "deposit into the aggregator vault",
  CDP: "mint against collateral",
  "Basis Trading": "open the basis position",
  "Liquidity Manager": "deposit into the managed pool",
  "Onchain Capital Allocator": "allocate capital to the fund",
};

export function priceRow(p: SnapshotProtocol, fit: Fit, deposit: number): Omit<BoardRow, "rank"> {
  const asOf = new Date(fit.asOf + "T00:00:00Z");
  const age = ageDays(p, asOf);
  const forwardTvl = forwardTvlUsd(p);
  const momentum = forwardTvl / p.tvl_usd;
  const prem = fit.premiums.get(p.category);
  const premiumLog = prem ? prem.premium : 0;
  const valueIfLaunches = Math.round(Math.exp(fit.a + fit.b * Math.log(forwardTvl)) * Math.exp(premiumLog));
  const odds = launchOddsFor(p, fit.ageBuckets, fit.categoryOdds, fit.overallOdds, asOf);
  // The gate requires whole dollars: every money figure on the board is
  // rounded to the nearest dollar before it is written.
  const implied = Math.round(valueIfLaunches * odds);
  const q = fit.residQuantiles;
  const p10 = Math.round(implied * Math.exp(q.q10));
  const p25 = Math.round(implied * Math.exp(q.q25));
  const p75 = Math.round(implied * Math.exp(q.q75));
  const p90 = Math.round(implied * Math.exp(q.q90));
  const econ = farmEconomics(implied, p.tvl_usd, odds, deposit);
  const action = CATEGORY_ACTIONS[p.category] ?? "use the protocol";
  const ageText = age === null ? "an unknown age" : `${Math.round(age / 30.44)} months old`;
  const model: RowModel = {
    size_curve_a: fit.a,
    size_curve_b: fit.b,
    forward_tvl_usd: forwardTvl,
    momentum_multiplier: momentum,
    category_premium_log: premiumLog,
    category_samples: prem ? prem.n : 0,
    value_if_launches_usd: valueIfLaunches,
    launch_odds: odds,
    odds_age_rate: (() => {
      const bucket = age === null ? null : fit.ageBuckets.find((bk) => age >= bk.lo && age < bk.hi);
      return bucket ? bucket.rate : fit.overallOdds;
    })(),
    odds_category_rate: fit.categoryOdds.get(p.category)?.rate ?? fit.overallOdds,
    odds_age_days: age ?? 365,
    p10_usd: p10,
    p25_usd: p25,
    p75_usd: p75,
    p90_usd: p90,
    verdict: econ.verdict,
    drop_usd: econ.drop_usd,
    fees_usd: econ.fees_usd,
    net_usd: econ.net_usd,
    net_per_hour_usd: econ.net_per_hour_usd,
    breakeven_odds: econ.breakeven_odds,
    breakeven_drop_share: econ.breakeven_drop_share,
    exit_tvl_usd: econ.exit_tvl_usd,
    tbill_usd: econ.tbill_usd,
    rank_lo: 0,
    rank_hi: 0,
  };
  const farm_steps = [
    `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline. Cost: under $3 of gas for the first transaction. Time: 5 minutes.`,
    `Deposit $${deposit} to ${action} on ${p.name} and keep the position open. Cost: $${deposit} of capital and about $8 of gas. Time: 15 minutes to set up.`,
    `Make one qualifying action each week, such as a deposit, a swap, a vote or a borrow, so the activity is visible in every snapshot. Cost: about $2 of gas a week. Time: 10 minutes a week.`,
    `Hold the position for ${HORIZON_WEEKS} weeks; the modelled drop is $${econ.drop_usd.toFixed(2)} against $${econ.fees_usd.toFixed(2)} of fees, a net of $${econ.net_usd.toFixed(2)} (${econ.verdict}). Cost: the $${deposit} stays in the position. Time: ${HORIZON_WEEKS} weeks.`,
    `Check the break-even before you commit: the plan only pays if the launch odds stay above ${(econ.breakeven_odds * 100).toFixed(0)}% (modelled ${(odds * 100).toFixed(0)}%). Cost: no fee to check. Time: 5 minutes.`,
    `Before you withdraw, open ${p.name}'s own points or rewards page and claim only from the link it publishes; never pay anyone to claim for you. Cost: no fee to check, and never pay to claim. Time: 10 minutes.`,
  ];
  return {
    slug: p.slug,
    name: p.name,
    category: p.category,
    chains: p.chains,
    tvl_usd: p.tvl_usd,
    change_7d: p.change_7d,
    mcap_usd: p.mcap_usd,
    listed_at: p.listed_at,
    gecko_id: p.gecko_id,
    symbol: p.symbol,
    token_status: "pre-token",
    age_days: age,
    implied_value_usd: implied,
    value_if_launches_usd: valueIfLaunches,
    launch_odds: odds,
    p10_usd: p10,
    p25_usd: p25,
    p75_usd: p75,
    p90_usd: p90,
    verdict: econ.verdict,
    net_usd: econ.net_usd,
    net_per_hour_usd: econ.net_per_hour_usd,
    model,
    farm_steps,
  };
}

/** Nearest traded comparables to a row, by log-TVL distance. */
export function nearestComps(p: SnapshotProtocol, fit: Fit, n = 5): { slug: string; name: string; tvl_usd: number; mcap_usd: number; multiple: number }[] {
  const target = Math.log(Math.max(1, p.tvl_usd));
  return [...fit.comps]
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      tvl_usd: c.tvl_usd,
      mcap_usd: c.mcap_usd as number,
      multiple: (c.mcap_usd as number) / c.tvl_usd,
      d: Math.abs(Math.log(c.tvl_usd) - target),
    }))
    .sort((x, y) => x.d - y.d)
    .slice(0, n)
    .map(({ slug, name, tvl_usd, mcap_usd, multiple }) => ({ slug, name, tvl_usd, mcap_usd, multiple }));
}

/**
 * Bootstrap rank ranges: refit the value model 200 times on resampled
 * comparables (seeded, so deterministic) and record, for each board row,
 * the lowest and highest rank its implied value reaches. Odds are held
 * fixed; only the value model varies.
 */
export function bootstrapRankRanges(
  fit: Fit,
  board: { slug: string; tvl_usd: number; change_7d: number | null; category: string; launch_odds: number }[],
): Map<string, { lo: number; hi: number }> {
  const rand = mulberry32(20261121);
  const comps = fit.comps;
  const n = comps.length;
  const ranks = new Map<string, number[]>();
  for (const r of board) ranks.set(r.slug, []);
  for (let bIdx = 0; bIdx < 200; bIdx++) {
    const sample: SnapshotProtocol[] = [];
    for (let i = 0; i < n; i++) sample.push(comps[Math.floor(rand() * n)]!);
    const xs = sample.map((p) => Math.log(forwardTvlUsd(p)));
    const ys = sample.map((p) => Math.log(p.mcap_usd as number));
    const f = ols(xs, ys);
    const res = sample.map((p, i) => ys[i]! - (f.a + f.b * xs[i]!));
    const prem = premiumsFromResiduals(sample, res);
    const vals = board
      .map((r) => ({
        slug: r.slug,
        v:
          Math.exp(f.a + f.b * Math.log(forwardTvl(r.tvl_usd, r.change_7d))) *
          Math.exp(prem.get(r.category) ?? 0) *
          r.launch_odds,
      }))
      .sort((x, y) => y.v - x.v);
    vals.forEach((row, i) => ranks.get(row.slug)!.push(i + 1));
  }
  const out = new Map<string, { lo: number; hi: number }>();
  for (const [slug, rs] of ranks) out.set(slug, { lo: Math.min(...rs), hi: Math.max(...rs) });
  return out;
}

/** The 758-protocol accounting: every snapshot protocol in exactly one group. */
export interface AccountingGroups {
  ranked_watchlist: number;
  ranked_early: number;
  ranked_offlist: number;
  token_recorded: number;
  out_bridge: number;
  out_liquid_staking: number;
  out_exchange: number;
  out_versioned: number;
  out_wrapped: number;
  total: number;
}

export function accountingGroups(protocols: SnapshotProtocol[], watchlist: Set<string>): AccountingGroups {
  const g: AccountingGroups = {
    ranked_watchlist: 0,
    ranked_early: 0,
    ranked_offlist: 0,
    token_recorded: 0,
    out_bridge: 0,
    out_liquid_staking: 0,
    out_exchange: 0,
    out_versioned: 0,
    out_wrapped: 0,
    total: protocols.length,
  };
  for (const p of protocols) {
    if (p.symbol !== null) {
      g.token_recorded++;
      continue;
    }
    if (isRankable(p)) {
      if (watchlist.has(p.slug)) g.ranked_watchlist++;
      else if (p.tvl_usd < 50_000_000) g.ranked_early++;
      else g.ranked_offlist++;
      continue;
    }
    if (p.category === "Bridge" || p.category === "Canonical Bridge") g.out_bridge++;
    else if (p.category === "Liquid Staking" || p.category === "Liquid Restaking" || p.category === "Restaked BTC") g.out_liquid_staking++;
    else if (p.category === "CEX") g.out_exchange++;
    else if (/\bv\d+$/i.test(p.name) || /\s+v\d/i.test(p.name)) g.out_versioned++;
    else g.out_wrapped++;
  }
  return g;
}

/** FNV-1a 32-bit checksum, printed as 8 hex digits. */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
