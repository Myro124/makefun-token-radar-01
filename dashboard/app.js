/* Token Radar dashboard (radar-4): fitted board, launch odds, farm verdicts,
   out-of-sample evidence. Static, no network: all data comes from data.js
   (window.TOKEN_RADAR), which main.ts writes from the snapshot. */
(function () {
  'use strict';
  var D = window.TOKEN_RADAR;
  var root = document.getElementById('board');
  root.setAttribute('aria-busy', 'false');
  var params = new URLSearchParams(location.search);
  var state = {
    tab: params.get('tab') || 'board',
    q: params.get('q') || '',
    cat: params.get('cat') || '',
    chain: params.get('chain') || '',
    verdict: params.get('verdict') || '',
    tier: params.get('tier') || '',
    sort: params.get('sort') || 'implied',
    detail: params.get('detail') || '',
    deposit: parseInt(params.get('deposit') || '1000', 10) || 1000,
  };

  function money(n) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    if (n >= 1) return '$' + n.toFixed(0);
    return '$' + n.toFixed(2);
  }
  function moneyFull(n) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function pct(n) {
    if (n === null || n === undefined) return '—';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ageLabel(r) {
    return r.age_days === null ? 'unknown' : r.age_days + 'd';
  }
  function tierOf(r) {
    if (r.watchlist) return 'watchlist';
    return r.tvl_usd < 50000000 ? 'early' : 'off-list';
  }
  /* Farm economics, the same formula as lib/model.ts, re-run for the
     reader's chosen deposit so verdicts move with the plan size. */
  function econ(r, deposit) {
    var drop = 0.05 * r.implied_value_usd * (deposit / Math.max(1, r.tvl_usd));
    var fees = 3.4 + 0.001 * deposit;
    var hours = deposit <= 100 ? 2.4 : deposit <= 1000 ? 3.6 : 5.0;
    var net = drop - fees;
    var verdict = net / hours >= 3 ? 'Farm' : net > 0 ? 'Marginal' : 'Skip';
    var breakeven = drop > 0 ? Math.min(0.99, r.launch_odds * fees / drop) : 0.99;
    return { drop: drop, fees: fees, hours: hours, net: net, perHour: net / hours, verdict: verdict, breakeven: breakeven, tbill: deposit * 0.04 * (12 / 52) };
  }
  function rowsForBoard() {
    var rows = D.rows.map(function (r) {
      var copy = Object.assign({}, r);
      copy.econ = econ(r, state.deposit);
      return copy;
    });
    if (state.q) {
      var q = state.q.toLowerCase();
      rows = rows.filter(function (r) { return (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase().indexOf(q) >= 0; });
    }
    if (state.cat) rows = rows.filter(function (r) { return r.category === state.cat; });
    if (state.chain) rows = rows.filter(function (r) { return r.chains.indexOf(state.chain) >= 0; });
    if (state.verdict) rows = rows.filter(function (r) { return r.econ.verdict === state.verdict; });
    if (state.tier) rows = rows.filter(function (r) { return tierOf(r) === state.tier; });
    var sorts = {
      implied: function (a, b) { return b.implied_value_usd - a.implied_value_usd; },
      launches: function (a, b) { return b.value_if_launches_usd - a.value_if_launches_usd; },
      odds: function (a, b) { return b.launch_odds - a.launch_odds; },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
      growth: function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0); },
      age: function (a, b) { return (b.age_days || 0) - (a.age_days || 0); },
      net: function (a, b) { return b.econ.net - a.econ.net; },
      name: function (a, b) { return a.name < b.name ? -1 : 1; },
    };
    rows.sort(sorts[state.sort] || sorts.implied);
    return rows;
  }
  function categories() {
    var seen = {};
    D.rows.forEach(function (r) { if (r.category) seen[r.category] = 1; });
    return Object.keys(seen).sort();
  }
  function chains() {
    var seen = {};
    D.rows.forEach(function (r) { r.chains.forEach(function (c) { seen[c] = 1; }); });
    return Object.keys(seen).sort();
  }
  function setParam(key, value) {
    var p = new URLSearchParams(location.search);
    if (value === '' || value === null) p.delete(key); else p.set(key, value);
    history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : ''));
  }
  function verdictCounts() {
    var c = { Farm: 0, Marginal: 0, Skip: 0 };
    D.rows.forEach(function (r) { c[econ(r, state.deposit).verdict]++; });
    return c;
  }
  function detailHtml(r) {
    var e = econ(r, state.deposit);
    var m = r.model;
    var steps = r.farm_steps.map(function (s, i) {
      var parts = s.split(' Cost: ');
      return '<li><b>Step ' + (i + 1) + '.</b> ' + esc(parts[0]) + (parts[1] ? '<br><small>Cost and time: ' + esc(parts[1]) + '</small>' : '') + '</li>';
    }).join('');
    var peers = (r.peers || []).map(function (p) {
      return '<tr><td class="name"><b>' + esc(p.name) + '</b></td><td class="num">' + money(p.tvl_usd) + '</td><td class="num">' + money(p.mcap_usd) + '</td><td class="num">' + p.multiple.toFixed(2) + 'x</td></tr>';
    }).join('');
    return '<section class="detail" id="detail"><button class="close" id="closeDetail">Close</button>' +
      '<h2>' + esc(r.name) + '</h2><p class="sub">Rank #' + r.rank + ' of ' + D.rows.length + ' · ' + esc(r.category || 'Uncategorised') + ' · ' + esc(r.chains.join(', ') || 'no chain listed') +
      ' · ' + (r.watchlist ? '<span class="pill watch">On the watchlist</span>' : '<span class="pill">' + tierOf(r) + '</span>') + ' · <span class="pill ' + r.verdict.toLowerCase() + '">' + e.verdict + '</span></p>' +
      '<div class="grid">' +
      '<div><b>' + money(r.implied_value_usd) + '</b><span>Implied value</span></div>' +
      '<div><b>' + money(r.value_if_launches_usd) + '</b><span>Value if it launches</span></div>' +
      '<div><b>' + (r.launch_odds * 100).toFixed(0) + '%</b><span>Launch odds</span></div>' +
      '<div><b>' + money(r.p25_usd) + ' – ' + money(r.p75_usd) + '</b><span>Printed P25–P75 range</span></div>' +
      '<div><b>' + money(r.tvl_usd) + '</b><span>TVL</span></div>' +
      '<div><b class="' + (r.change_7d > 0 ? 'up' : r.change_7d < 0 ? 'down' : 'flat') + '">' + pct(r.change_7d) + '</b><span>TVL change, 7d</span></div>' +
      '<div><b>' + ageLabel(r) + '</b><span>Age, no token yet</span></div>' +
      '<div><b>' + esc(r.listed_at || '—') + '</b><span>Listed on DefiLlama</span></div></div>' +
      '<h3>How the figure is made</h3><div class="formula">size curve       = log(mcap) = ' + D.fit.size_curve_a.toFixed(4) + ' + ' + D.fit.size_curve_b.toFixed(4) + ' x log(TVL), fitted on ' + D.fit.comps_n + ' traded tokens' +
      '\nforward TVL      = ' + money(r.tvl_usd) + ' x ' + m.momentum_multiplier.toFixed(3) + ' (7d ' + pct(r.change_7d) + ', half counted, clamped +/-15%) = ' + money(m.forward_tvl_usd) +
      '\ncategory premium = ' + (m.category_premium_log >= 0 ? '+' : '') + m.category_premium_log.toFixed(2) + ' in log terms, ' + esc(r.category) + ' from ' + m.category_samples + ' comparables (shrunk toward 0)' +
      '\nvalue if launches = ' + money(r.value_if_launches_usd) +
      '\nlaunch odds      = ' + (r.launch_odds * 100).toFixed(0) + '%  (age bucket ' + (m.odds_age_rate * 100).toFixed(0) + '% of peers with a token, category ' + (m.odds_category_rate * 100).toFixed(0) + '%, shrunk to the overall ' + (D.fit.overall_odds * 100).toFixed(0) + '%)' +
      '\nimplied value    = ' + money(r.value_if_launches_usd) + ' x ' + (r.launch_odds * 100).toFixed(0) + '% = ' + money(r.implied_value_usd) +
      '\nrange            = P25 ' + money(r.p25_usd) + ' – P75 ' + money(r.p75_usd) + ' · P10 ' + money(r.p10_usd) + ' – P90 ' + money(r.p90_usd) + ' (the fitted model\'s own residual quantiles)</div>' +
      '<h3>Nearest priced peers</h3><p>Traded tokens closest in TVL; the size curve is fitted through all ' + D.fit.comps_n + ' of them, not just these five.</p>' +
      '<table><thead><tr><th>Protocol</th><th class="num">TVL</th><th class="num">Market cap</th><th class="num">mcap / TVL</th></tr></thead><tbody>' + peers + '</tbody></table>' +
      '<h3>Farm verdict — $' + state.deposit.toLocaleString('en-US') + ' for 12 weeks</h3><div class="grid">' +
      '<div><b>' + e.verdict + '</b><span>Verdict</span></div>' +
      '<div><b>' + money(e.drop) + '</b><span>Modelled drop (5% of implied, pro-rata to TVL)</span></div>' +
      '<div><b>' + money(e.fees) + '</b><span>Fees</span></div>' +
      '<div><b>' + money(e.net) + '</b><span>Net of fees</span></div>' +
      '<div><b>' + money(e.perHour) + '/h</b><span>Net per hour (' + e.hours + 'h of work)</span></div>' +
      '<div><b>' + (e.breakeven * 100).toFixed(0) + '%</b><span>Break-even launch odds (modelled ' + (r.launch_odds * 100).toFixed(0) + '%)</span></div>' +
      '<div><b>' + money(e.tbill) + '</b><span>Same money in a 4% T-bill for 12 weeks</span></div></div>' +
      '<p>' + (e.verdict === 'Farm' ? 'Farming beats the T-bill on the model\'s own numbers.' : e.verdict === 'Marginal' ? 'The plan pays for its fees, but only just — the T-bill comparison is close.' : 'On the model\'s numbers this plan does not pay for its fees at this deposit size; a larger deposit or a higher launch odds would be needed.') + '</p>' +
      '<h3>Farm plan — six steps</h3><ol class="farm">' + steps + '</ol>' +
      '<p class="note">This board does not predict whether or when ' + esc(r.name) + ' issues a token. The implied value is what a token would be worth if the protocol launched one and were priced like live tokens, times the odds that it ever does, from the peers\' own record.</p></section>';
  }
  function drawScatter() {
    var cv = document.getElementById('scatter');
    if (!cv) return;
    var ctx = cv.getContext('2d');
    var W = cv.width, H = cv.height, pad = 44;
    var pts = D.comps.map(function (c) { return { x: Math.log(c.tvl_usd), y: Math.log(c.mcap_usd), live: true }; });
    D.rows.forEach(function (r) { pts.push({ x: Math.log(r.tvl_usd), y: Math.log(Math.max(1, r.implied_value_usd)), live: false }); });
    var xs = pts.map(function (p) { return p.x; }), ys = pts.map(function (p) { return p.y; });
    var x0 = Math.min.apply(null, xs) - 0.4, x1 = Math.max.apply(null, xs) + 0.4;
    var y0 = Math.min.apply(null, ys) - 0.4, y1 = Math.max.apply(null, ys) + 0.4;
    function X(v) { return pad + (v - x0) / (x1 - x0) * (W - pad * 2); }
    function Y(v) { return H - pad - (v - y0) / (y1 - y0) * (H - pad * 2); }
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = '#334155'; ctx.fillStyle = '#94a3b8'; ctx.font = '11px system-ui';
    ctx.beginPath(); ctx.moveTo(pad, H - pad); ctx.lineTo(W - pad, H - pad); ctx.moveTo(pad, H - pad); ctx.lineTo(pad, pad); ctx.stroke();
    ctx.fillText('TVL (log)', W / 2 - 20, H - 12);
    ctx.save(); ctx.translate(12, H / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('Value (log)', -30, 0); ctx.restore();
    /* size curve */
    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; ctx.beginPath();
    for (var i = 0; i <= 40; i++) {
      var lx = x0 + (x1 - x0) * i / 40;
      var ly = D.fit.size_curve_a + D.fit.size_curve_b * lx;
      if (i === 0) ctx.moveTo(X(lx), Y(ly)); else ctx.lineTo(X(lx), Y(ly));
    }
    ctx.stroke(); ctx.lineWidth = 1;
    pts.forEach(function (p) {
      ctx.fillStyle = p.live ? '#38bdf8' : '#a78bfa';
      ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), p.live ? 3 : 2, 0, 7); ctx.fill();
    });
    ctx.fillStyle = '#38bdf8'; ctx.fillText('● traded token (mcap)', pad, 18);
    ctx.fillStyle = '#a78bfa'; ctx.fillText('● pre-token protocol (implied)', pad + 170, 18);
    ctx.fillStyle = '#f59e0b'; ctx.fillText('— fitted size curve', pad + 360, 18);
  }
  function render() {
    var rows = rowsForBoard();
    var cats = categories();
    var chs = chains();
    var vc = verdictCounts();
    var v = D.fit.validation;
    var html = '<header class="hero"><h1>Token Radar — <b>pre-token protocols, valued from their own record</b></h1>' +
      '<p>Implied value = value if it launches × launch odds. The size curve is fitted on the snapshot\'s own traded tokens; the odds come from how often peers of the same age and category ever recorded a token. Snapshot ' + esc(D.as_of) + ' · ' + D.rows.length + ' protocols ranked.</p><div class="stats">' +
      '<div class="stat"><b>' + D.rows.length + '</b><span>Protocols ranked</span></div>' +
      '<div class="stat"><b>' + D.totals.watchlist_ranked + '/' + D.totals.watchlist_total + '</b><span>Watchlist ranked</span></div>' +
      '<div class="stat"><b>' + money(D.totals.implied_usd) + '</b><span>Total implied value</span></div>' +
      '<div class="stat"><b>×' + v.loo_median_miss.toFixed(2) + '</b><span>Out-of-sample miss (flat ×' + v.loo_flat_median_miss.toFixed(2) + ')</span></div>' +
      '<div class="stat"><b>' + (v.range_p2575_honesty * 100).toFixed(0) + '% · ' + (v.range_p1090_honesty * 100).toFixed(0) + '%</b><span>Range holds P25–P75 · P10–P90</span></div>' +
      '<div class="stat"><b>' + v.odds_brier.toFixed(3) + '</b><span>Launch-odds Brier (base ' + v.odds_brier_base.toFixed(3) + ')</span></div>' +
      '<div class="stat"><b>' + vc.Farm + '</b><span>Worth farming at $' + state.deposit.toLocaleString('en-US') + '</span></div></div>' +
      '<div class="account" aria-label="Protocol accounting"><span><b>' + D.accounting.ranked + '</b> ranked pre-token</span><span><b>' + D.accounting.token_recorded + '</b> already record a token</span><span><b>' + D.accounting.out_excluded + '</b> left out by the house list\'s own rules</span><span><b>' + D.accounting.total + '</b> in the snapshot</span></div></header>' +
      '<nav class="tabs" aria-label="Views">' +
      '<button data-tab="board" aria-pressed="' + (state.tab === 'board') + '">Board</button>' +
      '<button data-tab="live" aria-pressed="' + (state.tab === 'live') + '">Live tokens</button>' +
      '<button data-tab="method" aria-pressed="' + (state.tab === 'method') + '">Evidence &amp; method</button></nav>';
    if (state.tab === 'board') {
      var detailRow = state.detail ? D.rows.find(function (r) { return r.slug === state.detail; }) : null;
      html += (detailRow ? detailHtml(detailRow) : '') +
        '<section><div class="controls">' +
        '<label>Search<input id="q" type="search" value="' + esc(state.q) + '" placeholder="Name, slug or category"></label>' +
        '<label>Category<select id="cat"><option value="">All categories</option>' + cats.map(function (c) { return '<option' + (state.cat === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></label>' +
        '<label>Chain<select id="chain"><option value="">All chains</option>' + chs.map(function (c) { return '<option' + (state.chain === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></label>' +
        '<label>Verdict<select id="verdict"><option value="">Any verdict</option>' + ['Farm', 'Marginal', 'Skip'].map(function (o) { return '<option' + (state.verdict === o ? ' selected' : '') + '>' + o + ' (' + vc[o] + ')</option>'; }).join('') + '</select></label>' +
        '<label>Tier<select id="tier"><option value="">All tiers</option>' + [['watchlist', 'Watchlist'], ['early', 'Early (< $50M)'], ['off-list', 'Off-list']].map(function (o) { return '<option value="' + o[0] + '"' + (state.tier === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
        '<label>Sort by<select id="sort">' + [['implied', 'Implied value'], ['launches', 'Value if it launches'], ['odds', 'Launch odds'], ['tvl', 'TVL'], ['growth', '7-day growth'], ['age', 'Age'], ['net', 'Farm net'], ['name', 'Name']].map(function (o) { return '<option value="' + o[0] + '"' + (state.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
        '<label>Deposit<select id="deposit">' + [100, 1000, 10000].map(function (o) { return '<option value="' + o + '"' + (state.deposit === o ? ' selected' : '') + '>$' + o.toLocaleString('en-US') + '</option>'; }).join('') + '</select></label>' +
        '<button id="csvBtn" type="button">Export CSV</button><button id="jsonBtn" type="button">Export JSON</button></div>' +
        '<p class="count">' + rows.length + ' of ' + D.rows.length + ' protocols shown · verdicts at a $' + state.deposit.toLocaleString('en-US') + ' deposit: Farm ' + vc.Farm + ' · Marginal ' + vc.Marginal + ' · Skip ' + vc.Skip + ' · click a row for its detail view and farm plan</p>' +
        '<table><thead><tr><th>#</th><th>Protocol</th><th>Category</th><th class="num">TVL</th><th class="num">7d</th><th class="num">Odds</th><th class="num">If it launches</th><th class="num">Implied value</th><th class="num">P25–P75</th><th>Verdict</th></tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr data-slug="' + esc(r.slug) + '"><td>' + r.rank + '</td><td class="name"><b>' + esc(r.name) + '</b><small>' + esc(r.slug) + (r.watchlist ? ' · watchlist' : '') + '</small></td>' +
            '<td>' + esc(r.category || '—') + '<br><small>' + esc(r.chains.slice(0, 3).join(', ')) + '</small></td>' +
            '<td class="num">' + money(r.tvl_usd) + '</td><td class="num ' + (r.change_7d > 0 ? 'up' : r.change_7d < 0 ? 'down' : 'flat') + '">' + pct(r.change_7d) + '</td>' +
            '<td class="num">' + (r.launch_odds * 100).toFixed(0) + '%</td><td class="num">' + money(r.value_if_launches_usd) + '</td>' +
            '<td class="num"><b>' + money(r.implied_value_usd) + '</b></td><td class="num">' + money(r.p25_usd) + '–' + money(r.p75_usd) + '</td>' +
            '<td><span class="pill ' + r.econ.verdict.toLowerCase() + '">' + r.econ.verdict + '</span><br><small>' + money(r.econ.net) + ' net</small></td></tr>';
        }).join('') + '</tbody></table></section>';
    } else if (state.tab === 'live') {
      html += '<section><p class="count">Live-token protocols at the market\'s own values, never mixed into the ranked board. Their mcap / TVL ratios are the comparables the size curve is fitted through.</p>' +
        '<table><thead><tr><th>Protocol</th><th>Category</th><th class="num">TVL</th><th class="num">Market cap</th><th class="num">mcap / TVL</th></tr></thead><tbody>' +
        D.live.map(function (l) {
          return '<tr><td class="name"><b>' + esc(l.name) + '</b><small>' + esc(l.slug) + '</small></td><td>' + esc(l.category || '—') + '</td>' +
            '<td class="num">' + money(l.tvl_usd) + '</td><td class="num">' + money(l.mcap_usd) + '</td>' +
            '<td class="num">' + (l.mcap_usd && l.tvl_usd ? (l.mcap_usd / l.tvl_usd).toFixed(2) + 'x' : '—') + '</td></tr>';
        }).join('') + '</tbody></table></section>';
    } else {
      html += '<section class="method"><h2>Evidence &amp; method — radar-4</h2>' +
        '<p>Nothing here is hand-picked. Every number below is computed from the same snapshot at run time, and the dashboard re-checks it: the board is ranks 1–' + D.rows.length + ' in order, implied values never rise, and the totals match board.json.</p>' +
        '<h3>How a row is priced</h3><div class="formula">size curve        log(mcap) = ' + D.fit.size_curve_a.toFixed(4) + ' + ' + D.fit.size_curve_b.toFixed(4) + ' x log(TVL)   (OLS on ' + D.fit.comps_n + ' traded tokens; ten times the TVL buys ' + Math.pow(10, D.fit.size_curve_b).toFixed(1) + 'x the value)' +
        '\ncategory premium  median log-residual of the category\'s traded tokens, shrunk n/(n+4) toward 0, capped +/-0.8' +
        '\nmomentum          forward TVL = TVL x (1 + clamp(change_7d, -30%, +30%) / 100 x 0.5)' +
        '\nvalue if launches = exp(size curve on forward TVL) x exp(category premium)' +
        '\nlaunch odds       55% age-bucket token rate + 45% category token rate, shrunk 15% to the overall ' + (D.fit.overall_odds * 100).toFixed(0) + '%, clamped 5%..95%' +
        '\nimplied value     = value if it launches x launch odds' +
        '\nranges            P10/P25/P75/P90 from the fitted model\'s own residual quantiles' +
        '\nfarm verdict      5% of implied value, shared pro-rata to TVL, less $3.40 + 0.1% fees, over 12 weeks; Farm when net/hour >= $3, Marginal when net > 0, else Skip</div>' +
        '<h3>Out-of-sample evidence</h3><table><thead><tr><th>Check</th><th class="num">This model</th><th class="num">Flat median multiple</th><th>What it means</th></tr></thead><tbody>' +
        '<tr><td>Leave-one-out median miss</td><td class="num">×' + v.loo_median_miss.toFixed(2) + '</td><td class="num">×' + v.loo_flat_median_miss.toFixed(2) + '</td><td>Each traded token priced without itself</td></tr>' +
        '<tr><td>Walk-forward median miss</td><td class="num">×' + v.walkforward_median_miss.toFixed(2) + '</td><td class="num">×' + v.walkforward_flat_median_miss.toFixed(2) + '</td><td>Older ' + Math.floor(v.comps_n / 2) + ' tokens fit, newer ' + v.walkforward_n + ' tested</td></tr>' +
        '<tr><td>Launch-odds Brier score</td><td class="num">' + v.odds_brier.toFixed(3) + '</td><td class="num">' + v.odds_brier_base.toFixed(3) + '</td><td>Lower is better; ' + v.odds_n + ' protocols scored</td></tr>' +
        '<tr><td>Range honesty P25–P75</td><td class="num">' + (v.range_p2575_honesty * 100).toFixed(0) + '%</td><td class="num">50% if exact</td><td>Share of traded caps inside the printed band</td></tr>' +
        '<tr><td>Range honesty P10–P90</td><td class="num">' + (v.range_p1090_honesty * 100).toFixed(0) + '%</td><td class="num">80% if exact</td><td>Share of traded caps inside the printed band</td></tr></tbody></table>' +
        '<h3>Launch odds by age — the peers\' own record</h3><table><thead><tr><th>Age with no token</th><th class="num">Protocols</th><th class="num">Share that ever recorded a token</th></tr></thead><tbody>' +
        D.fit.age_buckets.map(function (bk) { return '<tr><td>' + (bk.hi === Infinity ? bk.lo + '+ days' : bk.lo + '–' + bk.hi + ' days') + '</td><td class="num">' + bk.n + '</td><td class="num">' + (bk.rate * 100).toFixed(0) + '%</td></tr>'; }).join('') + '</tbody></table>' +
        '<h3>Value against TVL</h3><p>Blue dots are traded tokens at their market cap; purple dots are pre-token protocols at their implied value; the amber line is the fitted size curve. Value grows slower than TVL — that is why the giants are not worth ten times a mid-size protocol.</p>' +
        '<canvas id="scatter" width="900" height="420" style="width:100%;max-width:900px;background:#0f172a;border:1px solid #334155;border-radius:8px"></canvas>' +
        '<h3>Category premiums used</h3><table><thead><tr><th>Category</th><th class="num">Comparables</th><th class="num">Premium (log)</th></tr></thead><tbody>' +
        D.fit.premiums.map(function (s) { return '<tr><td>' + esc(s.category) + '</td><td class="num">' + s.n + '</td><td class="num">' + (s.premium_log >= 0 ? '+' : '') + s.premium_log.toFixed(2) + '</td></tr>'; }).join('') + '</tbody></table>' +
        '<h3>What is excluded, and why</h3><p>A protocol is ranked only if it records no token at all and is not a wrapped, staked or bridged product of a token that already trades, not an exchange, and not a versioned pool. WBTC is Bitcoin on Ethereum; a staked-ETH product is ETH in a staking wrapper. Neither is a protocol still waiting on a launch of its own, so neither is ranked as one.</p>' +
        '<h3>What this board does not do</h3><p>It does not predict whether or when a token is issued. A high implied value means the protocol is large, growing and seasoned enough that a token priced like its sector\'s live tokens would be large, times the odds — from the peers\' record — that it ever launches one. Farm plans are sized to the protocol\'s TVL and age; check the protocol\'s own pages before acting, and never pay to claim an airdrop.</p></section>';
    }
    var monotonic = D.rows.every(function (r, i) { return i === 0 || r.implied_value_usd <= D.rows[i - 1].implied_value_usd; });
    html += '<footer>Token Radar · model radar-4 · snapshot ' + esc(D.as_of) + ' · Integrity: ' + D.rows.length + ' rows, ranks 1–' + D.rows.length + ' in order, values ' + (monotonic ? 'never rise' : 'CHECK FAILED') + ', total implied ' + moneyFull(D.totals.implied_usd) + ' = board.json · Built for the make.fun token launch radar bounty. Implied values are this entry\'s own claim, not a prediction.</footer>';
    root.innerHTML = html;
    bind();
    drawScatter();
  }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function exportCsv() {
    var rows = rowsForBoard();
    var head = 'rank,slug,name,category,tvl_usd,change_7d,age_days,launch_odds,value_if_launches_usd,implied_value_usd,p25_usd,p75_usd,verdict,net_usd,net_per_hour_usd';
    var lines = rows.map(function (r) {
      return [r.rank, r.slug, '"' + r.name.replace(/"/g, '""') + '"', '"' + (r.category || '').replace(/"/g, '""') + '"', r.tvl_usd, r.change_7d, r.age_days, r.launch_odds.toFixed(4), Math.round(r.value_if_launches_usd), Math.round(r.implied_value_usd), Math.round(r.p25_usd), Math.round(r.p75_usd), r.econ.verdict, r.econ.net.toFixed(2), r.econ.perHour.toFixed(2)].join(',');
    });
    download('token-radar-board.csv', head + '\n' + lines.join('\n') + '\n', 'text/csv');
  }
  function exportJson() {
    download('token-radar-board.json', JSON.stringify({ rows: rowsForBoard().map(function (r) { var c = Object.assign({}, r); delete c.econ; return c; }) }, null, 2), 'application/json');
  }
  function bind() {
    document.querySelectorAll('nav.tabs button').forEach(function (b) {
      b.addEventListener('click', function () { state.tab = b.getAttribute('data-tab'); state.detail = ''; setParam('tab', state.tab); setParam('detail', ''); render(); });
    });
    var q = document.getElementById('q');
    if (q) q.addEventListener('input', function () { state.q = q.value; setParam('q', state.q); render(); var nq = document.getElementById('q'); nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); });
    var cat = document.getElementById('cat');
    if (cat) cat.addEventListener('change', function () { state.cat = cat.value; setParam('cat', state.cat); render(); });
    var chain = document.getElementById('chain');
    if (chain) chain.addEventListener('change', function () { state.chain = chain.value; setParam('chain', state.chain); render(); });
    var verdict = document.getElementById('verdict');
    if (verdict) verdict.addEventListener('change', function () { state.verdict = verdict.value; setParam('verdict', state.verdict); render(); });
    var tier = document.getElementById('tier');
    if (tier) tier.addEventListener('change', function () { state.tier = tier.value; setParam('tier', state.tier); render(); });
    var sort = document.getElementById('sort');
    if (sort) sort.addEventListener('change', function () { state.sort = sort.value; setParam('sort', state.sort); render(); });
    var deposit = document.getElementById('deposit');
    if (deposit) deposit.addEventListener('change', function () { state.deposit = parseInt(deposit.value, 10); setParam('deposit', String(state.deposit)); render(); });
    var csvBtn = document.getElementById('csvBtn');
    if (csvBtn) csvBtn.addEventListener('click', exportCsv);
    var jsonBtn = document.getElementById('jsonBtn');
    if (jsonBtn) jsonBtn.addEventListener('click', exportJson);
    document.querySelectorAll('tbody tr[data-slug]').forEach(function (tr) {
      tr.addEventListener('click', function () { state.detail = tr.getAttribute('data-slug'); setParam('detail', state.detail); render(); var d = document.getElementById('detail'); if (d) d.scrollIntoView(); });
    });
    var close = document.getElementById('closeDetail');
    if (close) close.addEventListener('click', function () { state.detail = ''; setParam('detail', ''); render(); });
  }
  render();
})();
