/*!
 * 价格数据库 · 单元测试（node tools/unit.js）
 */
'use strict';

var path = require('path');

// ---- localStorage mock ----
var store = {};
global.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); },
  removeItem: function (k) { delete store[k]; },
  clear: function () { store = {}; }
};

var DB = require(path.join(__dirname, '..', 'js', 'db.js'));

var pass = 0, fail = 0;
function ck(name, actual, expect) {
  var ok = JSON.stringify(actual) === JSON.stringify(expect);
  if (ok) { pass++; } else { fail++; console.log('✗ ' + name + '  期望=' + JSON.stringify(expect) + ' 实际=' + JSON.stringify(actual)); }
}
function ok(name, cond) { ck(name, !!cond, true); }

console.log('== 1. 专业与品类体系 ==');
ck('专业数', DB.PROFESSIONS.length, 5);
var totalCats = DB.PROFESSIONS.reduce(function (s, p) { return s + p.cats.length; }, 0);
ck('品类总数', totalCats, 19);
ck('给排水品类', DB.catsOf('plumbing'), ['洁具类', '管道类', '阀门类', '给排水设备类', '给排水其他类']);
ck('暖通品类', DB.catsOf('hvac'), ['通风空调设备类', '风口风阀类', '暖通其他类']);
ck('电气品类', DB.catsOf('electric'), ['配电箱柜类', '电缆类', '配管配线类', '电气设备类', '电气其他类']);
ck('消防品类', DB.catsOf('fire'), ['消防设备类', '消防管道类', '消防阀门类', '消防其他类']);
ck('智能化品类', DB.catsOf('intelligent'), ['智能化设备类', '智能化其他类']);
ck('专业名', DB.profName('hvac'), '暖通');
ck('未知专业', DB.profOf('xxx'), null);

console.log('== 2. 文本归一化 ==');
ck('全角转半角', DB.norm('ＰＰＲ管（Ｓ５）'), 'ppr管s5');
ck('去空格', DB.norm(' DN 50 '), 'dn50');
ck('乘号统一', DB.norm('4×120'), '4x120');

console.log('== 3. 名称匹配打分 ==');
ok('完全一致高分', DB.score('PPR管(S5级)-DN50', 'PPR管(S5级)-DN50') >= 90);
ok('同名称不同规格不命中或低分', DB.score('PPR给水管 DN50', 'PPR给水管 DN25') < DB.score('PPR给水管 DN50', 'PPR给水管 DN50'));
ok('包含关系命中', DB.score('PPR给水管', 'PPR给水管 DN50 热熔') > 0);
ok('无关名称不命中', DB.score('配电箱', 'PPR给水管 DN50') === 0);
ok('规格一致加分', DB.score('PPR管 DN50', 'PPR管 DN50') > DB.score('PPR管 DN50', 'PPR管 DN65'));

console.log('== 4. Excel 五列解析 ==');
var aoa = [
  ['序号', '品牌', '项目名称', '单价', '单位', '报价时间'],
  [1, '联塑', 'PPR给水管 DN50', 34.88, 'm', '2026-11-01'],
  [2, '日丰', 'PPR给水管 DN50', 36.5, 'm', 46023],
  [3, '', '', '', '', ''],
  [4, '联塑', 'PPR给水管 DN32', '¥28.60', 'm', '2026/11/2'],
  [5, '联塑', '无价格材料', '', 'm', '2026-11-01']
];
var pr = DB.parseRows(aoa, 'plumbing', '管道类');
ck('有效行数', pr.rows.length, 3);
ck('无效行数', pr.bad.length, 1);
ck('首行品牌', pr.rows[0].brand, '联塑');
ck('首行名称', pr.rows[0].name, 'PPR给水管 DN50');
ck('首行单价', pr.rows[0].price, 34.88);
ck('首行日期', pr.rows[0].date, '2026-11-01');
ck('序列号日期', pr.rows[1].date, '2026-01-01');
ck('带币符号单价', pr.rows[2].price, 28.6);
ck('斜杠日期', pr.rows[2].date, '2026-11-02');
ck('表头行跳过', pr.rows.some(function (r) { return r.name === '项目名称'; }), false);

