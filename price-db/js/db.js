/*!
 * 价格数据库 · 数据层
 * 统一存储键 priceDB.v1（liguanya.github.io 同源，五站与门户共享）
 * 数据结构：
 * {
 *   version: 1,
 *   updatedAt: '2026-11-13T06:00:00.000Z',
 *   items: [{
 *     id, prof, cat, brand, name, price, date,
 *     history: [{ price, date, at }],        // 价格变动记录，最多保留 5 条
 *     createdAt, updatedAt, src
 *   }]
 * }
 */
(function (global) {
  'use strict';

  var KEY = 'priceDB.v1';
  var MAX_HISTORY = 5;

  // 五大专业 19 个品类（与门户概算/预算板块对应）
  var PROFESSIONS = [
    { key: 'plumbing', name: '给排水', icon: '🚿', color: '#2b8a9d',
      cats: ['洁具类', '管道类', '阀门类', '给排水设备类', '给排水其他类'] },
    { key: 'hvac', name: '暖通', icon: '❄️', color: '#3a7bd5',
      cats: ['通风空调设备类', '风口风阀类', '暖通其他类'] },
    { key: 'electric', name: '电气', icon: '⚡', color: '#d98b1f',
      cats: ['配电箱柜类', '电缆类', '配管配线类', '电气设备类', '电气其他类'] },
    { key: 'fire', name: '消防', icon: '🚒', color: '#c0392b',
      cats: ['消防设备类', '消防管道类', '消防阀门类', '消防其他类'] },
    { key: 'intelligent', name: '智能化', icon: '🛰️', color: '#7b5ea7',
      cats: ['智能化设备类', '智能化其他类'] }
  ];

  function profOf(key) {
    for (var i = 0; i < PROFESSIONS.length; i++) if (PROFESSIONS[i].key === key) return PROFESSIONS[i];
    return null;
  }
  function profName(key) { var p = profOf(key); return p ? p.name : key; }
  function catsOf(key) { var p = profOf(key); return p ? p.cats : []; }

  // ---------- 文本归一化 ----------
  var FULL = '０１２３４５６７８９ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ（）－—／．，、×＊　';
  var HALF = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz()--/.,,×* ';

  function toHalf(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      var idx = FULL.indexOf(ch);
      out += idx >= 0 ? HALF.charAt(idx) : ch;
    }
    return out;
  }

  // 归一化：全角转半角、去空白与常见分隔符、统一小写
  function norm(s) {
    if (s === null || s === undefined) return '';
    return toHalf(String(s)).toLowerCase()
      .replace(/[\s\u3000]+/g, '')
      .replace(/[（）()【】\[\]「」《》]/g, '')
      .replace(/[·・,，、;；:：'"“”]/g, '')
      .replace(/[×xX*＊]/g, 'x');
  }

  // 规格提取：dn50 / de32 / φ50 / 50mm / s5 等
  function specs(s) {
    var t = norm(s), out = {};
    var re = /(dn|de|φ|d|s)(\d+(?:\.\d+)?)/g, m;
    while ((m = re.exec(t))) out[m[1] + m[2]] = 1;
    var re2 = /(\d+(?:\.\d+)?)(mm|mpa|kw|kva|a|v|kg|m3|m2)/g;
    while ((m = re2.exec(t))) out[m[2] + m[1]] = 1;
    return out;
  }

  // 中文关键词：连续中文串拆成 2 字词（便于「给水管」匹配「给水管道」）
  function cnWords(s) {
    var t = norm(s).replace(/[a-z0-9.\-]/g, ' '), out = {};
    var parts = t.split(/\s+/);
    parts.forEach(function (p) {
      if (!p) return;
      if (p.length <= 3) { out[p] = 1; return; }
      for (var i = 0; i + 2 <= p.length; i++) out[p.substr(i, 2)] = 1;
    });
    return out;
  }

  function words(s) {
    var t = norm(s);
    return (t.match(/[a-z]+[0-9]*|[0-9]+(?:\.[0-9]+)?/g) || []).filter(function (w) {
      return w.length >= 2 && !/^\d+$/.test(w);
    });
  }

  // 文本特征缓存：同一字符串的归一化/分词/规格只算一次（批量联动时大量复用）
  var _feat = {}, _featN = 0;
  function feat(s) {
    var k = String(s === null || s === undefined ? '' : s);
    if (Object.prototype.hasOwnProperty.call(_feat, k)) return _feat[k];
    var f = { n: norm(k), cw: cnWords(k), w: words(k), sp: specs(k) };
    if (_featN > 30000) { _feat = {}; _featN = 0; }
    _feat[k] = f; _featN++;
    return f;
  }

  // 名称相似度打分（基于预计算特征）：中文词重合 + 型号词命中 + 规格一致
  function scoreF(qf, nf) {
    if (!qf.n || !nf.n) return 0;
    if (qf.n === nf.n) return 100;
    var s = 0;
    if (nf.n.indexOf(qf.n) >= 0 || qf.n.indexOf(nf.n) >= 0) s += 12;

    var hit = 0, total = 0;
    Object.keys(qf.cw).forEach(function (k) {
      total++;
      if (nf.cw[k]) hit++;
    });
    if (total) s += (hit / total) * 10;
    if (total && hit === 0) return 0;

    var wh = 0;
    qf.w.forEach(function (w) { if (nf.w.indexOf(w) >= 0) wh++; });
    if (qf.w.length) s += (wh / qf.w.length) * 6;

    var sk = Object.keys(qf.sp);
    if (sk.length) {
      var same = 0, diff = 0;
      sk.forEach(function (k) {
        if (nf.sp[k]) same++;
        else if (Object.keys(nf.sp).some(function (k2) { return k2.replace(/\d+(\.\d+)?/, '') === k.replace(/\d+(\.\d+)?/, ''); })) diff++;
      });
      s += same * 6 - diff * 4;
    }
    return s > 0 ? s : 0;
  }

  function score(query, name) {
    if (!query || !name) return 0;
    return scoreF(feat(query), feat(name));
  }

  // ---------- 存储 ----------
  function empty() { return { version: 1, updatedAt: new Date().toISOString(), items: [] }; }

  function read() {
    try {
      var raw = global.localStorage ? global.localStorage.getItem(KEY) : null;
      if (!raw) return empty();
      var db = JSON.parse(raw);
      if (!db || !Array.isArray(db.items)) return empty();
      return db;
    } catch (e) { return empty(); }
  }

  function write(db) {
    db.version = 1;
    db.updatedAt = new Date().toISOString();
    try {
      if (global.localStorage) global.localStorage.setItem(KEY, JSON.stringify(db));
      return true;
    } catch (e) { return false; }
  }

  function keyOf(it) {
    return [it.prof, it.cat, norm(it.brand), norm(it.name)].join('|');
  }

  function newId() {
    return 'P' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

  // 批量写入：同 专业+品类+品牌+名称 视为同一条，价格变化则记入 history
  function addItems(list, opts) {
    opts = opts || {};
    var db = read();
    var idx = {};
    db.items.forEach(function (it) { idx[keyOf(it)] = it; });
    var res = { added: 0, updated: 0, unchanged: 0, skipped: 0 };
    var now = new Date().toISOString();

    list.forEach(function (raw) {
      var prof = raw.prof, cat = raw.cat;
      var brand = String(raw.brand || '').trim();
      var name = String(raw.name || '').trim();
      var price = Number(raw.price);
      if (!profOf(prof) || catsOf(prof).indexOf(cat) < 0) { res.skipped++; return; }
      if (!name || !isFinite(price) || price <= 0) { res.skipped++; return; }
      var date = raw.date || '';
      var k = keyOf({ prof: prof, cat: cat, brand: brand, name: name });
      var exist = idx[k];
      if (exist) {
        if (round2(exist.price) === round2(price) && exist.date === date) { res.unchanged++; return; }
        exist.history = exist.history || [];
        exist.history.unshift({ price: exist.price, date: exist.date, at: exist.updatedAt || '' });
        if (exist.history.length > MAX_HISTORY) exist.history.length = MAX_HISTORY;
        exist.price = round2(price);
        exist.date = date;
        exist.updatedAt = now;
        res.updated++;
      } else {
        var it = {
          id: newId(), prof: prof, cat: cat, brand: brand, name: name,
          price: round2(price), date: date, history: [],
          createdAt: now, updatedAt: now, src: opts.src || 'upload'
        };
        db.items.push(it);
        idx[k] = it;
        res.added++;
      }
    });
    write(db);
    return res;
  }

  // 关键词搜索：多关键词空格分隔，全部命中（AND）
  function search(q, opts) {
    opts = opts || {};
    var db = read();
    var words0 = String(q || '').trim().split(/\s+/).filter(Boolean);
    var out = db.items.filter(function (it) {
      if (opts.prof && it.prof !== opts.prof) return false;
      if (opts.cat && it.cat !== opts.cat) return false;
      if (opts.brand && norm(it.brand) !== norm(opts.brand)) return false;
      if (!words0.length) return true;
      var hay = norm(it.name + ' ' + it.brand);
      return words0.every(function (w) { return hay.indexOf(norm(w)) >= 0; });
    });
    if (opts.sort === 'price') out.sort(function (a, b) { return a.price - b.price; });
    else if (opts.sort === 'date') out.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    else out.sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'zh'); });
    return out;
  }

  // 组价联动用：给定项目名称，返回最匹配的数据库条目（可选品牌/专业约束）
  function lookup(name, opts) {
    opts = opts || {};
    var db = read();
    if (!db.items.length) return null;
    var best = null, bestScore = 0;
    db.items.forEach(function (it) {
      if (opts.prof && it.prof !== opts.prof) return;
      if (opts.cat && it.cat !== opts.cat) return;
      if (opts.brand && norm(it.brand) !== norm(opts.brand)) return;
      var s = score(name, it.name);
      if (s <= 0) return;
      if (opts.brand) s += 2;
      if (s > bestScore || (s === bestScore && best && String(it.date) > String(best.date))) {
        bestScore = s; best = it;
      }
    });
    if (!best || bestScore < (opts.minScore === undefined ? 8 : opts.minScore)) return null;
    return { item: best, score: bestScore };
  }

  // 批量联动查询：一次读取数据库，对多个项目名称同时打分
  // 返回 { 名称: {item,score} | null }，名称一定作为 key 存在
  function lookupBatch(names, opts) {
    opts = opts || {};
    var out = {};
    var db = read();
    var pool = db.items.filter(function (it) {
      if (opts.prof && it.prof !== opts.prof) return false;
      if (opts.cat && it.cat !== opts.cat) return false;
      if (opts.brand && norm(it.brand) !== norm(opts.brand)) return false;
      return true;
    });
    var min = opts.minScore === undefined ? 8 : opts.minScore;
    var pf = pool.map(function (it) { return { it: it, f: feat(it.name) }; });
    (names || []).forEach(function (nm) {
      var key = String(nm === null || nm === undefined ? '' : nm).trim();
      if (!key || Object.prototype.hasOwnProperty.call(out, key)) return;
      var best = null, bestScore = 0;
      var qf = feat(key);
      pf.forEach(function (p) {
        var s = scoreF(qf, p.f);
        if (s <= 0) return;
        var it = p.it;
        if (s > bestScore || (s === bestScore && best && String(it.date) > String(best.date))) { bestScore = s; best = it; }
      });
      out[key] = (best && bestScore >= min) ? { item: best, score: bestScore } : null;
    });
    return out;
  }

  function removeByIds(ids) {
    var set = {};
    ids.forEach(function (id) { set[id] = 1; });
    var db = read();
    var before = db.items.length;
    db.items = db.items.filter(function (it) { return !set[it.id]; });
    write(db);
    return before - db.items.length;
  }

  function clearAll() { var db = empty(); write(db); return db; }

  function stats() {
    var db = read();
    var byProf = {}, byCat = {};
    PROFESSIONS.forEach(function (p) {
      byProf[p.key] = { name: p.name, total: 0, cats: {} };
      p.cats.forEach(function (c) { byProf[p.key].cats[c] = 0; });
    });
    db.items.forEach(function (it) {
      if (!byProf[it.prof]) return;
      byProf[it.prof].total++;
      byProf[it.prof].cats[it.cat] = (byProf[it.prof].cats[it.cat] || 0) + 1;
      byCat[it.cat] = (byCat[it.cat] || 0) + 1;
    });
    return { total: db.items.length, updatedAt: db.updatedAt, byProf: byProf, byCat: byCat };
  }

  function exportJSON() { return JSON.stringify(read(), null, 2); }

  function importJSON(text, mode) {
    var data = JSON.parse(text);
    if (!data || !Array.isArray(data.items)) throw new Error('文件格式不正确：缺少 items 数组');
    var list = data.items.map(function (it) {
      return { prof: it.prof, cat: it.cat, brand: it.brand, name: it.name, price: it.price, date: it.date };
    });
    if (mode === 'replace') { clearAll(); }
    return addItems(list, { src: 'import' });
  }

  // Excel 行 → 条目（A序号 B品牌 C项目名称 D单价 F报价时间）
  function parseRows(aoa, prof, cat, opts) {
    opts = opts || {};
    var rows = [], bad = [];
    (aoa || []).forEach(function (r, i) {
      if (!r) return;
      var a = r[0], b = r[1], c = r[2], d = r[3], f = r[5];
      var name = String(c === null || c === undefined ? '' : c).trim();
      var brand = String(b === null || b === undefined ? '' : b).trim();
      if (!name) return;
      // 表头行跳过
      if (/项目名称|名称|材料名称|设备名称/.test(name) && /品牌|单价|序号|报价/.test(String(a || '') + String(b || '') + String(d || ''))) return;
      if (/^(项目名称|名称|材料名称|设备名称)$/.test(name)) return;
      var price = parsePrice(d);
      var date = parseDate(f);
      if (!isFinite(price) || price <= 0) { bad.push({ row: i + 1, name: name, price: d }); return; }
      rows.push({ prof: prof, cat: cat, brand: brand, name: name, price: price, date: date });
    });
    return { rows: rows, bad: bad };
  }

  function parsePrice(v) {
    if (v === null || v === undefined || v === '') return NaN;
    if (typeof v === 'number') return v;
    var s = toHalf(String(v)).replace(/[¥￥,，\s元]/g, '');
    var n = parseFloat(s);
    return isFinite(n) ? n : NaN;
  }

  // Excel 日期序列号（1900 体系）或文本日期
  function parseDate(v) {
    if (v === null || v === undefined || v === '') return '';
    if (typeof v === 'number' && v > 20000 && v < 80000) {
      var ms = Math.round((v - 25569) * 86400 * 1000);
      var d = new Date(ms);
      if (!isNaN(d.getTime())) {
        var mm = ('0' + (d.getUTCMonth() + 1)).slice(-2), dd = ('0' + d.getUTCDate()).slice(-2);
        return d.getUTCFullYear() + '-' + mm + '-' + dd;
      }
    }
    var s = String(v).trim();
    var m = s.match(/(\d{4})\D{0,2}(\d{1,2})\D{0,2}(\d{1,2})/);
    if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    var m2 = s.match(/^(\d{1,2})\D(\d{1,2})$/);
    if (m2) return new Date().getFullYear() + '-' + ('0' + m2[1]).slice(-2) + '-' + ('0' + m2[2]).slice(-2);
    return s;
  }

  var API = {
    KEY: KEY, PROFESSIONS: PROFESSIONS, MAX_HISTORY: MAX_HISTORY,
    profOf: profOf, profName: profName, catsOf: catsOf,
    norm: norm, score: score, scoreF: scoreF, feat: feat, specs: specs, cnWords: cnWords, words: words,
    read: read, write: write, empty: empty, keyOf: keyOf,
    addItems: addItems, search: search, lookup: lookup, lookupBatch: lookupBatch,
    removeByIds: removeByIds, clearAll: clearAll, stats: stats,
    exportJSON: exportJSON, importJSON: importJSON,
    parseRows: parseRows, parsePrice: parsePrice, parseDate: parseDate,
    round2: round2
  };

  global.PriceDB = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
