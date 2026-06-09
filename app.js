// 测试账号配置
const users = [
    { username: 'admin', password: '123456', displayName: '管理员' },
    { username: 'user01', password: '123456', displayName: '张三' },
    { username: 'user02', password: '123456', displayName: '李四' }
];

// 外部链接配置
const externalLinks = {
    '配电箱柜': 'https://liguanya.github.io/peidianxiang-list-quota/',
    '暖通设备': 'https://liguanya.github.io/ventilation-equipment-list-price/',
    '风口风阀': 'https://liguanya.github.io/fengkou-fengfa/'
};

// DOM 元素
const loginPage = document.getElementById('loginPage');
const mainPage = document.getElementById('mainPage');
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('errorMessage');
const currentUserSpan = document.getElementById('currentUser');
const navList = document.getElementById('navList');
const comingSoonModal = document.getElementById('comingSoonModal');
const comingSoonText = document.getElementById('comingSoonText');

// 页面加载时检查登录状态
document.addEventListener('DOMContentLoaded', function() {
    checkLoginStatus();
    initNavigation();
});

// 检查登录状态
function checkLoginStatus() {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const userData = localStorage.getItem('userData');
    
    if (isLoggedIn === 'true' && userData) {
        const user = JSON.parse(userData);
        showMainPage(user);
    } else {
        showLoginPage();
    }
}

// 显示登录页面
function showLoginPage() {
    loginPage.style.display = 'flex';
    mainPage.style.display = 'none';
}

// 显示主页面
function showMainPage(user) {
    loginPage.style.display = 'none';
    mainPage.style.display = 'flex';
    currentUserSpan.textContent = user.displayName;
    
    // 设置默认显示给排水工程
    switchSection('water');
}

// 登录表单提交
loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    // 验证账号
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        // 登录成功
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userData', JSON.stringify(user));
        errorMessage.classList.remove('show');
        errorMessage.textContent = '';
        showMainPage(user);
    } else {
        // 登录失败
        errorMessage.textContent = '用户名或密码错误，请重试';
        errorMessage.classList.add('show');
        passwordInput.value = '';
        passwordInput.focus();
    }
});

// 退出登录
function logout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userData');
    usernameInput.value = '';
    passwordInput.value = '';
    showLoginPage();
}

// 初始化导航
function initNavigation() {
    const navItems = navList.querySelectorAll('li');
    
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const section = this.dataset.section;
            switchSection(section);
            
            // 更新导航高亮
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

// 切换板块
function switchSection(section) {
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(sec => {
        sec.classList.remove('active');
    });
    
    const targetSection = document.getElementById(`section-${section}`);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // 更新导航高亮
    const navItems = navList.querySelectorAll('li');
    navItems.forEach(item => {
        if (item.dataset.section === section) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// 显示建设中提示
function showComingSoon(moduleName) {
    comingSoonText.textContent = `"${moduleName}"模块正在搭建中，敬请期待`;
    comingSoonModal.classList.add('show');
}

// 关闭模态框
function closeModal() {
    comingSoonModal.classList.remove('show');
}

// 点击模态框外部关闭
comingSoonModal.addEventListener('click', function(e) {
    if (e.target === comingSoonModal) {
        closeModal();
    }
});

// 跳转到外部链接
function goToExternal(moduleName) {
    const url = externalLinks[moduleName];
    if (url) {
        window.open(url, '_blank');
    }
}

// ESC键关闭模态框
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && comingSoonModal.classList.contains('show')) {
        closeModal();
    }
});
