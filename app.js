/* ============================================================
 * 机电专业智能计量计价平台 v2.0
 * 登录校验 + 两大板块（预算 / 估概算）× 五大专业入口
 * ============================================================ */
(function () {
    'use strict';

    /* ---------- 账号（前端校验，仅作访问门槛） ---------- */
    // 密码经 djb2 散列后比对，源码中不出现明文
    var ACCOUNTS = [
        { user: 'admin', hash: 'ywrfq2', name: '管理员' }
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
        '#7b5ea7': { dark: '#5d4580', soft: '#f2eefa', line: '#e0d6f0', glow: 'rgba(123,94,167,.32)' }
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
                desc: '综合布线、安防监控、楼宇自控、会议广播等子系统清单定额自动匹配，正在搭建中。',
                chips: ['综合布线', '安防 · 门禁', '楼宇自控'],
                status: 'building',
                url: ''
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
    function hashPwd(str) {
        var h = 5381;
        for (var i = 0; i < str.length; i++) {
            h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
        }
        return h.toString(36);
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
            stat.innerHTML = boardKey === 'budget'
                ? '<span class="stat-pill">已上线 <b>' + online + '</b> / 共 ' + list.length + '</span>'
                : '<span class="stat-pill">建设中 <b>' + (list.length - online) + '</b> / 共 ' + list.length + '</span>';
        }

        grid.querySelectorAll('.card').forEach(function (card) {
            card.addEventListener('click', function () {
                var url = card.getAttribute('data-url');
                var name = card.getAttribute('data-name');
                if (url) {
                    window.open(url, '_blank', 'noopener');
                } else {
                    toast('「' + name + '」正在搭建中，上线后会自动出现在这里');
                }
            });
        });
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
    if (loginForm) {
        loginForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var u = (usernameInput.value || '').trim();
            var p = (passwordInput.value || '').trim();
            var matched = null;
            for (var i = 0; i < ACCOUNTS.length; i++) {
                if (ACCOUNTS[i].user === u && ACCOUNTS[i].hash === hashPwd(p)) { matched = ACCOUNTS[i]; break; }
            }
            if (matched) {
                loginError.classList.remove('show');
                loginError.textContent = '';
                saveAuth(matched);
                showApp(matched);
            } else {
                loginError.textContent = u ? '用户名或密码错误，请重试' : '请输入用户名和密码';
                loginError.classList.add('show');
                var card = document.querySelector('.login-card');
                if (card) {
                    card.classList.remove('shake');
                    void card.offsetWidth;
                    card.classList.add('shake');
                }
                passwordInput.value = '';
                passwordInput.focus();
            }
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

    /* ---------- 启动 ---------- */
    var auth = readAuth();
    if (auth) {
        showApp(auth);
    } else {
        showLogin();
    }
})();
