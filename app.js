/* ============================================================
 * 机电专业智能计量计价平台 v2.0
 * 登录校验 + 三大板块（预算 / 估概算 / 招标文件编制）
 * ============================================================ */
(function () {
    'use strict';

    /* ---------- 账号 ----------
     * 密码以 SHA-256(盐 + ":" + 密码) 校验，源码中既无明文也无弱散列。
     * 新增一家公司：把「公司名 + 密码」发我，我生成 salt / hash 后在此加一行：
     *   { user: '公司账号', salt: 'jd-c-2026', hash: '<sha256(salt:密码)>', name: 'XX公司' }
     */
    var ACCOUNTS = [
        { user: 'admin', salt: 'jd-a-2026', hash: 'ccb6cd152b01a77f526cc601ac4fc43f0ab0fedea045d865d91c86380fb61d3a', name: '管理员' }
    ];

    var AUTH_KEY = 'jd_auth_v2';
    var BOARD_KEY = 'jd_board_v2';
    var SESSION_HOURS = 8;

    /* ---------- 专业配色（主色 → 深色/浅底/描边/光晕） ---------- */
    var PALETTE = {
        '#2b8a9d': { dark: '#1d6b7c', soft: '#eaf4f6', line: '#cfe6ea', glow: 'rgba(43,138,157,.32)' },
        '#3a7bd5': { dark: '#2a5ea8', soft: '#eaf1fc', line: '#d3e2f8', glow: 'rgba(58,123,213,.32)' },
        '#d98b1f': { dark: '#a9690f', soft: '#fdf3e3', line: '#f4e3c4', glow: 'rgba(217,139,31,.32)' },
        '#c0392b': { dark: '#92291e', soft: '#fbeceb', line: '#f3d3cf', glow: 'rgba(192,57,43,.32)' },
        '#7b5ea7': { dark: '#5d4580', soft: '#f2eefa', line: '#e0d6f0', glow: 'rgba(123,94,167,.32)' },
        '#0d9488': { dark: '#0f766e', soft: '#f0fdfa', line: '#ccfbf1', glow: 'rgba(13,148,136,.32)' }
    };

    /* ---------- 平台数据 ---------- */
    var PLATFORMS = {
        budget: [
            {
                name: '给排水智能组价平台',
                icon: '🚿',
                color: '#2b8a9d',
                desc: '八类管材按室内外、介质、连接方式、管径自动匹配清单与定额，阀门、支架、保温、消毒冲洗一并计取。',
                chips: ['031001001~008', '阀门 031002', '支架保温'],
                status: 'online',
                url: 'https://liguanya.github.io/plumbing-list-quota/'
            },
            {
                name: '暖通智能组价平台',
                icon: '❄️',
                color: '#3a7bd5',
                desc: '风管与运输、制冷设备、水管道、阀门、支架保温全覆盖，风管按材质与板厚自动套子目。',
                chips: ['风管 + 运输', '制冷设备', '水管道 · 阀门'],
                status: 'online',
                url: 'https://liguanya.github.io/hvac-list-quota/'
            },
            {
                name: '电气智能组价平台',
                icon: '⚡',
                color: '#d98b1f',
                desc: '全品类自动套清单定额：配电箱柜、桥架、配管配线、电缆、灯具开关插座、防雷接地、应急照明。',
                chips: ['全品类自动', '配电箱 · 配管配线', '灯具分档'],
                status: 'online',
                url: 'https://liguanya.github.io/electric-list-quota/'
            },
            {
                name: '消防智能组价平台',
                icon: '🚒',
                color: '#c0392b',
                desc: '消防电 18 类 + 消防水 9 类全自动，DN50 以上默认沟槽、以下螺纹，三项水灭火系统调试自动补项。',
                chips: ['消防电 18 类', '消防水 9 类', '调试 7-215~217'],
                status: 'online',
                url: 'https://liguanya.github.io/fire-list-quota/'
            },
            {
                name: '智能化智能组价平台',
                icon: '🛰️',
                color: '#7b5ea7',
                desc: '交换机、配线架、插座、摄像机、门禁、广播、楼控等 57 类设备自动套清单定额，桥架、配管、配线、光缆按规格档位联动取价。',
                chips: ['设备 57 类', '桥架 · 配管配线', '规格档位联动'],
                status: 'online',
                url: 'https://liguanya.github.io/intelligent-list-quota/'
            }
        ],
        estimate: [
            {
                name: '给排水估算概算平台',
                icon: '🚿',
                color: '#2b8a9d',
                desc: '按建筑面积指标或扩大单价法快速生成给排水专业估算、概算书，价格口径与预算板块同源。',
                chips: ['指标法', '扩大单价法', '估算 · 概算'],
                status: 'building',
                url: ''
            },
            {
                name: '暖通估算概算平台',
                icon: '❄️',
                color: '#3a7bd5',
                desc: '按冷热负荷指标、风量指标生成暖通专业估算概算，支持按系统与设备类型分列。',
                chips: ['负荷指标', '风量指标', '估算 · 概算'],
                status: 'building',
                url: ''
            },
            {
                name: '电气估算概算平台',
                icon: '⚡',
                color: '#d98b1f',
                desc: '按装机容量、建筑面积指标生成电气专业估算概算，涵盖变配电、动力照明、防雷接地。',
                chips: ['容量指标', '面积指标', '估算 · 概算'],
                status: 'building',
                url: ''
            },
            {
                name: '消防估算概算平台',
                icon: '🚒',
                color: '#c0392b',
                desc: '按建筑面积与消防系统类型生成消防专业估算概算，火灾报警与灭火系统分列计取。',
                chips: ['报警系统', '灭火系统', '估算 · 概算'],
                status: 'building',
                url: ''
            },
            {
                name: '智能化估算概算平台',
                icon: '🛰️',
                color: '#7b5ea7',
                desc: '按点位规模与子系统配置生成智能化专业估算概算，支持按系统分项与单方指标。',
                chips: ['点位规模', '子系统配置', '估算 · 概算'],
                status: 'building',
                url: ''
            }
        ],
        doc: [
            {
                name: '招标文件智能编制系统',
                icon: '📄',
                color: '#0d9488',
                desc: '以固定招标文件模板为底稿，五步录入项目信息、资格评分、规划指标与产品档位，自动生成完整 docx，格式与表格结构原样保留。',
                chips: ['前附表七组可切换', 'T/S/W/J 档位联动', '离线单文件'],
                status: 'online',
                url: 'https://liguanya.github.io/bidding-doc-system/'
            }
        ]
    };

    /* ---------- DOM ---------- */
    var loginPage = document.getElementById('loginPage');
    var mainPage = document.getElementById('mainPage');
    var loginForm = document.getElementById('loginForm');
    var usernameInput = document.getElementById('username');
    var passwordInput = document.getElementById('password');
    var loginError = document.getElementById('loginError');
    var currentUser = document.getElementById('currentUser');
    var logoutBtn = document.getElementById('logoutBtn');
    var tabs = document.getElementById('tabs');
    var toastEl = document.getElementById('toast');

    /* ---------- 工具 ---------- */
    function hexOf(buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) {
            return ('0' + b.toString(16)).slice(-2);
        }).join('');
    }
    // SHA-256(salt + ':' + pwd)；浏览器不支持时返回 null
    function hashPwd(pwd, salt) {
        if (!(window.crypto && window.crypto.subtle && window.crypto.subtle.digest && window.TextEncoder)) {
            return Promise.resolve(null);
        }
        try {
            var data = new TextEncoder().encode(salt + ':' + pwd);
            return window.crypto.subtle.digest('SHA-256', data).then(hexOf).catch(function () { return null; });
        } catch (e) {
            return Promise.resolve(null);
        }
    }

    var toastTimer = null;
    function toast(msg) {
        if (!toastEl) return;
        toastEl.textContent = msg;
        toastEl.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
    }

    /* ---------- 渲染 ---------- */
    function renderBoard(boardKey) {
        var grid = document.getElementById('grid-' + boardKey);
        var stat = document.getElementById('stat-' + boardKey);
        if (!grid) return;
        var list = PLATFORMS[boardKey] || [];
        var online = 0;

        grid.innerHTML = list.map(function (p) {
            var isOnline = p.status === 'online';
            if (isOnline) online++;
            var chips = (p.chips || []).map(function (c) { return '<li>' + c + '</li>'; }).join('');
            var pal = PALETTE[p.color] || {};
            var styleVars = '--prof:' + p.color +
                ';--prof-dark:' + (pal.dark || p.color) +
                ';--prof-soft:' + (pal.soft || '#eef6f7') +
                ';--prof-line:' + (pal.line || '#d6e6e8') +
                ';--prof-glow:' + (pal.glow || 'rgba(26,94,99,.3)');
            return '' +
                '<article class="card ' + (isOnline ? 'online' : 'building') + '" style="' + styleVars + '" data-url="' + (p.url || '') + '" data-name="' + p.name + '">' +
                    '<div class="card-top">' +
                        '<div class="card-icon">' + p.icon + '</div>' +
                        '<span class="badge ' + (isOnline ? 'badge-online' : 'badge-building') + '">' + (isOnline ? '已上线' : '建设中') + '</span>' +
                    '</div>' +
                    '<h3>' + p.name + '</h3>' +
                    '<p class="desc">' + p.desc + '</p>' +
                    '<ul class="chips">' + chips + '</ul>' +
                    (isOnline
                        ? '<button class="card-btn" type="button">进入平台 →</button>'
                        : '<button class="card-btn ghost" type="button" disabled>建设中，敬请期待</button>') +
                '</article>';
        }).join('');

        if (stat) {
            stat.innerHTML = boardKey === 'estimate'
                ? '<span class="stat-pill">建设中 <b>' + (list.length - online) + '</b> / 共 ' + list.length + '</span>'
                : '<span class="stat-pill">已上线 <b>' + online + '</b> / 共 ' + list.length + '</span>';
        }

        grid.querySelectorAll('.card').forEach(function (card) {
            card.addEventListener('click', function () {
                var url = card.getAttribute('data-url');
                var name = card.getAttribute('data-name');
                if (url) {
                    openFrame(url, name);
                } else {
                    toast('「' + name + '」正在搭建中，上线后会自动出现在这里');
                }
            });
        });
    }

    /* ---------- 平台内嵌打开 ---------- */
    function openFrame(url, name) {
        var layer = document.getElementById('frameLayer');
        var body = document.getElementById('frameBody');
        var nm = document.getElementById('frameName');
        var op = document.getElementById('frameOpen');
        if (!layer || !body) { window.open(url, '_blank', 'noopener'); return; }
        nm.textContent = name || '专业组价系统';
        op.href = url;
        body.src = url;
        layer.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
    function closeFrame() {
        var layer = document.getElementById('frameLayer');
        var body = document.getElementById('frameBody');
        if (layer) layer.classList.remove('show');
        if (body) body.src = 'about:blank';
        document.body.style.overflow = '';
    }

    /* ---------- 板块切换 ---------- */
    function switchBoard(boardKey, remember) {
        document.querySelectorAll('.board').forEach(function (b) {
            b.classList.toggle('active', b.id === 'board-' + boardKey);
        });
        document.querySelectorAll('.tab').forEach(function (t) {
            t.classList.toggle('active', t.getAttribute('data-board') === boardKey);
        });
        if (remember !== false) {
            try { localStorage.setItem(BOARD_KEY, boardKey); } catch (e) {}
        }
    }

    /* ---------- 登录态 ---------- */
    function saveAuth(user) {
        try {
            localStorage.setItem(AUTH_KEY, JSON.stringify({
                user: user.user,
                name: user.name,
                at: Date.now()
            }));
        } catch (e) {}
    }

    function readAuth() {
        try {
            var raw = localStorage.getItem(AUTH_KEY);
            if (!raw) return null;
            var d = JSON.parse(raw);
            if (!d || !d.user) return null;
            if (Date.now() - (d.at || 0) > SESSION_HOURS * 3600 * 1000) {
                localStorage.removeItem(AUTH_KEY);
                return null;
            }
            return d;
        } catch (e) {
            return null;
        }
    }

    function showApp(auth) {
        loginPage.classList.add('hide');
        mainPage.hidden = false;
        if (currentUser) currentUser.textContent = auth.name || auth.user;
        renderBoard('budget');
        renderBoard('estimate');
        renderBoard('doc');
        var last = 'budget';
        try { last = localStorage.getItem(BOARD_KEY) || 'budget'; } catch (e) {}
        switchBoard(PLATFORMS[last] ? last : 'budget', false);
    }

    function showLogin() {
        mainPage.hidden = true;
        loginPage.classList.remove('hide');
        if (passwordInput) passwordInput.value = '';
        if (usernameInput) {
            usernameInput.value = '';
            setTimeout(function () { usernameInput.focus(); }, 60);
        }
    }

    /* ---------- 事件 ---------- */
    function loginFail(msg) {
        loginError.textContent = msg;
        loginError.classList.add('show');
        var card = document.querySelector('.login-card');
        if (card) {
            card.classList.remove('shake');
            void card.offsetWidth;
            card.classList.add('shake');
        }
        if (passwordInput) {
            passwordInput.value = '';
            passwordInput.focus();
        }
    }

    if (loginForm) {
        var submitting = false;
        loginForm.addEventListener('submit', function (e) {
            e.preventDefault();
            if (submitting) return;
            var u = (usernameInput.value || '').trim();
            var p = (passwordInput.value || '').trim();
            if (!u || !p) { loginFail('请输入用户名和密码'); return; }

            var cand = ACCOUNTS.filter(function (a) { return a.user === u; });
            if (!cand.length) { loginFail('用户名或密码错误，请重试'); return; }

            submitting = true;
            hashPwd(p, cand[0].salt).then(function (hv) {
                submitting = false;
                if (hv === null) { loginFail('当前环境不支持安全校验，请通过 https 访问本站'); return; }
                var matched = null;
                for (var i = 0; i < cand.length; i++) {
                    if (cand[i].hash === hv) { matched = cand[i]; break; }
                }
                if (matched) {
                    loginError.classList.remove('show');
                    loginError.textContent = '';
                    saveAuth(matched);
                    showApp(matched);
                } else {
                    loginFail('用户名或密码错误，请重试');
                }
            });
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
            try { localStorage.removeItem(AUTH_KEY); } catch (e) {}
            showLogin();
            toast('已退出登录');
        });
    }

    if (tabs) {
        tabs.addEventListener('click', function (e) {
            var btn = e.target.closest('.tab');
            if (!btn) return;
            switchBoard(btn.getAttribute('data-board'));
        });
    }

    /* ---------- 内嵌页返回 ---------- */
    var _frameBack = document.getElementById('frameBack');
    if (_frameBack) _frameBack.addEventListener('click', closeFrame);
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeFrame();
    });

    /* ---------- 启动 ---------- */
    var auth = readAuth();
    if (auth) {
        showApp(auth);
    } else {
        showLogin();
    }
})();
