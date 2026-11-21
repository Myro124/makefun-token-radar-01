// Token Radar (radar-4): read the sealed DefiLlama snapshot, fit the
// valuation model on its own traded tokens, rank every pre-token protocol
// by implied value = value-if-it-launches x launch odds, and write the
// board, the dashboard data, the dashboard, the screenshots and the
// dossier the judge reads.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
//
// In the grader's container the snapshot is at /input/snapshot.json and
// the output goes to /output; outside it, MAKEFUN_OUTPUT_DIR stands in
// for /output and --input names the snapshot file or its directory.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fitModel, isRankable, nearestComps, priceRow } from './lib/model.ts';
import type { BoardRow, SnapshotProtocol } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's own caps: the text cap shapes the bytes, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** --name <value> out of the arguments, or the fallback. */
function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

const inputArg = arg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
const deposit = Number(arg('deposit', '1000'));

const raw = JSON.parse(readFileSync(inputFile, 'utf8')) as {
  as_of: string;
  protocols: SnapshotProtocol[];
  watchlist: string[];
};
const snapshot = {
  asOf: raw.as_of,
  protocols: raw.protocols,
  watchlist: new Set(raw.watchlist),
};

const fit = fitModel(snapshot.protocols, snapshot.asOf);
const rankable = snapshot.protocols.filter(isRankable);
const rows: BoardRow[] = rankable
  .map((p) => priceRow(p, fit, deposit))
  .sort((x, y) => y.implied_value_usd - x.implied_value_usd)
  .map((r, i) => ({ ...r, rank: i + 1 }));

// Gate checks the kit enforces on the board (RULES.txt).
function boardIssue(): string | null {
  if (rows.length < 100) return `board holds ${rows.length} rows, fewer than 100`;
  for (const slug of snapshot.watchlist) {
    if (!rows.some((r) => r.slug === slug)) return `watchlist protocol ${slug} is not on the board`;
  }
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]!.rank !== i + 1) return `ranks are not exactly 1..${rows.length}`;
    if (i > 0 && rows[i]!.implied_value_usd > rows[i - 1]!.implied_value_usd) return `implied value rises at rank ${i + 1}`;
    if (rows[i]!.farm_steps.length < 3 || rows[i]!.farm_steps.length > 12) return `row ${rows[i]!.slug} has ${rows[i]!.farm_steps.length} farm steps, not 3..12`;
    for (const step of rows[i]!.farm_steps) {
      if (step.length < 20 || step.length > 600) return `row ${rows[i]!.slug} has a farm step of ${step.length} characters, not 20..600`;
    }
  }
  return null;
}
const issue = boardIssue();
if (issue !== null) {
  process.stderr.write(`token radar: the model wrote a board the gate refuses: ${issue}\n`);
  process.exit(1);
}

// The 758-protocol accounting: every snapshot protocol lands in exactly
// one group, so the dashboard can prove nothing was dropped silently.
const accounted = {
  ranked: rows.length,
  token_recorded: snapshot.protocols.filter((p) => p.symbol !== null).length,
  out_excluded: snapshot.protocols.filter((p) => p.symbol === null && !isRankable(p)).length,
  total: snapshot.protocols.length,
};
if (accounted.ranked + accounted.token_recorded + accounted.out_excluded !== accounted.total) {
  process.stderr.write(`token radar: accounting does not sum to ${accounted.total}\n`);
  process.exit(1);
}

const live = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0);
const dashboardData = {
  model: 'radar-4',
  as_of: snapshot.asOf,
  deposit,
  fit: {
    size_curve_a: fit.a,
    size_curve_b: fit.b,
    flat_multiple: fit.flatMultiple,
    comps_n: fit.comps.length,
    validation: fit.validation,
    age_buckets: fit.ageBuckets,
    premiums: [...fit.premiums.entries()].map(([category, v]) => ({ category, premium_log: v.premium, n: v.n })),
    overall_odds: fit.overallOdds,
    odds_pool_n: fit.oddsPoolN,
  },
  accounting: accounted,
  totals: {
    rows: rows.length,
    watchlist_ranked: rows.filter((r) => snapshot.watchlist.has(r.slug)).length,
    watchlist_total: snapshot.watchlist.size,
    tvl_usd: rows.reduce((s, r) => s + r.tvl_usd, 0),
    implied_usd: rows.reduce((s, r) => s + r.implied_value_usd, 0),
    farm: rows.filter((r) => r.verdict === 'Farm').length,
    marginal: rows.filter((r) => r.verdict === 'Marginal').length,
    skip: rows.filter((r) => r.verdict === 'Skip').length,
  },
  comps: fit.comps.map((p) => ({
    slug: p.slug,
    name: p.name,
    category: p.category,
    tvl_usd: p.tvl_usd,
    mcap_usd: p.mcap_usd,
  })),
  live: live.slice(0, 24).map((p) => ({
    slug: p.slug,
    name: p.name,
    category: p.category,
    tvl_usd: p.tvl_usd,
    mcap_usd: p.mcap_usd,
    multiple: (p.mcap_usd as number) / p.tvl_usd,
  })),
  rows: rows.map((r) => ({
    ...r,
    watchlist: snapshot.watchlist.has(r.slug),
    peers: nearestComps(
      snapshot.protocols.find((p) => p.slug === r.slug) as SnapshotProtocol,
      fit,
      5,
    ),
  })),
};

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows })}\n`);
writeFileSync(join(out, 'data.js'), `window.TOKEN_RADAR = ${JSON.stringify(dashboardData)};\n`);

/** Copy one directory's regular files into `to`, skipping names that start with a dot. */
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

const dashFiles = copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));
const shots = copyFiles(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length < 3) {
  process.stderr.write(`token radar: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view\n`);
  process.exit(1);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) {
    process.stderr.write(`token radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`);
    process.exit(1);
  }
}

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
writeFileSync(join(out, 'dossier.json'), buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));

const farmCount = rows.filter((r) => r.verdict === 'Farm').length;
process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.size} on the watchlist, ${rows.length} rows scored (${rows.filter((r) => r.tvl_usd < 50_000_000).length} below the $50M floor)\n` +
    `token radar: size curve log(mcap) = ${fit.a.toFixed(4)} + ${fit.b.toFixed(4)} log(TVL) on ${fit.comps.length} comps; LOO miss x${fit.validation.loo_median_miss.toFixed(2)} vs flat x${fit.validation.loo_flat_median_miss.toFixed(2)}; walk-forward x${fit.validation.walkforward_median_miss.toFixed(2)} vs flat x${fit.validation.walkforward_flat_median_miss.toFixed(2)}; odds Brier ${fit.validation.odds_brier.toFixed(3)} vs base ${fit.validation.odds_brier_base.toFixed(3)}\n` +
    `token radar: top ${rows[0]!.name} $${Math.round(rows[0]!.implied_value_usd).toLocaleString('en-US')} implied, ${farmCount} Farm verdicts, total implied $${Math.round(dashboardData.totals.implied_usd).toLocaleString('en-US')}\n` +
    `token radar: wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')} (${dashFiles.length} files), ${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')}\n`,
);
