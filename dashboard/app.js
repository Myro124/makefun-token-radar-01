/* Token Radar dashboard: board, detail view, live-token comparables, model sandbox.
   Static, no network: all data comes from data.js (window.RADAR). */
(function () {
  'use strict';
  var D = window.RADAR;
  var root = document.getElementById('board');
  root.setAttribute('aria-busy', 'false');
  var params = new URLSearchParams(location.search);
  var state = {
    tab: params.get('tab') || 'board',
    q: params.get('q') || '',
    cat: params.get('cat') || '',
    chain: params.get('chain') || '',
    watch: params.get('watch') === '1',
    sort: params.get('sort') || 'implied',
    detail: params.get('detail') || '',
    gw: parseFloat(params.get('gw') || '0.6'),
    mf: parseFloat(params.get('mf') || '0.55'),
  };
  if (!isFinite(state.gw)) state.gw = 0.6;
  if (!isFinite(state.mf)) state.mf = 0.55;

  function money(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n;
  }
  function pct(n) {
    if (n === null || n === undefined) return '—';
    var s = (n > 0 ? '+' : '') + n.toFixed(1) + '%';
    return s;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ageLabel(r) {
    return r.age_days === null ? 'unknown' : r.age_days + 'd';
  }
  /* Sandbox-implied value: same formula as lib/model.ts, with the reader's weights. */
  function sandboxImplied(r) {
    var growthPct = (r.growth_multiplier - 1) / D.model.growth_weight * 100;
    var growthMult = 1 + growthPct / 100 * state.gw;
    var age = r.age_days === null ? D.model.unknown_age_days : r.age_days;
    var maturity = state.mf + (1 - state.mf) * Math.min(age, D.model.maturity_days) / D.model.maturity_days;
    return Math.max(1, Math.round(r.tvl_usd * r.sector_multiple * growthMult * maturity * r.chain_multiplier));
  }
  function rowsForBoard() {
    var rows = D.rows.map(function (r) {
      var copy = Object.assign({}, r);
      copy.sandbox_value = sandboxImplied(r);
      return copy;
    });
    var sandboxOn = state.gw !== D.model.growth_weight || state.mf !== D.model.maturity_floor;
    var valueKey = sandboxOn ? 'sandbox_value' : 'implied_value_usd';
    if (state.q) {
      var q = state.q.toLowerCase();
      rows = rows.filter(function (r) { return (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase().indexOf(q) >= 0; });
    }
    if (state.cat) rows = rows.filter(function (r) { return r.category === state.cat; });
    if (state.chain) rows = rows.filter(function (r) { return r.chains.indexOf(state.chain) >= 0; });
    if (state.watch) rows = rows.filter(function (r) { return D.watchlist.indexOf(r.slug) >= 0; });
    var sorts = {
      implied: function (a, b) { return b[valueKey] - a[valueKey]; },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
      growth: function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0); },
      age: function (a, b) { return (b.age_days || 0) - (a.age_days || 0); },
      name: function (a, b) { return a.name < b.name ? -1 : 1; },
    };
    rows.sort(sorts[state.sort] || sorts.implied);
    return { rows: rows, sandboxOn: sandboxOn, valueKey: valueKey };
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
  function detailHtml(r) {
    var comps = D.live.filter(function (l) { return l.category === r.category; }).slice(0, 5);
    var base = r.tvl_usd * r.sector_multiple;
    var steps = r.farm_steps.map(function (s, i) {
      var parts = s.split(' Cost: ');
      return '<li><b>Step ' + (i + 1) + '.</b> ' + esc(parts[0]) + (parts[1] ? '<br><small>Cost and time: ' + esc(parts[1]) + '</small>' : '') + '</li>';
    }).join('');
    return '<section class="detail" id="detail"><button class="close" id="closeDetail">Close</button>' +
      '<h2>' + esc(r.name) + '</h2><p class="sub">Rank #' + r.rank + ' · ' + esc(r.category || 'Uncategorised') + ' · ' + esc(r.chains.join(', ') || 'no chain listed') +
      ' · ' + (D.watchlist.indexOf(r.slug) >= 0 ? '<span class="pill watch">On the watchlist</span>' : '<span class="pill">Early radar</span>') + '</p>' +
      '<div class="grid">' +
      '<div><b>' + money(r.implied_value_usd) + '</b><span>Implied value</span></div>' +
      '<div><b>' + money(r.tvl_usd) + '</b><span>TVL</span></div>' +
      '<div><b class="' + (r.change_7d > 0 ? 'up' : r.change_7d < 0 ? 'down' : 'flat') + '">' + pct(r.change_7d) + '</b><span>TVL change, 7d</span></div>' +
      '<div><b>' + ageLabel(r) + '</b><span>Age, no token yet</span></div>' +
      '<div><b>' + r.sector_multiple.toFixed(2) + 'x</b><span>Sector multiple</span></div>' +
      '<div><b>' + esc(r.listed_at || '—') + '</b><span>Listed on DefiLlama</span></div></div>' +
      '<h3>How the value is built</h3><div class="formula">base            = TVL ' + money(r.tvl_usd) + ' x sector multiple ' + r.sector_multiple.toFixed(2) + ' = ' + money(base) +
      '\ngrowth          = ' + pct(r.growth_pct) + ' (clamped -50%..+100%)  ->  x' + r.growth_multiplier.toFixed(2) +
      '\nmaturity        = age ' + ageLabel(r) + '  ->  x' + r.maturity_multiplier.toFixed(2) +
      '\nchain bonus     = ' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + '  ->  x' + r.chain_multiplier.toFixed(2) +
      '\nimplied value   = ' + money(r.implied_value_usd) + '</div>' +
      '<p>Live-token comparables in ' + esc(r.category || 'this category') + ': the sector multiple is ' + r.sector_multiple.toFixed(2) +
      'x, from ' + r.sector_samples + ' live protocol' + (r.sector_samples === 1 ? '' : 's') + ' in the snapshot' +
      (r.sector_samples < 3 ? ' — too few to calibrate a sector multiple, so the global live median is used' : '') + '. ' +
      (comps.length ? 'Nearest live names: ' + comps.map(function (l) { return esc(l.name) + ' (' + money(l.mcap_usd) + ')'; }).join(', ') + '.' : 'The sector\'s live protocols sit outside the top-24 live view shown on the Live tokens tab.') + '</p>' +
      '<h3>Farm plan — six steps</h3><ol class="farm">' + steps + '</ol>' +
      '<p class="note">This board does not predict whether or when ' + esc(r.name) + ' issues a token. The implied value is what a token would be worth if the protocol\'s record stayed as it is, priced like live tokens in its sector.</p></section>';
  }
  function render() {
    var board = rowsForBoard();
    var cats = categories();
    var chs = chains();
    var top = D.rows[0];
    var html = '<header class="hero"><h1>Token Radar — <b>pre-token protocols, priced</b></h1>' +
      '<p>Every protocol DefiLlama tracks that still records no token, ranked by what its launch would be worth if it were priced like the live tokens in its own sector. ' +
      'Snapshot ' + esc(D.as_of) + ' · ' + esc(D.source) + '</p><div class="stats">' +
      '<div class="stat"><b>' + D.board_size + '</b><span>Protocols ranked</span></div>' +
      '<div class="stat"><b>' + D.watchlist_size + '</b><span>On the watchlist</span></div>' +
      '<div class="stat"><b>' + D.early_size + '</b><span>Early radar</span></div>' +
      '<div class="stat"><b>' + D.live_size + '</b><span>Live tokens shown</span></div>' +
      '<div class="stat"><b>' + money(top ? top.implied_value_usd : 0) + '</b><span>Top implied value</span></div></div></header>' +
      '<nav class="tabs" aria-label="Views">' +
      '<button data-tab="board" aria-pressed="' + (state.tab === 'board') + '">Board</button>' +
      '<button data-tab="live" aria-pressed="' + (state.tab === 'live') + '">Live tokens</button>' +
      '<button data-tab="method" aria-pressed="' + (state.tab === 'method') + '">Model &amp; method</button></nav>';
    if (state.tab === 'board') {
      var detailRow = state.detail ? D.rows.find(function (r) { return r.slug === state.detail; }) : null;
      html += (detailRow ? detailHtml(detailRow) : '') +
        '<section><div class="sandbox"><h3 style="margin:0">Model sandbox — change the weights, re-rank the board</h3>' +
        '<label>Growth weight: <output id="gwOut">' + state.gw.toFixed(2) + '</output></label>' +
        '<input type="range" id="gw" min="0" max="1" step="0.05" value="' + state.gw + '">' +
        '<label>Maturity floor: <output id="mfOut">' + state.mf.toFixed(2) + '</output></label>' +
        '<input type="range" id="mf" min="0.3" max="0.8" step="0.05" value="' + state.mf + '">' +
        (board.sandboxOn ? '<p>Sandbox values are shown in the Implied column; the published board uses growth weight ' + D.model.growth_weight + ' and maturity floor ' + D.model.maturity_floor + '.</p>' : '<p>Move a slider to see how the ranking responds. The published board uses the weights above.</p>') + '</div>' +
        '<div class="controls">' +
        '<label>Search<input id="q" type="search" value="' + esc(state.q) + '" placeholder="Name, slug or category"></label>' +
        '<label>Category<select id="cat"><option value="">All categories</option>' + cats.map(function (c) { return '<option' + (state.cat === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></label>' +
        '<label>Chain<select id="chain"><option value="">All chains</option>' + chs.map(function (c) { return '<option' + (state.chain === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></label>' +
        '<label>Sort by<select id="sort">' + [['implied', 'Implied value'], ['tvl', 'TVL'], ['growth', '7-day growth'], ['age', 'Age'], ['name', 'Name']].map(function (o) { return '<option value="' + o[0] + '"' + (state.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
        '<label class="check"><input id="watch" type="checkbox"' + (state.watch ? ' checked' : '') + '> Watchlist only</label></div>' +
        '<p class="count">' + board.rows.length + ' of ' + D.board_size + ' protocols shown · click a row for its detail view and farm plan</p>' +
        '<table><thead><tr><th>#</th><th>Protocol</th><th>Category</th><th class="num">TVL</th><th class="num">7d</th><th class="num">Age</th><th class="num">Implied value</th></tr></thead><tbody>' +
        board.rows.map(function (r) {
          return '<tr data-slug="' + esc(r.slug) + '"><td>' + r.rank + '</td><td class="name"><b>' + esc(r.name) + '</b><small>' + esc(r.slug) + (D.watchlist.indexOf(r.slug) >= 0 ? ' · watchlist' : '') + '</small></td>' +
            '<td>' + esc(r.category || '—') + '<br><small>' + esc(r.chains.slice(0, 3).join(', ')) + '</small></td>' +
            '<td class="num">' + money(r.tvl_usd) + '</td><td class="num ' + (r.change_7d > 0 ? 'up' : r.change_7d < 0 ? 'down' : 'flat') + '">' + pct(r.change_7d) + '</td>' +
            '<td class="num">' + ageLabel(r) + '</td><td class="num"><b>' + money(board.sandboxOn ? r.sandbox_value : r.implied_value_usd) + '</b></td></tr>';
        }).join('') + '</tbody></table></section>';
    } else if (state.tab === 'live') {
      html += '<section><p class="count">Live-token protocols are shown at the market\'s own values, never mixed into the ranked board. Their mcap / TVL ratios calibrate the sector multiples the board uses.</p>' +
        '<table><thead><tr><th>Protocol</th><th>Category</th><th class="num">TVL</th><th class="num">Market cap</th><th class="num">mcap / TVL</th><th class="num">7d</th></tr></thead><tbody>' +
        D.live.map(function (l) {
          return '<tr><td class="name"><b>' + esc(l.name) + '</b><small>' + esc(l.slug) + '</small></td><td>' + esc(l.category || '—') + '</td>' +
            '<td class="num">' + money(l.tvl_usd) + '</td><td class="num">' + money(l.mcap_usd) + '</td>' +
            '<td class="num">' + (l.mcap_usd && l.tvl_usd ? (l.mcap_usd / l.tvl_usd).toFixed(2) + 'x' : '—') + '</td>' +
            '<td class="num ' + (l.change_7d > 0 ? 'up' : l.change_7d < 0 ? 'down' : 'flat') + '">' + pct(l.change_7d) + '</td></tr>';
        }).join('') + '</tbody></table></section>';
    } else {
      html += '<section class="method"><h2>Model &amp; method — radar-2</h2>' +
        '<p>The implied value follows only from the snapshot\'s own figures: TVL, seven-day growth, how long the protocol has run with no token, how many chains it runs on, and what live tokens in its sector actually trade for.</p>' +
        '<div class="formula">sector multiple  = median mcap / TVL of live tokens in the same category\n                  (3+ live protocols; otherwise the global live median, ' + D.global_multiple.toFixed(2) + 'x; clamped 0.05x..0.90x)\nbase             = TVL x sector multiple\ngrowth multiplier = 1 + clamp(change_7d, -50%, +100%) / 100 x 0.6\nmaturity          = 0.55 + 0.45 x min(age_days, 1460) / 1460   (age unknown: 365d)\nchain bonus       = 1 + 0.02 x min(chains - 1, 5)\nimplied value     = max(1, round(base x growth x maturity x chain bonus))</div>' +
        '<h3>Sector multiples used</h3><table><thead><tr><th>Category</th><th class="num">Live protocols</th><th class="num">Median mcap / TVL</th><th class="num">Multiple used</th></tr></thead><tbody>' +
        D.sectors.map(function (s) { return '<tr><td>' + esc(s.category) + '</td><td class="num">' + s.samples + '</td><td class="num">' + s.median_mcap_tvl.toFixed(2) + 'x</td><td class="num">' + s.used_multiple.toFixed(2) + 'x</td></tr>'; }).join('') + '</tbody></table>' +
        '<h3>What is excluded, and why</h3><p>A protocol is ranked only if it records no token at all and is not a wrapped, staked or bridged product of a token that already trades, not an exchange, and not a versioned pool. WBTC is Bitcoin on Ethereum; a staked-ETH product is ETH in a staking wrapper. Neither is a protocol still waiting on a launch of its own, so neither is ranked as one.</p>' +
        '<h3>What this board does not do</h3><p>It does not predict whether or when a token is issued. A high implied value means the protocol is large, growing and seasoned enough that a token priced like its sector\'s live tokens would be large — nothing more. Farm plans are generic steps sized to the protocol\'s TVL and age; check the protocol\'s own pages before acting, and never pay to claim an airdrop.</p></section>';
    }
    html += '<footer>Token Radar · model ' + esc(D.model_version) + ' · snapshot ' + esc(D.as_of) + ' · ' + esc(D.source) + ' · Built for the make.fun token launch radar bounty. Implied values are this entry\'s own claim, not a prediction.</footer>';
    root.innerHTML = html;
    bind();
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
    var sort = document.getElementById('sort');
    if (sort) sort.addEventListener('change', function () { state.sort = sort.value; setParam('sort', state.sort); render(); });
    var watch = document.getElementById('watch');
    if (watch) watch.addEventListener('change', function () { state.watch = watch.checked; setParam('watch', state.watch ? '1' : ''); render(); });
    var gw = document.getElementById('gw');
    if (gw) gw.addEventListener('input', function () { state.gw = parseFloat(gw.value); document.getElementById('gwOut').textContent = state.gw.toFixed(2); setParam('gw', String(state.gw)); render(); });
    var mf = document.getElementById('mf');
    if (mf) mf.addEventListener('input', function () { state.mf = parseFloat(mf.value); document.getElementById('mfOut').textContent = state.mf.toFixed(2); setParam('mf', String(state.mf)); render(); });
    document.querySelectorAll('tbody tr[data-slug]').forEach(function (tr) {
      tr.addEventListener('click', function () { state.detail = tr.getAttribute('data-slug'); setParam('detail', state.detail); render(); var d = document.getElementById('detail'); if (d) d.scrollIntoView(); });
    });
    var close = document.getElementById('closeDetail');
    if (close) close.addEventListener('click', function () { state.detail = ''; setParam('detail', ''); render(); });
  }
  render();
})();
