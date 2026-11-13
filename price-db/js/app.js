/*!
 * 价格数据库 · 界面逻辑
 */
(function () {
  'use strict';

  var DB = window.PriceDB;
  var MAX_ROWS = 300;
  var parsed = null;      // 最近一次解析结果
  var selected = {};      // 选中 id
  var lastRows = [];      // 当前列表数据

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function money(n) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    return Number(n).toFixed(2);
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2);
  }

  // ---------- 下拉 ----------
  function fillProfs(sel, withAll, allText) {
    var html = withAll ? '<option value="">' + (allText || '全部专业') + '</option>' : '';
    DB.PROFESSIONS.forEach(function (p) {
      html += '<option value="' + p.key + '">' + p.icon + ' ' + p.name + '</option>';
    });
    sel.innerHTML = html;
  }

  function fillCats(sel, prof, withAll) {
    var cats = prof ? DB.catsOf(prof) : [];
    var html = withAll ? '<option value="">全部品类</option>'
      : (cats.length ? '' : '<option value="">请先选择专业</option>');
    cats.forEach(function (c) { html += '<option value="' + esc(c) + '">' + esc(c) + '</option>'; });
    sel.innerHTML = html;
    sel.disabled = !cats.length;
  }

  // ---------- 统计 ----------
  function renderStats() {
    var st = DB.stats();
    var html = '<div class="stat total" data-prof=""><div class="k">📦 全部条目</div><div class="v">' + st.total + '<small>条</small></div></div>';
    DB.PROFESSIONS.forEach(function (p) {
      var t = (st.byProf[p.key] || {}).total || 0;
      html += '<div class="stat" data-prof="' + p.key + '"><div class="k">' + p.icon + ' ' + p.name + '</div><div class="v">' + t + '<small>条</small></div></div>';
    });
    $('stats').innerHTML = html;
    Array.prototype.forEach.call($('stats').querySelectorAll('.stat'), function (el) {
      el.addEventListener('click', function () {
        var prof = el.getAttribute('data-prof');
        $('fProf').value = prof;
        fillCats($('fCat'), prof, true);
        Array.prototype.forEach.call($('stats').querySelectorAll('.stat'), function (x) { x.classList.remove('active'); });
        el.classList.add('active');
        render();
      });
    });
    var upd = st.updatedAt ? new Date(st.updatedAt) : null;
    $('storeTip').textContent = upd && st.total
      ? '本地存储 · ' + st.total + ' 条 · ' + upd.toLocaleString('zh-CN', { hour12: false })
      : '本地存储 · 暂无数据';
  }

  // ---------- 列表 ----------
  function currentQuery() {
    return {
      q: $('q').value,
      prof: $('fProf').value,
      cat: $('fCat').value,
      brand: $('fBrand').value.trim(),
      sort: $('sort').value
    };
  }

  function render() {
    var q = currentQuery();
    var rows = DB.search(q.q, { prof: q.prof, cat: q.cat, brand: q.brand, sort: q.sort });
    lastRows = rows;
    $('count').innerHTML = '共 <b>' + rows.length + '</b> 条' + (rows.length > MAX_ROWS ? '（列表仅显示前 ' + MAX_ROWS + ' 条，请用关键词缩小范围）' : '');
    $('empty').classList.toggle('show', rows.length === 0);
    $('empty').textContent = DB.stats().total === 0
      ? '库内暂无数据，请先上传询价单'
      : '没有匹配的记录，换个关键词试试';

    var html = '';
    rows.slice(0, MAX_ROWS).forEach(function (it) {
      var p = DB.profOf(it.prof);
      html += '<tr>' +
        '<td><input type="checkbox" class="ck" data-id="' + it.id + '"' + (selected[it.id] ? ' checked' : '') + '></td>' +
        '<td><span class="tag">' + (p ? p.icon + ' ' + p.name : esc(it.prof)) + '</span></td>' +
        '<td><span class="tag cat">' + esc(it.cat) + '</span></td>' +
        '<td class="brand-cell">' + (esc(it.brand) || '—') + '</td>' +
        '<td>' + esc(it.name) + '</td>' +
        '<td class="num">' + money(it.price) + '</td>' +
        '<td class="time-cell">' + (esc(it.date) || '—') + '</td>' +
        '<td class="time-cell">' + (it.updatedAt ? esc(it.updatedAt.slice(0, 10)) : '—') + '</td>' +
        '<td><button class="op-del" data-del="' + it.id + '">删除</button></td>' +
        '</tr>';
    });
    $('tbody').innerHTML = html;
    $('ckAll').checked = rows.length > 0 && rows.slice(0, MAX_ROWS).every(function (it) { return selected[it.id]; });
  }

  // ---------- 上传 ----------
  function readFile(file, cb) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        var ws = wb.Sheets[wb.SheetNames[0]];
        var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
        cb(null, aoa);
      } catch (err) { cb(err); }
    };
    reader.onerror = function () { cb(new Error('文件读取失败')); };
    reader.readAsArrayBuffer(file);
  }

  function showMsg(kind, text) {
    var el = $('upMsg');
    el.className = 'msg show ' + kind;
    el.innerHTML = text;
  }

  function doUpload() {
    var prof = $('upProf').value, cat = $('upCat').value;
    var file = $('upFile').files[0];
    if (!prof || !cat) { showMsg('warn', '请先选择专业与品类'); return; }
    if (!file) { showMsg('warn', '请选择询价单 Excel 文件'); return; }

    readFile(file, function (err, aoa) {
      if (err) { showMsg('err', '解析失败：' + err.message); return; }
      var pr = DB.parseRows(aoa, prof, cat);
      parsed = pr;
      if (!pr.rows.length) {
        showMsg('err', '未解析到有效数据。请确认 A 序号 / B 品牌 / C 项目名称 / D 单价 / F 报价时间，且单价为有效数字。');
        $('upPreview').classList.remove('show');
        return;
      }
      var res = DB.addItems(pr.rows, { src: 'upload' });
      var p = DB.profOf(prof);
      var msg = '<b>' + (p ? p.name : prof) + ' · ' + cat + '</b>　文件「' + esc(file.name) + '」解析有效 <b>' + pr.rows.length + '</b> 条：'
        + '新增 <b>' + res.added + '</b>，更新 <b>' + res.updated + '</b>，未变 <b>' + res.unchanged + '</b>'
        + (res.skipped ? '，跳过 <b>' + res.skipped + '</b>' : '')
        + (pr.bad.length ? '；另有 ' + pr.bad.length + ' 行单价缺失/无效已跳过（如第 ' + pr.bad.slice(0, 5).map(function (b) { return b.row; }).join('、') + ' 行）' : '');
      showMsg(res.added + res.updated ? 'ok' : 'warn', msg);

      var prev = '<table><thead><tr><th>序号</th><th>品牌</th><th>项目名称</th><th>单价</th><th>报价时间</th></tr></thead><tbody>';
      pr.rows.slice(0, 8).forEach(function (r, i) {
        prev += '<tr><td>' + (i + 1) + '</td><td>' + esc(r.brand) + '</td><td>' + esc(r.name) + '</td><td>' + money(r.price) + '</td><td>' + esc(r.date) + '</td></tr>';
      });
      prev += '</tbody></table>' + (pr.rows.length > 8 ? '<p class="more">仅预览前 8 条，共 ' + pr.rows.length + ' 条已入库</p>' : '');
      $('upPreview').innerHTML = prev;
      $('upPreview').classList.add('show');

      selected = {};
      renderStats();
      render();
    });
  }

  // ---------- 导出 ----------
  function exportXlsx() {
    var q = currentQuery();
    var rows = DB.search(q.q, { prof: q.prof, cat: q.cat, brand: q.brand, sort: q.sort });
    if (!rows.length) { alert('当前筛选结果为空，无可导出数据'); return; }
    var aoa = [['序号', '专业', '品类', '品牌', '项目名称', '单价', '报价时间', '更新时间']];
    rows.forEach(function (it, i) {
      aoa.push([i + 1, DB.profName(it.prof), it.cat, it.brand, it.name, it.price, it.date,
        it.updatedAt ? it.updatedAt.slice(0, 10) : '']);
    });
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 6 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 46 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '价格数据库');
    XLSX.writeFile(wb, '价格数据库_' + today() + '.xlsx');
  }

  function exportJson() {
    var blob = new Blob([DB.exportJSON()], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '价格数据库备份_' + today() + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function importJsonFile(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var res = DB.importJSON(String(e.target.result), 'merge');
        alert('恢复完成：新增 ' + res.added + ' 条，更新 ' + res.updated + ' 条，未变 ' + res.unchanged + ' 条' + (res.skipped ? '，跳过 ' + res.skipped + ' 条' : ''));
        selected = {};
        renderStats(); render();
      } catch (err) { alert('恢复失败：' + err.message); }
    };
    reader.readAsText(file);
  }

  // ---------- 事件 ----------
  function bind() {
    $('upProf').addEventListener('change', function () {
      fillCats($('upCat'), this.value, false);
      $('upBtn').disabled = !(this.value && $('upCat').value && $('upFile').files[0]);
    });
    $('upCat').addEventListener('change', function () {
      $('upBtn').disabled = !($('upProf').value && this.value && $('upFile').files[0]);
    });
    $('upFile').addEventListener('change', function () {
      $('upBtn').disabled = !($('upProf').value && $('upCat').value && this.files[0]);
      $('upPreview').classList.remove('show');
      showMsg('warn', '已选择文件：' + esc(this.files[0].name) + '，请确认专业与品类后点击「解析并导入」');
    });
    $('upBtn').addEventListener('click', doUpload);

    var timer = null;
    ['q', 'fBrand'].forEach(function (id) {
      $(id).addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(render, 200);
      });
    });
    $('fProf').addEventListener('change', function () {
      fillCats($('fCat'), this.value, true);
      render();
    });
    $('fCat').addEventListener('change', render);
    $('sort').addEventListener('change', render);
    $('resetBtn').addEventListener('click', function () {
      $('q').value = ''; $('fBrand').value = ''; $('fProf').value = '';
      fillCats($('fCat'), '', true); $('sort').value = 'name';
      Array.prototype.forEach.call($('stats').querySelectorAll('.stat'), function (x) { x.classList.remove('active'); });
      render();
    });

    $('tbody').addEventListener('click', function (e) {
      var del = e.target.getAttribute && e.target.getAttribute('data-del');
      if (del) {
        if (!confirm('确定删除该条价格记录？')) return;
        DB.removeByIds([del]);
        delete selected[del];
        renderStats(); render();
        return;
      }
      if (e.target.classList.contains('ck')) {
        var id = e.target.getAttribute('data-id');
        if (e.target.checked) selected[id] = true; else delete selected[id];
        render();
      }
    });

    $('ckAll').addEventListener('change', function () {
      var on = this.checked;
      lastRows.slice(0, MAX_ROWS).forEach(function (it) {
        if (on) selected[it.id] = true; else delete selected[it.id];
      });
      render();
    });

    $('delSel').addEventListener('click', function () {
      var ids = Object.keys(selected);
      if (!ids.length) { alert('请先勾选要删除的记录'); return; }
      if (!confirm('确定删除选中的 ' + ids.length + ' 条价格记录？')) return;
      var n = DB.removeByIds(ids);
      selected = {};
      renderStats(); render();
      alert('已删除 ' + n + ' 条');
    });

    $('clearAll').addEventListener('click', function () {
      if (!confirm('⚠️ 将清空整个价格数据库（不可恢复）。建议先「备份 JSON」。确定继续？')) return;
      if (!confirm('再次确认：清空后所有专业品类价格记录都会被删除。')) return;
      DB.clearAll();
      selected = {};
      renderStats(); render();
      showMsg('warn', '数据库已清空');
    });

    $('exportXlsx').addEventListener('click', exportXlsx);
    $('exportJson').addEventListener('click', exportJson);
    $('importJson').addEventListener('click', function () { $('jsonFile').click(); });
    $('jsonFile').addEventListener('change', function () {
      if (this.files[0]) importJsonFile(this.files[0]);
      this.value = '';
    });

    window.addEventListener('storage', function (e) {
      if (e.key === DB.KEY) { renderStats(); render(); }
    });
  }

  function init() {
    fillProfs($('upProf'), false);
    fillCats($('upCat'), $('upProf').value, false);   // 默认专业对应的品类直接可用
    fillProfs($('fProf'), true, '全部专业');
    fillCats($('fCat'), '', true);
    bind();
    renderStats();
    render();
  }

  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', init);

  window.__priceDBUI = { render: render, renderStats: renderStats, doUpload: doUpload };
})();
