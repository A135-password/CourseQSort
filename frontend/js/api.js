/**
 * ========================================
 * CourseQSort API Client
 * 排课规划器 — 前端 API 对接层
 * 后端: Django REST Framework + SimpleJWT
 * Base URL: /api/v1/
 * ========================================
 *
 * 双模式设计:
 *   MOCK 模式 (默认) — 使用内置模拟数据，前端可独立预览
 *   API 模式 — 对接真实 Django 后端，需后端服务运行
 *
 * 切换方式: SetMockMode(false) 或在控制台执行
 *   CourseQSortAPI.setMockMode(false)
 */

var CourseQSortAPI = (function () {
    'use strict';

    // ======================== 配置 ========================

    var CONFIG = {
        BASE_URL: 'http://localhost:8000/api/v1',
        USE_MOCK: true,
        LOGIN_MODE: 'mock',
    };

    function setMockMode(val) {
        CONFIG.USE_MOCK = val;
        console.log('[API] Mock mode:', val);
    }

    function setBaseUrl(url) { CONFIG.BASE_URL = url; }
    function isMockMode() { return CONFIG.USE_MOCK; }
    function getBaseUrl() { return CONFIG.BASE_URL; }

    // ======================== Token 管理 ========================

    var TOKEN_KEYS = {
        ACCESS: 'cqs_access_token',
        REFRESH: 'cqs_refresh_token',
    };

    // 页面加载时从 localStorage 恢复 JWT 模式（防止页面跳转后 CONFIG 复位导致误判未登录）
    if (localStorage.getItem(TOKEN_KEYS.ACCESS)) {
        CONFIG.LOGIN_MODE = 'jwt';
        CONFIG.USE_MOCK = false;
    }
    console.log('[INIT] USE_MOCK=' + CONFIG.USE_MOCK + ' LOGIN_MODE=' + CONFIG.LOGIN_MODE + ' token=' + !!localStorage.getItem(TOKEN_KEYS.ACCESS));

    function getAccessToken() { return localStorage.getItem(TOKEN_KEYS.ACCESS); }
    function getRefreshToken() { return localStorage.getItem(TOKEN_KEYS.REFRESH); }

    function setTokens(access, refresh) {
        if (access) localStorage.setItem(TOKEN_KEYS.ACCESS, access);
        if (refresh) localStorage.setItem(TOKEN_KEYS.REFRESH, refresh);
        CONFIG.LOGIN_MODE = 'jwt';
    }

    function clearTokens() {
        localStorage.removeItem(TOKEN_KEYS.ACCESS);
        localStorage.removeItem(TOKEN_KEYS.REFRESH);
    }

    function isAuthenticated() {
        // JWT token 存在 → 已通过后端验证
        if (getAccessToken()) return true;
        // 预览模式兼容：检查 sessionStorage 中的用户信息
        if (sessionStorage.getItem('studentName')) return true;
        if (sessionStorage.getItem('teacherName')) return true;
        if (sessionStorage.getItem('adminName')) return true;
        return false;
    }

    function getLoginMode() { return CONFIG.LOGIN_MODE; }
    function setLoginMode(mode) { CONFIG.LOGIN_MODE = mode; }

    // ======================== 核心 HTTP 请求 ========================

    async function apiCall(method, path, body, opts) {
        opts = opts || {};

        if (CONFIG.USE_MOCK) {
            console.log('[API] mock mode, path=' + path + ' body=', body);
            return mockResponse(method, path, body);
        }

        var url = CONFIG.BASE_URL + path;
        console.log('[API] fetch ' + method + ' ' + url);
        var headers = { 'Content-Type': 'application/json' };

        var token = getAccessToken();
        if (token) headers['Authorization'] = 'Bearer ' + token;

        var fetchOpts = {
            method: method,
            headers: headers,
        };
        if (body && method !== 'GET') {
            fetchOpts.body = JSON.stringify(body);
        }

        try {
            var resp = await fetch(url, fetchOpts);
            console.log('[API] response status=' + resp.status + ' ok=' + resp.ok);

            if (resp.status === 401 && getRefreshToken()) {
                var refreshed = await refreshAccessToken();
                if (refreshed) {
                    headers['Authorization'] = 'Bearer ' + getAccessToken();
                    resp = await fetch(url, fetchOpts);
                } else {
                    clearTokens();
                    CONFIG.LOGIN_MODE = 'mock';
                    window.location.href = 'login.html';
                    throw new Error('Session expired');
                }
            }

            if (!resp.ok && !opts.noThrow) {
                var errData = null;
                try { errData = await resp.json(); } catch (e) { }
                var err = new Error('API Error: ' + resp.status);
                err.status = resp.status;
                err.data = errData;
                throw err;
            }

            if (resp.status === 204) return null;
            return await resp.json();

        } catch (err) {
            console.error('[API] catch error: name=' + err.name + ' message=' + err.message + ' status=' + err.status);
            if (err.name === 'TypeError' && err.message.includes('fetch')) {
                // 只有 mock 模式才静默回退，后端模式抛出错误让调用方处理
                if (CONFIG.USE_MOCK) {
                    console.warn('[API] Backend unreachable, falling back to mock');
                    return mockResponse(method, path, body);
                }
                console.error('[API] Backend unreachable in JWT mode');
            }
            throw err;
        }
    }

    async function refreshAccessToken() {
        var refreshToken = getRefreshToken();
        if (!refreshToken) return false;
        try {
            var resp = await fetch(CONFIG.BASE_URL + '/auth/refresh/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh: refreshToken })
            });
            if (resp.ok) {
                var data = await resp.json();
                setTokens(data.access, refreshToken);
                return true;
            }
        } catch (e) { }
        return false;
    }

    // ======================== Mock 响应引擎 ========================

    var mockCallbacks = {};

    function registerMock(method, path, handler) {
        var key = method + ':' + path;
        mockCallbacks[key] = handler;
    }

    function registerMockPattern(method, pattern, handler) {
        var key = method + ':pattern:' + pattern;
        mockCallbacks[key] = handler;
    }

    function parseQueryString(str) {
        var params = {};
        if (!str) return params;
        str.split('&').forEach(function (pair) {
            var parts = pair.split('=');
            if (parts[0]) params[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1] || '');
        });
        return params;
    }

    function mockResponse(method, path, body) {
        var pathOnly = path.split('?')[0];
        var queryParams = parseQueryString(path.split('?')[1] || '');
        // GET/DELETE 传 queryParams，POST/PUT/PATCH 传 body
        var handlerArg = (method === 'GET' || method === 'DELETE') ? queryParams : body;

        var key = method + ':' + pathOnly;
        if (mockCallbacks[key]) {
            return Promise.resolve(mockCallbacks[key](handlerArg));
        }

        for (var mk in mockCallbacks) {
            if (mk.indexOf(':pattern:') === -1) continue;
            var pattern = mk.split(':pattern:')[1];
            if (matchPath(pathOnly, pattern)) {
                var matchedId = extractId(pathOnly, pattern);
                return Promise.resolve(mockCallbacks[mk](handlerArg, matchedId));
            }
        }

        console.warn('[API] No mock handler for:', method, pathOnly);
        return Promise.resolve(null);
    }

    var PLACEHOLDER_RE = /^\{.+}$/;

    function matchPath(path, pattern) {
        var parts = path.split('/').filter(Boolean);
        var patParts = pattern.split('/').filter(Boolean);
        if (parts.length !== patParts.length) return false;
        for (var i = 0; i < parts.length; i++) {
            if (PLACEHOLDER_RE.test(patParts[i])) continue;
            if (parts[i] !== patParts[i]) return false;
        }
        return true;
    }

    function extractId(path, pattern) {
        var parts = path.split('/').filter(Boolean);
        var patParts = pattern.split('/').filter(Boolean);
        var result = {};
        for (var i = 0; i < parts.length; i++) {
            if (PLACEHOLDER_RE.test(patParts[i])) {
                var name = patParts[i].slice(1, -1);
                result[name] = parts[i];
            }
        }
        return result;
    }

    // ======================== Mock 数据 ========================

    var MOCK_COURSES = [
        { course_id: 1, name: "高等数学AAAA", credit: 5, teacher: "张教授", capacity: 180, enrolled_count: 150, time_slots: [{ day_of_week: 1, period: 1 }, { day_of_week: 1, period: 2 }, { day_of_week: 3, period: 1 }, { day_of_week: 3, period: 2 }], is_professional: true, category: "专必" },
        { course_id: 2, name: "大学英语Ⅱ", credit: 4, teacher: "李老师", capacity: 160, enrolled_count: 140, time_slots: [{ day_of_week: 2, period: 3 }, { day_of_week: 2, period: 4 }, { day_of_week: 4, period: 3 }, { day_of_week: 4, period: 4 }], is_professional: true, category: "专必" },
        { course_id: 3, name: "线性代数", credit: 3, teacher: "王教授", capacity: 150, enrolled_count: 130, time_slots: [{ day_of_week: 3, period: 5 }, { day_of_week: 3, period: 6 }, { day_of_week: 5, period: 5 }], is_professional: true, category: "专必" },
        { course_id: 4, name: "马克思主义原理", credit: 2, teacher: "陈老师", capacity: 200, enrolled_count: 120, time_slots: [{ day_of_week: 1, period: 7 }, { day_of_week: 1, period: 8 }], is_professional: true, category: "专必" },
        { course_id: 5, name: "体育(二)", credit: 1, teacher: "刘教练", capacity: 60, enrolled_count: 40, time_slots: [{ day_of_week: 5, period: 9 }, { day_of_week: 5, period: 10 }], is_professional: false, category: "通识" },
        { course_id: 6, name: "数据结构", credit: 4, teacher: "赵教授", capacity: 100, enrolled_count: 80, time_slots: [{ day_of_week: 1, period: 3 }, { day_of_week: 1, period: 4 }, { day_of_week: 3, period: 3 }, { day_of_week: 3, period: 4 }], is_professional: true, category: "专必" },
        { course_id: 7, name: "计算机组成原理", credit: 4, teacher: "孙老师", capacity: 120, enrolled_count: 90, time_slots: [{ day_of_week: 2, period: 1 }, { day_of_week: 2, period: 2 }, { day_of_week: 4, period: 1 }, { day_of_week: 4, period: 2 }], is_professional: true, category: "专必" },
        { course_id: 8, name: "操作系统", credit: 4, teacher: "周教授", capacity: 100, enrolled_count: 70, time_slots: [{ day_of_week: 1, period: 5 }, { day_of_week: 1, period: 6 }, { day_of_week: 3, period: 7 }, { day_of_week: 3, period: 8 }], is_professional: true, category: "专必" },
        { course_id: 9, name: "数据库原理", credit: 3, teacher: "吴老师", capacity: 110, enrolled_count: 85, time_slots: [{ day_of_week: 2, period: 5 }, { day_of_week: 2, period: 6 }, { day_of_week: 4, period: 5 }], is_professional: true, category: "专必" },
        { course_id: 10, name: "概率论与数理统计", credit: 3, teacher: "郑教授", capacity: 130, enrolled_count: 110, time_slots: [{ day_of_week: 3, period: 9 }, { day_of_week: 3, period: 10 }, { day_of_week: 5, period: 1 }, { day_of_week: 5, period: 2 }], is_professional: true, category: "专必" },
        { course_id: 11, name: "Python程序设计", credit: 3, teacher: "王老师", capacity: 90, enrolled_count: 60, time_slots: [{ day_of_week: 2, period: 7 }, { day_of_week: 2, period: 8 }, { day_of_week: 4, period: 7 }], is_professional: false, category: "专选" },
        { course_id: 12, name: "Java语言", credit: 3, teacher: "李老师", capacity: 80, enrolled_count: 70, time_slots: [{ day_of_week: 1, period: 9 }, { day_of_week: 1, period: 10 }, { day_of_week: 3, period: 9 }], is_professional: false, category: "专选" },
        { course_id: 13, name: "人工智能导论", credit: 2, teacher: "刘教授", capacity: 120, enrolled_count: 40, time_slots: [{ day_of_week: 5, period: 6 }, { day_of_week: 5, period: 7 }], is_professional: false, category: "专选" },
        { course_id: 14, name: "机器学习", credit: 3, teacher: "陈老师", capacity: 100, enrolled_count: 50, time_slots: [{ day_of_week: 2, period: 9 }, { day_of_week: 2, period: 10 }, { day_of_week: 4, period: 8 }], is_professional: false, category: "专选" },
        { course_id: 15, name: "数字逻辑", credit: 3, teacher: "张老师", capacity: 90, enrolled_count: 75, time_slots: [{ day_of_week: 1, period: 3 }, { day_of_week: 1, period: 4 }, { day_of_week: 3, period: 3 }], is_professional: true, category: "专必" },
        { course_id: 16, name: "离散数学", credit: 3, teacher: "赵老师", capacity: 110, enrolled_count: 95, time_slots: [{ day_of_week: 2, period: 3 }, { day_of_week: 2, period: 4 }, { day_of_week: 4, period: 3 }], is_professional: true, category: "专必" },
        { course_id: 17, name: "计算机网络", credit: 3, teacher: "孙教授", capacity: 100, enrolled_count: 80, time_slots: [{ day_of_week: 3, period: 1 }, { day_of_week: 3, period: 2 }, { day_of_week: 5, period: 3 }], is_professional: true, category: "专必" },
        { course_id: 18, name: "软件工程", credit: 2, teacher: "周老师", capacity: 100, enrolled_count: 90, time_slots: [{ day_of_week: 4, period: 9 }, { day_of_week: 4, period: 10 }], is_professional: false, category: "专选" },
        { course_id: 19, name: "编译原理", credit: 3, teacher: "吴教授", capacity: 80, enrolled_count: 55, time_slots: [{ day_of_week: 5, period: 1 }, { day_of_week: 5, period: 2 }, { day_of_week: 5, period: 3 }], is_professional: true, category: "专必" },
        { course_id: 20, name: "网络安全", credit: 2, teacher: "郑老师", capacity: 80, enrolled_count: 30, time_slots: [{ day_of_week: 1, period: 8 }, { day_of_week: 1, period: 9 }], is_professional: false, category: "专选" },
        { course_id: 21, name: "数字图像处理", credit: 2, teacher: "王老师", capacity: 70, enrolled_count: 50, time_slots: [{ day_of_week: 2, period: 1 }, { day_of_week: 2, period: 2 }], is_professional: false, category: "专选" },
        { course_id: 22, name: "嵌入式系统", credit: 2, teacher: "李老师", capacity: 60, enrolled_count: 45, time_slots: [{ day_of_week: 3, period: 5 }, { day_of_week: 3, period: 6 }], is_professional: false, category: "专选" },
        { course_id: 23, name: "云计算概论", credit: 2, teacher: "刘老师", capacity: 100, enrolled_count: 20, time_slots: [{ day_of_week: 4, period: 5 }, { day_of_week: 4, period: 6 }], is_professional: false, category: "专选" },
        { course_id: 24, name: "大数据技术", credit: 3, teacher: "陈教授", capacity: 90, enrolled_count: 60, time_slots: [{ day_of_week: 5, period: 7 }, { day_of_week: 5, period: 8 }, { day_of_week: 5, period: 9 }], is_professional: false, category: "专选" },
        { course_id: 25, name: "算法设计与分析", credit: 3, teacher: "张教授", capacity: 80, enrolled_count: 65, time_slots: [{ day_of_week: 1, period: 5 }, { day_of_week: 1, period: 6 }, { day_of_week: 3, period: 7 }], is_professional: true, category: "专必" },
        { course_id: 26, name: "移动应用开发", credit: 2, teacher: "孙老师", capacity: 70, enrolled_count: 30, time_slots: [{ day_of_week: 2, period: 7 }, { day_of_week: 2, period: 8 }], is_professional: false, category: "专选" },
        { course_id: 27, name: "游戏引擎原理", credit: 2, teacher: "周老师", capacity: 50, enrolled_count: 20, time_slots: [{ day_of_week: 4, period: 1 }, { day_of_week: 4, period: 2 }], is_professional: false, category: "专选" },
        { course_id: 28, name: "信息检索", credit: 2, teacher: "吴老师", capacity: 60, enrolled_count: 40, time_slots: [{ day_of_week: 3, period: 10 }, { day_of_week: 3, period: 11 }], is_professional: false, category: "专选" },
        { course_id: 29, name: "计算机图形学", credit: 3, teacher: "郑老师", capacity: 70, enrolled_count: 50, time_slots: [{ day_of_week: 1, period: 10 }, { day_of_week: 1, period: 11 }, { day_of_week: 3, period: 11 }], is_professional: false, category: "专选" },
        { course_id: 30, name: "模式识别", credit: 2, teacher: "王教授", capacity: 80, enrolled_count: 35, time_slots: [{ day_of_week: 2, period: 11 }, { day_of_week: 4, period: 11 }], is_professional: false, category: "专选" },
        { course_id: 31, name: "数据挖掘", credit: 2, teacher: "李教授", capacity: 90, enrolled_count: 40, time_slots: [{ day_of_week: 5, period: 1 }, { day_of_week: 5, period: 2 }], is_professional: false, category: "专选" },
        { course_id: 32, name: "自然语言处理", credit: 2, teacher: "刘老师", capacity: 80, enrolled_count: 50, time_slots: [{ day_of_week: 3, period: 1 }, { day_of_week: 3, period: 2 }], is_professional: false, category: "专选" },
        { course_id: 33, name: "计算机视觉", credit: 2, teacher: "陈老师", capacity: 70, enrolled_count: 30, time_slots: [{ day_of_week: 4, period: 7 }, { day_of_week: 4, period: 8 }], is_professional: false, category: "专选" },
        { course_id: 34, name: "物联网导论", credit: 2, teacher: "张老师", capacity: 60, enrolled_count: 45, time_slots: [{ day_of_week: 1, period: 1 }, { day_of_week: 1, period: 2 }], is_professional: false, category: "专选" },
        { course_id: 35, name: "区块链技术", credit: 2, teacher: "孙老师", capacity: 50, enrolled_count: 40, time_slots: [{ day_of_week: 2, period: 5 }, { day_of_week: 2, period: 6 }], is_professional: false, category: "专选" },
        { course_id: 36, name: "量化交易", credit: 2, teacher: "周老师", capacity: 40, enrolled_count: 30, time_slots: [{ day_of_week: 3, period: 5 }, { day_of_week: 3, period: 6 }], is_professional: false, category: "专选" },
        { course_id: 37, name: "经济学原理", credit: 3, teacher: "吴教授", capacity: 120, enrolled_count: 100, time_slots: [{ day_of_week: 5, period: 3 }, { day_of_week: 5, period: 4 }, { day_of_week: 5, period: 5 }], is_professional: false, category: "通识" },
        { course_id: 38, name: "管理学", credit: 2, teacher: "郑教授", capacity: 100, enrolled_count: 80, time_slots: [{ day_of_week: 4, period: 9 }, { day_of_week: 4, period: 10 }], is_professional: false, category: "通识" },
        { course_id: 39, name: "书法鉴赏", credit: 1, teacher: "刘老师", capacity: 40, enrolled_count: 30, time_slots: [{ day_of_week: 1, period: 11 }], is_professional: false, category: "通识" },
        { course_id: 40, name: "影视鉴赏", credit: 1, teacher: "陈老师", capacity: 50, enrolled_count: 40, time_slots: [{ day_of_week: 2, period: 11 }], is_professional: false, category: "通识" },
        { course_id: 41, name: "音乐基础", credit: 1, teacher: "李老师", capacity: 45, enrolled_count: 35, time_slots: [{ day_of_week: 3, period: 11 }], is_professional: false, category: "通识" },
        { course_id: 42, name: "摄影技术", credit: 1, teacher: "王老师", capacity: 35, enrolled_count: 20, time_slots: [{ day_of_week: 4, period: 11 }], is_professional: false, category: "通识" },
        { course_id: 43, name: "书法实践", credit: 1, teacher: "张老师", capacity: 30, enrolled_count: 25, time_slots: [{ day_of_week: 5, period: 11 }], is_professional: false, category: "通识" },
        { course_id: 44, name: "心理学导论", credit: 2, teacher: "孙老师", capacity: 80, enrolled_count: 70, time_slots: [{ day_of_week: 1, period: 7 }, { day_of_week: 1, period: 8 }], is_professional: false, category: "通识" },
        { course_id: 45, name: "社会学概论", credit: 2, teacher: "周老师", capacity: 70, enrolled_count: 60, time_slots: [{ day_of_week: 2, period: 1 }, { day_of_week: 2, period: 2 }], is_professional: false, category: "通识" },
        { course_id: 46, name: "哲学入门", credit: 1, teacher: "吴老师", capacity: 50, enrolled_count: 30, time_slots: [{ day_of_week: 3, period: 3 }], is_professional: false, category: "通识" },
        { course_id: 47, name: "演讲与口才", credit: 1, teacher: "郑老师", capacity: 40, enrolled_count: 35, time_slots: [{ day_of_week: 4, period: 1 }], is_professional: false, category: "通识" },
        { course_id: 48, name: "时间管理", credit: 1, teacher: "刘老师", capacity: 60, enrolled_count: 50, time_slots: [{ day_of_week: 5, period: 2 }], is_professional: false, category: "通识" },
        { course_id: 49, name: "创新创意基础", credit: 2, teacher: "陈教授", capacity: 90, enrolled_count: 80, time_slots: [{ day_of_week: 1, period: 5 }, { day_of_week: 1, period: 6 }], is_professional: false, category: "通识" },
        { course_id: 50, name: "职业规划", credit: 1, teacher: "张老师", capacity: 80, enrolled_count: 60, time_slots: [{ day_of_week: 2, period: 9 }], is_professional: false, category: "通识" }
    ];

    var MOCK_MANDATORY_IDS = [1, 2, 3, 4, 5];

    var mockSelected = MOCK_MANDATORY_IDS.map(function (id) {
        var c = getCourseById(id);
        return {
            course_id: c.course_id,
            name: c.name,
            credit: c.credit,
            teacher: c.teacher,
            time_slots: JSON.parse(JSON.stringify(c.time_slots)),
            mandatory: true
        };
    });

    function getCourseById(id) {
        for (var i = 0; i < MOCK_COURSES.length; i++) {
            if (MOCK_COURSES[i].course_id === id) return MOCK_COURSES[i];
        }
        return null;
    }

    function buildBitmap(slotsArray) {
        var arr = new Array(55).fill('0');
        for (var i = 0; i < slotsArray.length; i++) {
            var s = slotsArray[i];
            var idx = (s.day_of_week - 1) * 11 + (s.period - 1);
            if (idx >= 0 && idx < 55) arr[idx] = '1';
        }
        return arr.join('');
    }

    function hasBitmapConflict(bm1, bm2) {
        for (var i = 0; i < bm1.length; i++) {
            if (bm1[i] === '1' && bm2[i] === '1') return true;
        }
        return false;
    }

    // ======================== 注册 Mock 处理器 ========================

    registerMock('POST', '/auth/register/', function (body) {
        // Mock 注册：模拟后端验证逻辑
        var name = body.name || '';
        var identifier = body.identifier || '';
        var role = body.role || 'STUDENT';
        if (role === 'STUDENT') {
            // 检查 mock 学生数据中是否有匹配的姓名+学号
            // 简单模拟：直接通过
        } else if (role === 'TEACHER') {
            // 检查 mock 教师数据
            var found = MOCK_TEACHERS.some(function(t) {
                return t.name === name && t.employee_no === identifier;
            });
            if (!found) {
                var err = new Error('未找到匹配的教师记录');
                err.status = 400;
                err.data = { identifier: ['未找到姓名为「' + name + '」且工号为「' + identifier + '」的教师记录'] };
                throw err;
            }
        }
        return {
            access: 'mock_access_' + Date.now(),
            refresh: 'mock_refresh_' + Date.now(),
            user: { id: Date.now() % 10000, username: body.username, role: role, name: name },
            detail: '注册成功'
        };
    });

    registerMock('POST', '/auth/login/', function (body) {
        // Mock 登录：验证账号密码（预览模式下模拟真实行为）
        var username = (body.username || '').trim();
        var password = (body.password || '').trim();
        if (!username || !password) {
            var err = new Error('用户名和密码不能为空');
            err.status = 400;
            err.data = { detail: '用户名和密码不能为空' };
            throw err;
        }
        // 模拟有效的账号列表
        var VALID_USERS = {
            'admin':    { password: 'admin123', role: 'ADMIN',   name: '教务管理员' },
            'teacher1': { password: 'teacher123', role: 'TEACHER', name: '张教授' },
            'teacher2': { password: 'teacher123', role: 'TEACHER', name: '李老师' },
            'student':  { password: 'student123', role: 'STUDENT', name: '测试同学' },
        };
        var user = VALID_USERS[username];
        if (!user) {
            var err = new Error('账号不存在');
            err.status = 401;
            err.data = { detail: '账号不存在' };
            throw err;
        }
        if (user.password !== password) {
            var err = new Error('密码错误');
            err.status = 401;
            err.data = { detail: '密码错误' };
            throw err;
        }
        return {
            access: 'mock_access_token_' + Date.now(),
            refresh: 'mock_refresh_token_' + Date.now(),
            user: {
                id: 1,
                username: username,
                role: user.role,
                name: user.name,
                email: 'test@university.edu.cn',
                major: '计算机科学与技术'
            }
        };
    });

    registerMock('POST', '/auth/refresh/', function () {
        return { access: 'mock_refreshed_token_' + Date.now() };
    });

    registerMock('POST', '/auth/logout/', function () {
        return { detail: 'Successfully logged out' };
    });

    registerMock('GET', '/auth/me/', function () {
        return {
            id: 1, username: 'student', role: 'STUDENT',
            name: '测试同学', email: 'test@university.edu.cn',
            major: '计算机科学与技术'
        };
    });

    registerMock('GET', '/student/schedule/', function () {
        var bitmap = new Array(55).fill('0');
        mockSelected.forEach(function (sc) {
            var bm = buildBitmap(sc.time_slots).split('');
            for (var i = 0; i < 55; i++) {
                if (bm[i] === '1') bitmap[i] = '1';
            }
        });
        return {
            student_id: 2024001, semester: '2026-spring',
            bitmap: '0x' + bitmap.join(''),
            courses: mockSelected.map(function (sc) {
                return {
                    course_id: sc.course_id, name: sc.name,
                    teacher: sc.teacher, time_slots: sc.time_slots,
                    classroom: 'A101', mandatory: sc.mandatory || false
                };
            })
        };
    });
    registerMock('GET', '/student/courses/', function (queryParams) {
        return getMockCourseList(queryParams);
    });
    function getMockCourseList(params) {
        params = params || {};
        // 解析分页参数，并转为数字类型，设置默认值
        var page = parseInt(params.page, 10) || 1;
        var pageSize = parseInt(params.page_size, 10) || 15;  // 与前端 pageSize 一致

        // 构建完整课程列表（含冲突检测、剩余容量等）
        var results = MOCK_COURSES.map(function (c) {
            var isSelected = mockSelected.some(function (sc) { return sc.course_id === c.course_id; });
            var remaining = Math.max(0, c.capacity - c.enrolled_count);
            var conflict = false;
            var conflictWith = [];
            if (!isSelected) {
                var courseBm = buildBitmap(c.time_slots);
                for (var i = 0; i < mockSelected.length; i++) {
                    var scbm = buildBitmap(mockSelected[i].time_slots);
                    if (hasBitmapConflict(courseBm, scbm)) {
                        conflict = true;
                        conflictWith.push({
                            course_id: mockSelected[i].course_id,
                            name: mockSelected[i].name,
                            time_slots: mockSelected[i].time_slots
                        });
                    }
                }
            }
            return {
                course_id: c.course_id,
                name: c.name,
                credit: c.credit,
                teacher: c.teacher,
                capacity: c.capacity,
                enrolled_count: c.enrolled_count,
                remaining_capacity: remaining,
                time_slots: c.time_slots,
                conflict: conflict,
                conflict_with: conflictWith,
                category: c.category,
                is_professional: c.is_professional
            };
        });

        // 计算分页数据
        var total = results.length;
        var start = (page - 1) * pageSize;
        var paged = results.slice(start, start + pageSize);

        // 构造返回对象（与后端接口格式一致）
        return {
            count: total,
            next: (start + pageSize < total) ? '/student/courses/?page=' + (page + 1) : null,
            previous: (page > 1) ? '/student/courses/?page=' + (page - 1) : null,
            results: paged
        };
    }

    registerMockPattern('GET', '/student/courses/{id}/conflict-detail/', function (body, vars) {
        var courseId = parseInt(vars.id);
        var course = getCourseById(courseId);
        if (!course) return {};
        var conflictCourses = [];
        var courseBm = buildBitmap(course.time_slots);
        mockSelected.forEach(function (sc) {
            var scBm = buildBitmap(sc.time_slots);
            if (hasBitmapConflict(courseBm, scBm)) {
                conflictCourses.push({
                    course_id: sc.course_id, name: sc.name,
                    teacher: sc.teacher,
                    day_of_week: sc.time_slots[0].day_of_week,
                    period: sc.time_slots[0].period,
                    classroom: 'A101', conflict_type: 'TIME_OVERLAP'
                });
            }
        });
        return {
            course_id: course.course_id, course_name: course.name,
            course_time_slots: course.time_slots,
            conflict_courses: conflictCourses,
            bitmap: '0x' + buildBitmap(course.time_slots),
            conflict_bitmap: '0x' + new Array(55).fill('0').join('')
        };
    });

    registerMockPattern('POST', '/student/courses/{id}/select/', function (body, vars) {
        var courseId = parseInt(vars.id);
        var course = getCourseById(courseId);
        if (!course) {
            var err = new Error('Course not found');
            err.status = 404; throw err;
        }
        var courseBm = buildBitmap(course.time_slots);
        for (var i = 0; i < mockSelected.length; i++) {
            var scBm = buildBitmap(mockSelected[i].time_slots);
            if (hasBitmapConflict(courseBm, scBm)) {
                var err = new Error('时间冲突');
                err.status = 409;
                err.data = { status: 'CONFLICT', message: '课程时间与已选课程冲突', conflict_detail: {} };
                throw err;
            }
        }
        if (course.enrolled_count >= course.capacity) {
            var err = new Error('容量已满');
            err.status = 409;
            err.data = { status: 'FULL', message: '该课程容量已满' };
            throw err;
        }
        course.enrolled_count++;
        mockSelected.push({
            course_id: course.course_id, name: course.name,
            credit: course.credit, teacher: course.teacher,
            time_slots: JSON.parse(JSON.stringify(course.time_slots)),
            mandatory: false
        });
        return { course_id: courseId, status: 'SELECTED', message: '选课成功' };
    });

    registerMockPattern('DELETE', '/student/courses/{id}/drop/', function (body, vars) {
        var courseId = parseInt(vars.id);
        var idx = -1;
        for (var i = 0; i < mockSelected.length; i++) {
            if (mockSelected[i].course_id === courseId) {
                if (mockSelected[i].mandatory) {
                    var err = new Error('必修课不可退');
                    err.status = 400; throw err;
                }
                idx = i; break;
            }
        }
        if (idx === -1) {
            var err = new Error('未选该课');
            err.status = 404; throw err;
        }
        mockSelected.splice(idx, 1);
        var course = getCourseById(courseId);
        if (course && course.enrolled_count > 0) course.enrolled_count--;
        return { course_id: courseId, status: 'DROPPED', message: '退课成功' };
    });

    registerMock('GET', '/student/free-slots/', function () {
        var bitmap = new Array(55).fill('0');
        mockSelected.forEach(function (sc) {
            var bm = buildBitmap(sc.time_slots).split('');
            for (var i = 0; i < 55; i++) { if (bm[i] === '1') bitmap[i] = '1'; }
        });
        var freeSlots = [];
        for (var i = 0; i < 55; i++) {
            if (bitmap[i] === '0') {
                freeSlots.push({ day_of_week: Math.floor(i / 11) + 1, period: (i % 11) + 1 });
            }
        }
        return { free_slots: freeSlots };
    });

    registerMockPattern('GET', '/student/free-slots/{day}/{period}/recommend/', function (body, vars) {
        var day = parseInt(vars.day);
        var period = parseInt(vars.period);
        var filtered = MOCK_COURSES.filter(function (c) {
            return c.time_slots.some(function (ts) { return ts.day_of_week === day && ts.period === period; });
        }).map(function (c) {
            return {
                course_id: c.course_id, name: c.name, credit: c.credit,
                category: c.category, satisfy_training_plan: true,
                remaining_capacity: Math.max(0, c.capacity - c.enrolled_count),
                teacher: c.teacher, classroom: '未分配',
                time_slots: c.time_slots
            };
        });
        return { day_of_week: day, period: period, courses: filtered };
    });

    // ======================== Admin Mock 数据 ========================

    var MOCK_TEACHERS = [
        { id: 1, name: "张教授", employee_no: "T001", department: "计算机学院", unavailable_slots: [{ day_of_week: 1, period: 1 }, { day_of_week: 1, period: 2 }] },
        { id: 2, name: "李老师", employee_no: "T002", department: "计算机学院", unavailable_slots: [] },
        { id: 3, name: "王教授", employee_no: "T003", department: "计算机学院", unavailable_slots: [] },
        { id: 4, name: "赵教授", employee_no: "T004", department: "数学学院", unavailable_slots: [] },
        { id: 5, name: "陈老师", employee_no: "T005", department: "外国语学院", unavailable_slots: [] },
    ];

    var MOCK_CLASSROOMS = [
        { id: 1, name: "A101", capacity: 120, building: "教学楼A", equipment_types: ["多媒体", "黑板"], is_lab: false },
        { id: 2, name: "A102", capacity: 100, building: "教学楼A", equipment_types: ["多媒体"], is_lab: false },
        { id: 3, name: "B201", capacity: 80, building: "教学楼B", equipment_types: ["多媒体", "黑板"], is_lab: false },
        { id: 4, name: "C301", capacity: 60, building: "实验楼C", equipment_types: ["电脑", "投影"], is_lab: true },
        { id: 5, name: "D101", capacity: 200, building: "教学楼D", equipment_types: ["多媒体", "音响"], is_lab: false },
    ];

    var MOCK_MAJORS = [
        { id: 1, name: "计算机科学与技术", code: "CS", student_count: 120 },
        { id: 2, name: "软件工程", code: "SE", student_count: 80 },
        { id: 3, name: "人工智能", code: "AI", student_count: 60 },
        { id: 4, name: "数学与应用数学", code: "MA", student_count: 90 },
        { id: 5, name: "英语", code: "EN", student_count: 70 },
    ];

    var MOCK_STUDENTS = [
        { id: 1, student_no: "2024001", name: "张三", major: 1, major_name: "计算机科学与技术", grade: "2024", class_identification: "计科2401" },
        { id: 2, student_no: "2024002", name: "李四", major: 1, major_name: "计算机科学与技术", grade: "2024", class_identification: "计科2401" },
        { id: 3, student_no: "2024003", name: "王五", major: 2, major_name: "软件工程", grade: "2024", class_identification: "软工2401" },
        { id: 4, student_no: "2023001", name: "赵六", major: 1, major_name: "计算机科学与技术", grade: "2023", class_identification: "计科2302" },
        { id: 5, student_no: "2023002", name: "孙七", major: 3, major_name: "人工智能", grade: "2023", class_identification: "人工2301" },
    ];

    var MOCK_PROTECTED_SLOTS = [
        { id: 1, day_of_week: 2, start_period: 3, end_period: 4, penalty_weight: 8.0, description: "辅修热门时段-周二三四节" },
        { id: 2, day_of_week: 4, start_period: 5, end_period: 6, penalty_weight: 7.5, description: "辅修热门时段-周四五八节" },
    ];

    var MOCK_SCHEDULE_PLANS = [
        { id: 1, plan_name: "2026春-计算机学院-初版", semester: "2026-spring", status: "PUBLISHED", overall_fitness: 0.93, created_at: "2026-05-20T10:00:00Z", published_at: "2026-05-22T09:00:00Z" },
        { id: 2, plan_name: "2026春-计算机学院-修正版", semester: "2026-spring", status: "DRAFT", overall_fitness: 0.87, created_at: "2026-05-25T14:00:00Z", published_at: null },
    ];

    var MOCK_CONFLICT_RESULTS = [
        { id: 1, semester: "2026-spring", course_count: 50, conflict_pairs_count: 15, threshold: 30, created_at: "2026-05-21T14:00:00Z" },
    ];

    var MOCK_ALGORITHM_CONFIG = {
        variance_weight: 0.6, conflict_penalty_weight: 0.4,
        protected_slot_penalty: 8.0, population_size: 200,
        max_generations: 500, mutation_rate: 0.05,
        crossover_rate: 0.85, timeout_seconds: 300,
        updated_at: "2026-05-20T10:30:00Z", updated_by: "张教务"
    };

    // ======================== Admin Mock 处理器 ========================

    registerMock('GET', '/admin/courses/', function (params) {
        var results = MOCK_COURSES.map(function (c) {
            return {
                id: c.course_id, name: c.name, code: c.code || '',
                credit: c.credit, hours: 48,
                major: MOCK_MAJORS[0],
                teachers: [{ id: 1, name: c.teacher }],
                required_classroom_types: ["多媒体"],
                expected_student_count: c.capacity,
                is_professional_course: c.is_professional,
                semester: "2026-spring"
            };
        });
        // 支持 keyword 搜索
        if (params && params.keyword) {
            var kw = params.keyword.toLowerCase();
            results = results.filter(function(c) {
                return c.name.toLowerCase().indexOf(kw) !== -1 || (c.code || '').toLowerCase().indexOf(kw) !== -1;
            });
        }
        return { count: results.length, results: results };
    });

    var _mockCourseNextId = 100;
    registerMock('POST', '/admin/courses/', function (body) {
        var newId = _mockCourseNextId++;
        var majorId = body.major_id || 1;
        var majorObj = MOCK_MAJORS.find(function(m) { return m.id === majorId; }) || MOCK_MAJORS[0];
        var teacherIds = body.teacher_ids || [];
        var teachers = teacherIds.map(function(tid) {
            var t = MOCK_TEACHERS.find(function(x) { return x.id === tid; });
            return t ? { id: t.id, name: t.name } : { id: tid, name: '未知教师' };
        });
        var course = {
            id: newId, name: body.name || '', code: body.code || '',
            credit: body.credit || 0, hours: body.hours || 48,
            major: majorObj, teachers: teachers,
            required_classroom_types: body.required_classroom_types || ["多媒体"],
            expected_student_count: body.expected_student_count || 100,
            is_professional_course: body.is_professional_course !== false,
            semester: body.semester || "2026-spring"
        };
        // 同时更新 MOCK_COURSES（保持兼容）
        MOCK_COURSES.push({
            course_id: newId, name: course.name, code: course.code,
            credit: course.credit, teacher: teachers.map(function(t){return t.name;}).join(', '),
            capacity: course.expected_student_count, enrolled_count: 0,
            time_slots: [], is_professional: course.is_professional_course,
            category: course.is_professional_course ? '专必' : '通识'
        });
        return course;
    });

    registerMockPattern('PATCH', '/admin/courses/{id}/', function (body, vars) {
        var id = parseInt(vars.id);
        // 更新 MOCK_COURSES 中的数据
        for (var i = 0; i < MOCK_COURSES.length; i++) {
            if (MOCK_COURSES[i].course_id === id) {
                if (body.name !== undefined) MOCK_COURSES[i].name = body.name;
                if (body.code !== undefined) MOCK_COURSES[i].code = body.code;
                if (body.credit !== undefined) MOCK_COURSES[i].credit = body.credit;
                if (body.expected_student_count !== undefined) MOCK_COURSES[i].capacity = body.expected_student_count;
                if (body.is_professional_course !== undefined) {
                    MOCK_COURSES[i].is_professional = body.is_professional_course;
                    MOCK_COURSES[i].category = body.is_professional_course ? '专必' : '通识';
                }
                break;
            }
        }
        // 构建返回数据
        var majorId = body.major_id || 1;
        var majorObj = MOCK_MAJORS.find(function(m) { return m.id === majorId; }) || MOCK_MAJORS[0];
        return {
            id: id, name: body.name || '', code: body.code || '',
            credit: body.credit || 0, hours: body.hours || 48,
            major: majorObj, teachers: [],
            required_classroom_types: body.required_classroom_types || ["多媒体"],
            expected_student_count: body.expected_student_count || 100,
            is_professional_course: body.is_professional_course !== false,
            semester: body.semester || "2026-spring"
        };
    });

    registerMockPattern('DELETE', '/admin/courses/{id}/', function (body, vars) {
        var id = parseInt(vars.id);
        var before = MOCK_COURSES.length;
        MOCK_COURSES = MOCK_COURSES.filter(function (c) { return c.course_id !== id; });
        if (MOCK_COURSES.length === before) { var err = new Error('Not found'); err.status = 404; throw err; }
        return {};
    });

    registerMock('GET', '/admin/teachers/', function () {
        return { count: MOCK_TEACHERS.length, results: MOCK_TEACHERS };
    });

    registerMock('POST', '/admin/teachers/', function (body) {
        var newId = Math.max.apply(null, MOCK_TEACHERS.map(function(t){return t.id;})) + 1;
        var teacher = {
            id: newId,
            name: body.name || '',
            employee_no: body.employee_no || '',
            department: body.department || '',
            unavailable_slots: body.unavailable_slots || []
        };
        MOCK_TEACHERS.push(teacher);
        return teacher;
    });

    registerMockPattern('PATCH', '/admin/teachers/{id}/', function (body, vars) {
        var id = parseInt(vars.id);
        for (var i = 0; i < MOCK_TEACHERS.length; i++) {
            if (MOCK_TEACHERS[i].id === id) {
                if (body.name !== undefined) MOCK_TEACHERS[i].name = body.name;
                if (body.employee_no !== undefined) MOCK_TEACHERS[i].employee_no = body.employee_no;
                if (body.department !== undefined) MOCK_TEACHERS[i].department = body.department;
                if (body.unavailable_slots !== undefined) MOCK_TEACHERS[i].unavailable_slots = body.unavailable_slots;
                return MOCK_TEACHERS[i];
            }
        }
        var err = new Error('Not found'); err.status = 404; throw err;
    });

    registerMockPattern('DELETE', '/admin/teachers/{id}/', function (body, vars) {
        var id = parseInt(vars.id);
        var before = MOCK_TEACHERS.length;
        MOCK_TEACHERS = MOCK_TEACHERS.filter(function (t) { return t.id !== id; });
        if (MOCK_TEACHERS.length === before) { var err = new Error('Not found'); err.status = 404; throw err; }
        return {};
    });

    // ---- 学生 CRUD mock ----
    registerMock('GET', '/admin/students/', function (params) {
        var results = MOCK_STUDENTS;
        if (params && params.keyword) {
            var kw = params.keyword.toLowerCase();
            results = MOCK_STUDENTS.filter(function(s) {
                return s.name.toLowerCase().indexOf(kw) !== -1 || s.student_no.indexOf(kw) !== -1;
            });
        }
        return { count: results.length, results: results };
    });

    registerMock('POST', '/admin/students/', function (body) {
        var newId = Math.max.apply(null, MOCK_STUDENTS.map(function(s){return s.id;})) + 1;
        var majorId = body.major || 1;
        var majorObj = MOCK_MAJORS.find(function(m) { return m.id === majorId; }) || MOCK_MAJORS[0];
        var student = {
            id: newId,
            student_no: body.student_no || '',
            name: body.name || '',
            major: majorId,
            major_name: majorObj.name,
            grade: body.grade || '',
            class_identification: body.class_identification || ''
        };
        MOCK_STUDENTS.push(student);
        return student;
    });

    registerMockPattern('PATCH', '/admin/students/{id}/', function (body, vars) {
        var id = parseInt(vars.id);
        for (var i = 0; i < MOCK_STUDENTS.length; i++) {
            if (MOCK_STUDENTS[i].id === id) {
                if (body.name !== undefined) MOCK_STUDENTS[i].name = body.name;
                if (body.student_no !== undefined) MOCK_STUDENTS[i].student_no = body.student_no;
                if (body.major !== undefined) {
                    MOCK_STUDENTS[i].major = body.major;
                    var m = MOCK_MAJORS.find(function(x) { return x.id === body.major; });
                    if (m) MOCK_STUDENTS[i].major_name = m.name;
                }
                if (body.grade !== undefined) MOCK_STUDENTS[i].grade = body.grade;
                if (body.class_identification !== undefined) MOCK_STUDENTS[i].class_identification = body.class_identification;
                return MOCK_STUDENTS[i];
            }
        }
        var err = new Error('Not found'); err.status = 404; throw err;
    });

    registerMockPattern('DELETE', '/admin/students/{id}/', function (body, vars) {
        var id = parseInt(vars.id);
        var before = MOCK_STUDENTS.length;
        MOCK_STUDENTS = MOCK_STUDENTS.filter(function (s) { return s.id !== id; });
        if (MOCK_STUDENTS.length === before) { var err = new Error('Not found'); err.status = 404; throw err; }
        return {};
    });

    registerMock('GET', '/admin/classrooms/', function () {
        return { count: MOCK_CLASSROOMS.length, results: MOCK_CLASSROOMS };
    });

    registerMock('GET', '/admin/majors/', function () {
        return { count: MOCK_MAJORS.length, results: MOCK_MAJORS };
    });

    registerMockPattern('GET', '/admin/majors/{id}/students/', function (params, vars) {
        return {
            count: 120, results: [
                { id: 2024001, student_no: "2024001", name: "张三" },
                { id: 2024002, student_no: "2024002", name: "李四" },
            ]
        };
    });

    registerMock('GET', '/admin/protected-slots/', function () {
        return { count: MOCK_PROTECTED_SLOTS.length, results: MOCK_PROTECTED_SLOTS };
    });

    registerMock('POST', '/admin/protected-slots/', function (body) {
        var newSlot = { id: Date.now(), day_of_week: parseInt(body.day_of_week), start_period: parseInt(body.start_period), end_period: parseInt(body.end_period), penalty_weight: parseFloat(body.penalty_weight), description: body.description || '' };
        MOCK_PROTECTED_SLOTS.push(newSlot);
        return newSlot;
    });

    registerMockPattern('DELETE', '/admin/protected-slots/{id}/', function (body, vars) {
        var id = parseInt(vars.id);
        MOCK_PROTECTED_SLOTS = MOCK_PROTECTED_SLOTS.filter(function (s) { return s.id !== id; });
        return {};
    });

    registerMock('PUT', '/admin/protected-slots/batch-update/', function (body) {
        MOCK_PROTECTED_SLOTS = body;
        return { updated_count: body.length };
    });

    registerMock('GET', '/admin/schedule/plans/', function () {
        return { count: MOCK_SCHEDULE_PLANS.length, results: MOCK_SCHEDULE_PLANS };
    });

    registerMockPattern('DELETE', '/admin/schedule/plans/{id}/', function (body, vars) {
        var id = parseInt(vars.id);
        var before = MOCK_SCHEDULE_PLANS.length;
        MOCK_SCHEDULE_PLANS = MOCK_SCHEDULE_PLANS.filter(function(p) { return p.id !== id; });
        if (MOCK_SCHEDULE_PLANS.length === before) { var err = new Error('Not found'); err.status = 404; throw err; }
        return {};
    });

    registerMockPattern('GET', '/admin/schedule/plans/{id}/', function (body, vars) {
        var id = parseInt(vars.id);
        var plan = null;
        for (var i = 0; i < MOCK_SCHEDULE_PLANS.length; i++) {
            if (MOCK_SCHEDULE_PLANS[i].id === id) { plan = MOCK_SCHEDULE_PLANS[i]; break; }
        }
        if (!plan) return {};
        // 生成 mock entries（使用真实教师名称和多样化教室）
        var classrooms = ['A101', 'A102', 'B201', 'B203', 'C301', 'D101', 'D202', 'E401'];
        var entries = MOCK_COURSES.slice(0, 20).map(function(c, idx) {
            var slots = c.time_slots || [];
            return slots.map(function(s) {
                var roomName = classrooms[(idx + s.day_of_week + s.period) % classrooms.length];
                return {
                    id: idx * 10 + s.day_of_week * 11 + s.period,
                    course: { id: c.course_id, name: c.name },
                    teacher: { id: (idx % 5) + 1, name: c.teacher },
                    classroom: { id: (idx % 8) + 1, name: roomName },
                    day_of_week: s.day_of_week,
                    period: s.period,
                    student_group_ids: []
                };
            });
        }).flat();
        plan.entries = entries;
        return plan;
    });

    registerMockPattern('GET', '/admin/schedule/plans/{id}/evaluation/', function (body, vars) {
        return {
            overall_fitness: 0.91, daily_hour_variance: 1.2,
            daily_distribution: [4, 6, 4, 6, 4],
            protected_slot_occupied: 1, hard_constraint_violations: []
        };
    });

    registerMockPattern('POST', '/admin/schedule/plans/{id}/publish/', function (body, vars) {
        var id = parseInt(vars.id);
        for (var i = 0; i < MOCK_SCHEDULE_PLANS.length; i++) {
            if (MOCK_SCHEDULE_PLANS[i].id === id) {
                MOCK_SCHEDULE_PLANS[i].status = 'PUBLISHED';
                MOCK_SCHEDULE_PLANS[i].published_at = new Date().toISOString();
                return { plan_id: id, status: 'PUBLISHED', published_at: MOCK_SCHEDULE_PLANS[i].published_at };
            }
        }
        return {};
    });

    registerMock('POST', '/admin/schedule/generate/', function (body) {
        var taskId = 'mock_task_' + Date.now();
        var newPlan = {
            id: Date.now(), plan_name: body.plan_name || '新方案',
            semester: body.semester || '2026-spring', status: 'DRAFT',
            overall_fitness: (0.8 + Math.random() * 0.15).toFixed(2),
            created_at: new Date().toISOString(), published_at: null
        };
        MOCK_SCHEDULE_PLANS.unshift(newPlan);
        return { task_id: taskId, status: 'PENDING' };
    });

    registerMockPattern('GET', '/admin/schedule/tasks/{id}/', function (body, vars) {
        return { task_id: vars.id, status: 'SUCCESS', progress: 1.0, current_generation: 500, best_fitness: 0.93, plan_id: 3 };
    });

    registerMock('POST', '/admin/conflict-analysis/run/', function () {
        return { task_id: 'conflict_task_' + Date.now(), status: 'PENDING' };
    });

    registerMockPattern('GET', '/admin/conflict-analysis/tasks/{id}/', function (body, vars) {
        return { task_id: vars.id, status: 'SUCCESS', progress: 1.0, analyzed_pairs: 2400, total_pairs: 2400, conflict_pairs_found: 15 };
    });

    registerMock('GET', '/admin/conflict-analysis/results/', function () {
        return { count: MOCK_CONFLICT_RESULTS.length, results: MOCK_CONFLICT_RESULTS };
    });

    registerMockPattern('GET', '/admin/conflict-analysis/results/{id}/pairs/', function (body, vars) {
        return {
            count: 3, results: [
                { course_a: { id: 101, name: "数据结构" }, course_b: { id: 207, name: "经济学原理" }, conflicting_student_count: 56, conflict_rate: 0.47 },
                { course_a: { id: 102, name: "操作系统" }, course_b: { id: 305, name: "人工智能导论" }, conflicting_student_count: 42, conflict_rate: 0.35 },
                { course_a: { id: 103, name: "计算机组成原理" }, course_b: { id: 401, name: "离散数学" }, conflicting_student_count: 38, conflict_rate: 0.31 },
            ]
        };
    });

    registerMock('GET', '/admin/algorithm-config/', function () {
        return MOCK_ALGORITHM_CONFIG;
    });

    registerMock('PUT', '/admin/algorithm-config/', function (body) {
        for (var key in body) {
            if (body.hasOwnProperty(key)) MOCK_ALGORITHM_CONFIG[key] = body[key];
        }
        MOCK_ALGORITHM_CONFIG.updated_at = new Date().toISOString();
        MOCK_ALGORITHM_CONFIG.updated_by = '张教务';
        return MOCK_ALGORITHM_CONFIG;
    });

    // ======================== 公开 API ========================

    return {
        config: CONFIG,
        setMockMode: setMockMode,
        setBaseUrl: setBaseUrl,
        isMockMode: isMockMode,
        getBaseUrl: getBaseUrl,

        token: {
            getAccess: getAccessToken,
            getRefresh: getRefreshToken,
            set: setTokens,
            clear: clearTokens,
            isAuthenticated: isAuthenticated,
        },
        setLoginMode: setLoginMode,
        getLoginMode: getLoginMode,
        isAuthenticated: isAuthenticated,

        _mockSelected: mockSelected,
        _buildBitmap: buildBitmap,
        _getCourseById: getCourseById,
        _hasBitmapConflict: hasBitmapConflict,
        _getMockCourseList: getMockCourseList,

        auth: {
            login: function (username, password) {
                return apiCall('POST', '/auth/login/', { username: username, password: password });
            },
            logout: function () {
                var refresh = getRefreshToken();
                clearTokens();
                if (refresh) return apiCall('POST', '/auth/logout/', { refresh: refresh });
                return Promise.resolve({ detail: 'Logged out' });
            },
            me: function () { return apiCall('GET', '/auth/me/'); }
        },

        student: {
            getSchedule: function () { return apiCall('GET', '/student/schedule/'); },
            getCourses: function (params) {
                params = params || {};
                var query = [];
                if (params.page) query.push('page=' + params.page);
                if (params.page_size) query.push('page_size=' + params.page_size);
                if (params.keyword) query.push('keyword=' + encodeURIComponent(params.keyword));
                if (params.major) query.push('major=' + params.major);
                return apiCall('GET', '/student/courses/?' + query.join('&'));
            },
            getConflictDetail: function (courseId) {
                return apiCall('GET', '/student/courses/' + courseId + '/conflict-detail/');
            },
            selectCourse: function (courseId) {
                return apiCall('POST', '/student/courses/' + courseId + '/select/');
            },
            dropCourse: function (courseId) {
                return apiCall('DELETE', '/student/courses/' + courseId + '/drop/');
            },
            getFreeSlots: function () { return apiCall('GET', '/student/free-slots/'); },
            getFreeSlotRecommendations: function (day, period, params) {
                var query = [];
                if (params && params.major) query.push('major=' + params.major);
                if (params && params.category) query.push('category=' + encodeURIComponent(params.category));
                return apiCall('GET', '/student/free-slots/' + day + '/' + period + '/recommend/?' + query.join('&'));
            }
        },

        admin: {
            getCourses: function (params) { return apiCall('GET', '/admin/courses/'); },
            createCourse: function (data) { return apiCall('POST', '/admin/courses/', data); },
            updateCourse: function (id, data) { return apiCall('PATCH', '/admin/courses/' + id + '/', data); },
            deleteCourse: function (id) { return apiCall('DELETE', '/admin/courses/' + id + '/'); },
            getTeachers: function (params) { return apiCall('GET', '/admin/teachers/'); },
            createTeacher: function (data) { return apiCall('POST', '/admin/teachers/', data); },
            updateTeacher: function (id, data) { return apiCall('PATCH', '/admin/teachers/' + id + '/', data); },
            deleteTeacher: function (id) { return apiCall('DELETE', '/admin/teachers/' + id + '/'); },
            getClassrooms: function () { return apiCall('GET', '/admin/classrooms/'); },
            getStudents: function (params) { return apiCall('GET', '/admin/students/'); },
            createStudent: function (data) { return apiCall('POST', '/admin/students/', data); },
            updateStudent: function (id, data) { return apiCall('PATCH', '/admin/students/' + id + '/', data); },
            deleteStudent: function (id) { return apiCall('DELETE', '/admin/students/' + id + '/'); },
            getMajors: function () { return apiCall('GET', '/admin/majors/'); },
            getMajorStudents: function (majorId) { return apiCall('GET', '/admin/majors/' + majorId + '/students/'); },

            getProtectedSlots: function () { return apiCall('GET', '/admin/protected-slots/'); },
            addProtectedSlot: function (data) { return apiCall('POST', '/admin/protected-slots/', data); },
            deleteProtectedSlot: function (id) { return apiCall('DELETE', '/admin/protected-slots/' + id + '/'); },
            batchUpdateProtectedSlots: function (data) { return apiCall('PUT', '/admin/protected-slots/batch-update/', data); },

            getSchedulePlans: function () { return apiCall('GET', '/admin/schedule/plans/'); },
            deleteSchedulePlan: function (id) { return apiCall('DELETE', '/admin/schedule/plans/' + id + '/'); },
            getSchedulePlan: function (id) { return apiCall('GET', '/admin/schedule/plans/' + id + '/'); },
            getSchedulePlanEvaluation: function (id) { return apiCall('GET', '/admin/schedule/plans/' + id + '/evaluation/'); },
            generateSchedule: function (data) { return apiCall('POST', '/admin/schedule/generate/', data); },
            publishPlan: function (id) { return apiCall('POST', '/admin/schedule/plans/' + id + '/publish/'); },
            getScheduleTask: function (taskId) { return apiCall('GET', '/admin/schedule/tasks/' + taskId + '/'); },

            runConflictAnalysis: function (data) { return apiCall('POST', '/admin/conflict-analysis/run/', data); },
            getConflictTask: function (taskId) { return apiCall('GET', '/admin/conflict-analysis/tasks/' + taskId + '/'); },
            getConflictResults: function () { return apiCall('GET', '/admin/conflict-analysis/results/'); },
            getConflictPairs: function (resultId) { return apiCall('GET', '/admin/conflict-analysis/results/' + resultId + '/pairs/'); },

            getAlgorithmConfig: function () { return apiCall('GET', '/admin/algorithm-config/'); },
            updateAlgorithmConfig: function (data) { return apiCall('PUT', '/admin/algorithm-config/', data); },
        }
    };
})();
/** End of CourseQSortAPI */