console.log('== 5. 写入与去重 ==');
DB.clearAll();
var r1 = DB.addItems(pr.rows);
ck('首次新增', r1.added, 3);
ck('首次更新', r1.updated, 0);
var r2 = DB.addItems(pr.rows);
ck('重复导入不新增', r2.added, 0);
ck('重复导入不变', r2.unchanged, 3);
var r3 = DB.addItems([{ prof: 'plumbing', cat: '管道类', brand: '联塑', name: 'PPR给水管 DN50', price: 35.5, date: '2026-11-10' }]);
ck('同键改价计更新', r3.updated, 1);
var one = DB.search('PPR给水管 DN50', { brand: '联塑' })[0];
ck('更新后价格', one.price, 35.5);
ck('更新后日期', one.date, '2026-11-10');
ck('历史价记录', one.history.length, 1);
ck('历史价原值', one.history[0].price, 34.88);
var r4 = DB.addItems([{ prof: 'plumbing', cat: '不存在类', brand: 'x', name: 'y', price: 1, date: '' }]);
ck('非法品类被跳过', r4.skipped, 1);
var r5 = DB.addItems([{ prof: 'plumbing', cat: '管道类', brand: 'x', name: '零价材料', price: 0, date: '' }]);
ck('零价被跳过', r5.skipped, 1);

console.log('== 6. 搜索 ==');
ck('关键词命中', DB.search('PPR').length, 3);
ck('多关键词 AND', DB.search('PPR DN50').length, 2);
ck('品牌过滤', DB.search('PPR', { brand: '日丰' }).length, 1);
ck('品类过滤', DB.search('PPR', { cat: '洁具类' }).length, 0);
ck('专业过滤', DB.search('PPR', { prof: 'hvac' }).length, 0);
ck('空关键词返回全部', DB.search('').length, 3);
ck('按价格排序', DB.search('PPR', { sort: 'price' })[0].price <= DB.search('PPR', { sort: 'price' })[2].price, true);

console.log('== 7. 联动查询 lookup ==');
var lk = DB.lookup('PPR给水管 DN50');
ok('命中返回条目', lk && lk.item.name === 'PPR给水管 DN50');
ck('命中品牌', lk.item.brand, '联塑');
ok('低相关不命中', DB.lookup('消防水泵接合器') === null);
ok('阈值可调', DB.lookup('PPR给水管 DN50', { minScore: 200 }) === null);
var lkBrand = DB.lookup('PPR给水管 DN50', { brand: '日丰' });
ck('品牌约束命中', lkBrand.item.brand, '日丰');

console.log('== 7b. 批量联动查询 lookupBatch ==');
var batch = DB.lookupBatch(['PPR给水管 DN50', '消防水泵接合器', 'PPR给水管 DN50']);
ck('批量结果键数（去重）', Object.keys(batch).length, 2);
ck('批量命中名称', batch['PPR给水管 DN50'].item.name, 'PPR给水管 DN50');
ck('批量未命中为 null', batch['消防水泵接合器'], null);
ok('批量专业过滤', DB.lookupBatch(['PPR给水管 DN50'], { prof: 'hvac' })['PPR给水管 DN50'] === null);
ck('批量阈值可调', DB.lookupBatch(['PPR给水管 DN50'], { minScore: 200 })['PPR给水管 DN50'], null);
ok('批量与单条一致', JSON.stringify(batch['PPR给水管 DN50'].item.id) === JSON.stringify(DB.lookup('PPR给水管 DN50').item.id));
var t0 = Date.now();
var manyNames = [];
for (var mi = 0; mi < 400; mi++) manyNames.push('PPR给水管 DN' + (20 + (mi % 12) * 10));
DB.lookupBatch(manyNames, { prof: 'plumbing' });
ok('400 条名称批量耗时 < 800ms', (Date.now() - t0) < 800);

console.log('== 8. 统计 ==');
var st = DB.stats();
ck('总条数', st.total, 3);
ck('给排水条数', st.byProf.plumbing.total, 3);
ck('管道类条数', st.byProf.plumbing.cats['管道类'], 3);
ck('空品类为0', st.byProf.plumbing.cats['洁具类'], 0);

console.log('== 9. 备份与恢复 ==');
var json = DB.exportJSON();
ok('导出含 items', json.indexOf('"items"') > 0);
DB.clearAll();
ck('清空后为0', DB.stats().total, 0);
var ri = DB.importJSON(json, 'replace');
ck('恢复条数', ri.added, 3);
ck('恢复后总数', DB.stats().total, 3);
var bad = null;
try { DB.importJSON('{"a":1}'); } catch (e) { bad = e.message; }
ok('非法备份报错', bad && bad.indexOf('items') > 0);

console.log('== 10. 删除 ==');
var all = DB.search('');
var del = DB.removeByIds([all[0].id]);
ck('删除一条', del, 1);
ck('删除后总数', DB.stats().total, 2);

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
