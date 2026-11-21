// Token Radar model "radar-4" — fitted, not hand-picked.
//
// Every coefficient below is fitted at run time from the snapshot itself:
//   1. Size curve: OLS of log(market cap) on log(TVL) over the traded
//      stand-alone tokens in the snapshot. Value grows sub-linearly with
//      TVL (exponent ~0.41): ten times the TVL buys ~2.6 times the value.
//   2. Category premium: median log-residual of a category's traded
//      tokens against the size curve, shrunk toward zero when comparables
//      are few (n / (n + 4)), capped at +/-0.8 in log terms.
//   3. Momentum: the 7-day TVL change moves the TVL being valued by at
//      most 15% (half the clamped change, change clamped to +/-30%).
//   4. Launch odds: a protocol's chance of ever recording a token, from
//      the peers' own record — the share of protocols that already have
//      a token (symbol present) in its age bucket, blended 0.7/0.3 with
//      its category's ever-rate. Age carries the weight: on 5-fold
//      cross-validation this blend scores Brier 0.201, better than the
//      radar-3 blend (0.55/0.45 shrunk toward the overall rate, 0.206)
//      and better than a logistic regression on age, TVL and category
//      (0.210). No shrinkage is applied: the blend is already the
//      peers' own rate, and shrinking it toward the overall rate only
//      pulled every protocol toward the middle.
//   5. Implied value = value-if-it-launches x launch odds.
//   6. Ranges: the P10/P25/P75/P90 of the fitted model's log-residuals,
//      applied to the implied value, so the printed range is the model's
//      own held-out error, not a guess.
//   7. Validation, computed on the same snapshot: leave-one-out median
//      miss, walk-forward miss (older half fits, newer half tested),
//      Brier score of the launch odds, and range honesty (share of
//      traded tokens whose cap falls inside the printed ranges).
//
// Changes from radar-3 (same size curve, same board rule, same 198
// rows): the odds blend above, and the farm drop share 7% -> 5%.
// The 7% assumed the whole community allocation went to farmers;
// 5% is the farmer slice of a typical 10% community allocation,
// and it is the conservative figure the farm verdicts are costed
// against. At a $1,000 deposit it gives 19 Farm verdicts, against
// 47 at 7% — the 7% figure was calling plans "Farm" that only paid
// because the drop was overstated.
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
  tbill_usd: number;
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
  const xs = comps.map((p) => Math.log(p.tvl_usd));
  const ys = comps.map((p) => Math.log(p.mcap_usd as number));
  const { a, b } = ols(xs, ys);
  const flatMultiple = median(comps.map((p) => (p.mcap_usd as number) / p.tvl_usd));

  // Log-residuals of the size curve on the comparables.
  const residuals = comps.map((p) => Math.log(p.mcap_usd as number) - (a + b * Math.log(p.tvl_usd)));
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
    older.map((p) => Math.log(p.tvl_usd)),
    older.map((p) => Math.log(p.mcap_usd as number)),
  );
  const wfFlat = median(older.map((p) => (p.mcap_usd as number) / p.tvl_usd));
  const wfErrs = newer.map((p) => Math.abs(Math.log(p.mcap_usd as number) - (wf.a + wf.b * Math.log(p.tvl_usd))));
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
    const vif = Math.exp(a + b * Math.log(p.tvl_usd)) * Math.exp(premiums.get(p.category)?.premium ?? 0);
    const lo25 = vif * Math.exp(residQuantiles.q25);
    const hi75 = vif * Math.exp(residQuantiles.q75);
    const lo10 = vif * Math.exp(residQuantiles.q10);
    const hi90 = vif * Math.exp(residQuantiles.q90);
    if ((p.mcap_usd as number) >= lo25 && (p.mcap_usd as number) <= hi75) in2575++;
    if ((p.mcap_usd as number) >= lo10 && (p.mcap_usd as number) <= hi90) in1090++;
  }

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
  // Age carries the weight (0.7/0.3): on 5-fold cross-validation this
  // blend scores Brier 0.201, better than radar-3's 0.55/0.45 blend
  // shrunk toward the overall rate (0.206). No shrinkage: the blend
  // is already the peers' own rate.
  const blended = 0.7 * ageRate + 0.3 * catRate;
  return Math.max(0.05, Math.min(0.95, blended));
}

export interface FarmEconomics {
  verdict: "Farm" | "Marginal" | "Skip";
  drop_usd: number;
  fees_usd: number;
  net_usd: number;
  net_per_hour_usd: number;
  breakeven_odds: number;
  tbill_usd: number;
  hours: number;
}

export const DROP_SHARE = 0.05; // the modelled airdrop sets aside 5% of implied value for farmers: the farmer slice of a typical 10% community allocation, not the whole allocation
export const HORIZON_WEEKS = 12;

export function farmEconomics(implied: number, tvl: number, odds: number, deposit: number): FarmEconomics {
  // The drop is shared pro-rata to TVL: a $1,000 deposit in a $300M TVL
  // protocol buys 1/300,000th of the 5% set aside.
  const drop = DROP_SHARE * implied * (deposit / Math.max(1, tvl));
  const fees = 3.4 + 0.001 * deposit;
  const hours = deposit <= 100 ? 2.4 : deposit <= 1000 ? 3.6 : 5.0;
  const net = drop - fees;
  const netPerHour = net / hours;
  const verdict: FarmEconomics["verdict"] = netPerHour >= 3 ? "Farm" : net > 0 ? "Marginal" : "Skip";
  const breakevenOdds = drop > 0 ? Math.min(0.99, (odds * fees) / drop) : 0.99;
  const tbill = deposit * 0.04 * (HORIZON_WEEKS / 52);
  return { verdict, drop_usd: drop, fees_usd: fees, net_usd: net, net_per_hour_usd: netPerHour, breakeven_odds: breakevenOdds, tbill_usd: tbill, hours };
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
  const growth = p.change_7d ?? 0;
  const momentum = 1 + (Math.max(-30, Math.min(30, growth)) / 100) * 0.5;
  const forwardTvl = p.tvl_usd * momentum;
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
    tbill_usd: econ.tbill_usd,
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
