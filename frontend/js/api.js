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

var CourseQSortAPI = (function() {
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
        if (CONFIG.LOGIN_MODE === 'jwt') return !!getAccessToken();
        return !!sessionStorage.getItem('studentName');
    }

    function getLoginMode() { return CONFIG.LOGIN_MODE; }
    function setLoginMode(mode) { CONFIG.LOGIN_MODE = mode; }

    // ======================== 核心 HTTP 请求 ========================

    async function apiCall(method, path, body, opts) {
        opts = opts || {};

        if (CONFIG.USE_MOCK) {
            return mockResponse(method, path, body);
        }

        var url = CONFIG.BASE_URL + path;
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
                try { errData = await resp.json(); } catch(e) {}
                var err = new Error('API Error: ' + resp.status);
                err.status = resp.status;
                err.data = errData;
                throw err;
            }

            if (resp.status === 204) return null;
            return await resp.json();

        } catch (err) {
            if (err.name === 'TypeError' && err.message.includes('fetch')) {
                console.warn('[API] Backend unreachable, falling back to mock');
                return mockResponse(method, path, body);
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
        } catch(e) {}
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
        str.split('&').forEach(function(pair) {
            var parts = pair.split('=');
            if (parts[0]) params[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1] || '');
        });
        return params;
    }

    function mockResponse(method, path, body) {
        var pathOnly = path.split('?')[0];
        var queryParams = parseQueryString(path.split('?')[1] || '');

        var key = method + ':' + pathOnly;
        if (mockCallbacks[key]) {
            return Promise.resolve(mockCallbacks[key](queryParams));
        }

        for (var mk in mockCallbacks) {
            if (mk.indexOf(':pattern:') === -1) continue;
            var pattern = mk.split(':pattern:')[1];
            if (matchPath(pathOnly, pattern)) {
                var matchedId = extractId(pathOnly, pattern);
                return Promise.resolve(mockCallbacks[mk](queryParams, matchedId));
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
        { course_id: 1, name: "高等数学A", credit: 5, teacher: "张教授", capacity: 180, enrolled_count: 150, time_slots: [{day_of_week:1,period:1},{day_of_week:1,period:2},{day_of_week:3,period:1},{day_of_week:3,period:2}], is_professional: true, category: "专必" },
        { course_id: 2, name: "大学英语Ⅱ", credit: 4, teacher: "李老师", capacity: 160, enrolled_count: 140, time_slots: [{day_of_week:2,period:3},{day_of_week:2,period:4},{day_of_week:4,period:3},{day_of_week:4,period:4}], is_professional: true, category: "专必" },
        { course_id: 3, name: "线性代数", credit: 3, teacher: "王教授", capacity: 150, enrolled_count: 130, time_slots: [{day_of_week:3,period:5},{day_of_week:3,period:6},{day_of_week:5,period:5}], is_professional: true, category: "专必" },
        { course_id: 4, name: "马克思主义原理", credit: 2, teacher: "陈老师", capacity: 200, enrolled_count: 120, time_slots: [{day_of_week:1,period:7},{day_of_week:1,period:8}], is_professional: true, category: "专必" },
        { course_id: 5, name: "体育(二)", credit: 1, teacher: "刘教练", capacity: 60, enrolled_count: 40, time_slots: [{day_of_week:5,period:9},{day_of_week:5,period:10}], is_professional: false, category: "通识" },
        { course_id: 6, name: "数据结构", credit: 4, teacher: "赵教授", capacity: 100, enrolled_count: 80, time_slots: [{day_of_week:1,period:3},{day_of_week:1,period:4},{day_of_week:3,period:3},{day_of_week:3,period:4}], is_professional: true, category: "专必" },
        { course_id: 7, name: "计算机组成原理", credit: 4, teacher: "孙老师", capacity: 120, enrolled_count: 90, time_slots: [{day_of_week:2,period:1},{day_of_week:2,period:2},{day_of_week:4,period:1},{day_of_week:4,period:2}], is_professional: true, category: "专必" },
        { course_id: 8, name: "操作系统", credit: 4, teacher: "周教授", capacity: 100, enrolled_count: 70, time_slots: [{day_of_week:1,period:5},{day_of_week:1,period:6},{day_of_week:3,period:7},{day_of_week:3,period:8}], is_professional: true, category: "专必" },
        { course_id: 9, name: "数据库原理", credit: 3, teacher: "吴老师", capacity: 110, enrolled_count: 85, time_slots: [{day_of_week:2,period:5},{day_of_week:2,period:6},{day_of_week:4,period:5}], is_professional: true, category: "专必" },
        { course_id: 10, name: "概率论与数理统计", credit: 3, teacher: "郑教授", capacity: 130, enrolled_count: 110, time_slots: [{day_of_week:3,period:9},{day_of_week:3,period:10},{day_of_week:5,period:1},{day_of_week:5,period:2}], is_professional: true, category: "专必" },
        { course_id: 11, name: "Python程序设计", credit: 3, teacher: "王老师", capacity: 90, enrolled_count: 60, time_slots: [{day_of_week:2,period:7},{day_of_week:2,period:8},{day_of_week:4,period:7}], is_professional: false, category: "专选" },
        { course_id: 12, name: "Java语言", credit: 3, teacher: "李老师", capacity: 80, enrolled_count: 70, time_slots: [{day_of_week:1,period:9},{day_of_week:1,period:10},{day_of_week:3,period:9}], is_professional: false, category: "专选" },
        { course_id: 13, name: "人工智能导论", credit: 2, teacher: "刘教授", capacity: 120, enrolled_count: 40, time_slots: [{day_of_week:5,period:6},{day_of_week:5,period:7}], is_professional: false, category: "专选" },
        { course_id: 14, name: "机器学习", credit: 3, teacher: "陈老师", capacity: 100, enrolled_count: 50, time_slots: [{day_of_week:2,period:9},{day_of_week:2,period:10},{day_of_week:4,period:8}], is_professional: false, category: "专选" },
        { course_id: 15, name: "数字逻辑", credit: 3, teacher: "张老师", capacity: 90, enrolled_count: 75, time_slots: [{day_of_week:1,period:3},{day_of_week:1,period:4},{day_of_week:3,period:3}], is_professional: true, category: "专必" },
        { course_id: 16, name: "离散数学", credit: 3, teacher: "赵老师", capacity: 110, enrolled_count: 95, time_slots: [{day_of_week:2,period:3},{day_of_week:2,period:4},{day_of_week:4,period:3}], is_professional: true, category: "专必" },
        { course_id: 17, name: "计算机网络", credit: 3, teacher: "孙教授", capacity: 100, enrolled_count: 80, time_slots: [{day_of_week:3,period:1},{day_of_week:3,period:2},{day_of_week:5,period:3}], is_professional: true, category: "专必" },
        { course_id: 18, name: "软件工程", credit: 2, teacher: "周老师", capacity: 100, enrolled_count: 90, time_slots: [{day_of_week:4,period:9},{day_of_week:4,period:10}], is_professional: false, category: "专选" },
        { course_id: 19, name: "编译原理", credit: 3, teacher: "吴教授", capacity: 80, enrolled_count: 55, time_slots: [{day_of_week:5,period:1},{day_of_week:5,period:2},{day_of_week:5,period:3}], is_professional: true, category: "专必" },
        { course_id: 20, name: "网络安全", credit: 2, teacher: "郑老师", capacity: 80, enrolled_count: 30, time_slots: [{day_of_week:1,period:8},{day_of_week:1,period:9}], is_professional: false, category: "专选" },
        { course_id: 21, name: "数字图像处理", credit: 2, teacher: "王老师", capacity: 70, enrolled_count: 50, time_slots: [{day_of_week:2,period:1},{day_of_week:2,period:2}], is_professional: false, category: "专选" },
        { course_id: 22, name: "嵌入式系统", credit: 2, teacher: "李老师", capacity: 60, enrolled_count: 45, time_slots: [{day_of_week:3,period:5},{day_of_week:3,period:6}], is_professional: false, category: "专选" },
        { course_id: 23, name: "云计算概论", credit: 2, teacher: "刘老师", capacity: 100, enrolled_count: 20, time_slots: [{day_of_week:4,period:5},{day_of_week:4,period:6}], is_professional: false, category: "专选" },
        { course_id: 24, name: "大数据技术", credit: 3, teacher: "陈教授", capacity: 90, enrolled_count: 60, time_slots: [{day_of_week:5,period:7},{day_of_week:5,period:8},{day_of_week:5,period:9}], is_professional: false, category: "专选" },
        { course_id: 25, name: "算法设计与分析", credit: 3, teacher: "张教授", capacity: 80, enrolled_count: 65, time_slots: [{day_of_week:1,period:5},{day_of_week:1,period:6},{day_of_week:3,period:7}], is_professional: true, category: "专必" },
        { course_id: 26, name: "移动应用开发", credit: 2, teacher: "孙老师", capacity: 70, enrolled_count: 30, time_slots: [{day_of_week:2,period:7},{day_of_week:2,period:8}], is_professional: false, category: "专选" },
        { course_id: 27, name: "游戏引擎原理", credit: 2, teacher: "周老师", capacity: 50, enrolled_count: 20, time_slots: [{day_of_week:4,period:1},{day_of_week:4,period:2}], is_professional: false, category: "专选" },
        { course_id: 28, name: "信息检索", credit: 2, teacher: "吴老师", capacity: 60, enrolled_count: 40, time_slots: [{day_of_week:3,period:10},{day_of_week:3,period:11}], is_professional: false, category: "专选" },
        { course_id: 29, name: "计算机图形学", credit: 3, teacher: "郑老师", capacity: 70, enrolled_count: 50, time_slots: [{day_of_week:1,period:10},{day_of_week:1,period:11},{day_of_week:3,period:11}], is_professional: false, category: "专选" },
        { course_id: 30, name: "模式识别", credit: 2, teacher: "王教授", capacity: 80, enrolled_count: 35, time_slots: [{day_of_week:2,period:11},{day_of_week:4,period:11}], is_professional: false, category: "专选" },
        { course_id: 31, name: "数据挖掘", credit: 2, teacher: "李教授", capacity: 90, enrolled_count: 40, time_slots: [{day_of_week:5,period:1},{day_of_week:5,period:2}], is_professional: false, category: "专选" },
        { course_id: 32, name: "自然语言处理", credit: 2, teacher: "刘老师", capacity: 80, enrolled_count: 50, time_slots: [{day_of_week:3,period:1},{day_of_week:3,period:2}], is_professional: false, category: "专选" },
        { course_id: 33, name: "计算机视觉", credit: 2, teacher: "陈老师", capacity: 70, enrolled_count: 30, time_slots: [{day_of_week:4,period:7},{day_of_week:4,period:8}], is_professional: false, category: "专选" },
        { course_id: 34, name: "物联网导论", credit: 2, teacher: "张老师", capacity: 60, enrolled_count: 45, time_slots: [{day_of_week:1,period:1},{day_of_week:1,period:2}], is_professional: false, category: "专选" },
        { course_id: 35, name: "区块链技术", credit: 2, teacher: "孙老师", capacity: 50, enrolled_count: 40, time_slots: [{day_of_week:2,period:5},{day_of_week:2,period:6}], is_professional: false, category: "专选" },
        { course_id: 36, name: "量化交易", credit: 2, teacher: "周老师", capacity: 40, enrolled_count: 30, time_slots: [{day_of_week:3,period:5},{day_of_week:3,period:6}], is_professional: false, category: "专选" },
        { course_id: 37, name: "经济学原理", credit: 3, teacher: "吴教授", capacity: 120, enrolled_count: 100, time_slots: [{day_of_week:5,period:3},{day_of_week:5,period:4},{day_of_week:5,period:5}], is_professional: false, category: "通识" },
        { course_id: 38, name: "管理学", credit: 2, teacher: "郑教授", capacity: 100, enrolled_count: 80, time_slots: [{day_of_week:4,period:9},{day_of_week:4,period:10}], is_professional: false, category: "通识" },
        { course_id: 39, name: "书法鉴赏", credit: 1, teacher: "刘老师", capacity: 40, enrolled_count: 30, time_slots: [{day_of_week:1,period:11}], is_professional: false, category: "通识" },
        { course_id: 40, name: "影视鉴赏", credit: 1, teacher: "陈老师", capacity: 50, enrolled_count: 40, time_slots: [{day_of_week:2,period:11}], is_professional: false, category: "通识" },
        { course_id: 41, name: "音乐基础", credit: 1, teacher: "李老师", capacity: 45, enrolled_count: 35, time_slots: [{day_of_week:3,period:11}], is_professional: false, category: "通识" },
        { course_id: 42, name: "摄影技术", credit: 1, teacher: "王老师", capacity: 35, enrolled_count: 20, time_slots: [{day_of_week:4,period:11}], is_professional: false, category: "通识" },
        { course_id: 43, name: "书法实践", credit: 1, teacher: "张老师", capacity: 30, enrolled_count: 25, time_slots: [{day_of_week:5,period:11}], is_professional: false, category: "通识" },
        { course_id: 44, name: "心理学导论", credit: 2, teacher: "孙老师", capacity: 80, enrolled_count: 70, time_slots: [{day_of_week:1,period:7},{day_of_week:1,period:8}], is_professional: false, category: "通识" },
        { course_id: 45, name: "社会学概论", credit: 2, teacher: "周老师", capacity: 70, enrolled_count: 60, time_slots: [{day_of_week:2,period:1},{day_of_week:2,period:2}], is_professional: false, category: "通识" },
        { course_id: 46, name: "哲学入门", credit: 1, teacher: "吴老师", capacity: 50, enrolled_count: 30, time_slots: [{day_of_week:3,period:3}], is_professional: false, category: "通识" },
        { course_id: 47, name: "演讲与口才", credit: 1, teacher: "郑老师", capacity: 40, enrolled_count: 35, time_slots: [{day_of_week:4,period:1}], is_professional: false, category: "通识" },
        { course_id: 48, name: "时间管理", credit: 1, teacher: "刘老师", capacity: 60, enrolled_count: 50, time_slots: [{day_of_week:5,period:2}], is_professional: false, category: "通识" },
        { course_id: 49, name: "创新创意基础", credit: 2, teacher: "陈教授", capacity: 90, enrolled_count: 80, time_slots: [{day_of_week:1,period:5},{day_of_week:1,period:6}], is_professional: false, category: "通识" },
        { course_id: 50, name: "职业规划", credit: 1, teacher: "张老师", capacity: 80, enrolled_count: 60, time_slots: [{day_of_week:2,period:9}], is_professional: false, category: "通识" }
    ];

    var MOCK_MANDATORY_IDS = [1, 2, 3, 4, 5];

    var mockSelected = MOCK_MANDATORY_IDS.map(function(id) {
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

    registerMock('POST', '/auth/login/', function(body) {
        return {
            access: 'mock_access_token_' + Date.now(),
            refresh: 'mock_refresh_token_' + Date.now(),
            user: {
                id: 1,
                username: body.username || 'student',
                role: 'STUDENT',
                name: body.username || '测试同学',
                email: 'test@university.edu.cn',
                major: '计算机科学与技术'
            }
        };
    });

    registerMock('POST', '/auth/refresh/', function() {
        return { access: 'mock_refreshed_token_' + Date.now() };
    });

    registerMock('POST', '/auth/logout/', function() {
        return { detail: 'Successfully logged out' };
    });

    registerMock('GET', '/auth/me/', function() {
        return {
            id: 1, username: 'student', role: 'STUDENT',
            name: '测试同学', email: 'test@university.edu.cn',
            major: '计算机科学与技术'
        };
    });

    registerMock('GET', '/student/schedule/', function() {
        var bitmap = new Array(55).fill('0');
        mockSelected.forEach(function(sc) {
            var bm = buildBitmap(sc.time_slots).split('');
            for (var i = 0; i < 55; i++) {
                if (bm[i] === '1') bitmap[i] = '1';
            }
        });
        return {
            student_id: 2024001, semester: '2026-spring',
            bitmap: '0x' + bitmap.join(''),
            courses: mockSelected.map(function(sc) {
                return {
                    course_id: sc.course_id, name: sc.name,
                    teacher: sc.teacher, time_slots: sc.time_slots,
                    classroom: 'A101', mandatory: sc.mandatory || false
                };
            })
        };
    });

    registerMock('GET', '/student/courses/', function() {
        return getMockCourseList();
    });

    function getMockCourseList(params) {
        params = params || {};
        var page = params.page || 1;
        var pageSize = params.page_size || 50;

        var results = MOCK_COURSES.map(function(c) {
            var isSelected = mockSelected.some(function(sc) { return sc.course_id === c.course_id; });
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
                course_id: c.course_id, name: c.name, credit: c.credit,
                teacher: c.teacher, capacity: c.capacity,
                enrolled_count: c.enrolled_count,
                remaining_capacity: remaining,
                time_slots: c.time_slots, conflict: conflict,
                conflict_with: conflictWith, category: c.category,
                is_professional: c.is_professional
            };
        });

        var total = results.length;
        var start = (page - 1) * pageSize;
        var paged = results.slice(start, start + pageSize);

        return {
            count: total,
            next: start + pageSize < total ? '/student/courses/?page=' + (page + 1) : null,
            previous: page > 1 ? '/student/courses/?page=' + (page - 1) : null,
            results: paged
        };
    }

    registerMockPattern('GET', '/student/courses/{id}/conflict-detail/', function(body, vars) {
        var courseId = parseInt(vars.id);
        var course = getCourseById(courseId);
        if (!course) return {};
        var conflictCourses = [];
        var courseBm = buildBitmap(course.time_slots);
        mockSelected.forEach(function(sc) {
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

    registerMockPattern('POST', '/student/courses/{id}/select/', function(body, vars) {
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

    registerMockPattern('DELETE', '/student/courses/{id}/drop/', function(body, vars) {
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

    registerMock('GET', '/student/free-slots/', function() {
        var bitmap = new Array(55).fill('0');
        mockSelected.forEach(function(sc) {
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

    registerMockPattern('GET', '/student/free-slots/{day}/{period}/recommend/', function(body, vars) {
        var day = parseInt(vars.day);
        var period = parseInt(vars.period);
        var filtered = MOCK_COURSES.filter(function(c) {
            return c.time_slots.some(function(ts) { return ts.day_of_week === day && ts.period === period; });
        }).map(function(c) {
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
        { id: 1, name: "张教授", employee_no: "T001", department: "计算机学院", unavailable_slots: [{day_of_week:1,period:1},{day_of_week:1,period:2}] },
        { id: 2, name: "李老师", employee_no: "T002", department: "计算机学院", unavailable_slots: [] },
        { id: 3, name: "王教授", employee_no: "T003", department: "计算机学院", unavailable_slots: [] },
        { id: 4, name: "赵教授", employee_no: "T004", department: "数学学院", unavailable_slots: [] },
        { id: 5, name: "陈老师", employee_no: "T005", department: "外国语学院", unavailable_slots: [] },
    ];

    var MOCK_CLASSROOMS = [
        { id: 1, name: "A101", capacity: 120, building: "教学楼A", equipment_types: ["多媒体","黑板"], is_lab: false },
        { id: 2, name: "A102", capacity: 100, building: "教学楼A", equipment_types: ["多媒体"], is_lab: false },
        { id: 3, name: "B201", capacity: 80, building: "教学楼B", equipment_types: ["多媒体","黑板"], is_lab: false },
        { id: 4, name: "C301", capacity: 60, building: "实验楼C", equipment_types: ["电脑","投影"], is_lab: true },
        { id: 5, name: "D101", capacity: 200, building: "教学楼D", equipment_types: ["多媒体","音响"], is_lab: false },
    ];

    var MOCK_MAJORS = [
        { id: 1, name: "计算机科学与技术", code: "CS", student_count: 120 },
        { id: 2, name: "软件工程", code: "SE", student_count: 80 },
        { id: 3, name: "人工智能", code: "AI", student_count: 60 },
        { id: 4, name: "数学与应用数学", code: "MA", student_count: 90 },
        { id: 5, name: "英语", code: "EN", student_count: 70 },
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

    registerMock('GET', '/admin/courses/', function() {
        var results = MOCK_COURSES.map(function(c) {
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
        return { count: results.length, results: results };
    });

    registerMock('GET', '/admin/teachers/', function() {
        return { count: MOCK_TEACHERS.length, results: MOCK_TEACHERS };
    });

    registerMock('GET', '/admin/classrooms/', function() {
        return { count: MOCK_CLASSROOMS.length, results: MOCK_CLASSROOMS };
    });

    registerMock('GET', '/admin/majors/', function() {
        return { count: MOCK_MAJORS.length, results: MOCK_MAJORS };
    });

    registerMockPattern('GET', '/admin/majors/{id}/students/', function(params, vars) {
        return { count: 120, results: [
            { id: 2024001, student_no: "2024001", name: "张三" },
            { id: 2024002, student_no: "2024002", name: "李四" },
        ]};
    });

    registerMock('GET', '/admin/protected-slots/', function() {
        return { count: MOCK_PROTECTED_SLOTS.length, results: MOCK_PROTECTED_SLOTS };
    });

    registerMock('POST', '/admin/protected-slots/', function(body) {
        var newSlot = { id: Date.now(), day_of_week: parseInt(body.day_of_week), start_period: parseInt(body.start_period), end_period: parseInt(body.end_period), penalty_weight: parseFloat(body.penalty_weight), description: body.description || '' };
        MOCK_PROTECTED_SLOTS.push(newSlot);
        return newSlot;
    });

    registerMockPattern('DELETE', '/admin/protected-slots/{id}/', function(body, vars) {
        var id = parseInt(vars.id);
        MOCK_PROTECTED_SLOTS = MOCK_PROTECTED_SLOTS.filter(function(s) { return s.id !== id; });
        return {};
    });

    registerMock('PUT', '/admin/protected-slots/batch-update/', function(body) {
        MOCK_PROTECTED_SLOTS = body;
        return { updated_count: body.length };
    });

    registerMock('GET', '/admin/schedule/plans/', function() {
        return { count: MOCK_SCHEDULE_PLANS.length, results: MOCK_SCHEDULE_PLANS };
    });

    registerMockPattern('GET', '/admin/schedule/plans/{id}/', function(body, vars) {
        var id = parseInt(vars.id);
        var plan = null;
        for (var i = 0; i < MOCK_SCHEDULE_PLANS.length; i++) {
            if (MOCK_SCHEDULE_PLANS[i].id === id) { plan = MOCK_SCHEDULE_PLANS[i]; break; }
        }
        return plan || {};
    });

    registerMockPattern('GET', '/admin/schedule/plans/{id}/evaluation/', function(body, vars) {
        return {
            overall_fitness: 0.91, daily_hour_variance: 1.2,
            daily_distribution: [4, 6, 4, 6, 4],
            protected_slot_occupied: 1, hard_constraint_violations: []
        };
    });

    registerMockPattern('POST', '/admin/schedule/plans/{id}/publish/', function(body, vars) {
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

    registerMock('POST', '/admin/schedule/generate/', function(body) {
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

    registerMockPattern('GET', '/admin/schedule/tasks/{id}/', function(body, vars) {
        return { task_id: vars.id, status: 'SUCCESS', progress: 1.0, current_generation: 500, best_fitness: 0.93, plan_id: 3 };
    });

    registerMock('POST', '/admin/conflict-analysis/run/', function() {
        return { task_id: 'conflict_task_' + Date.now(), status: 'PENDING' };
    });

    registerMockPattern('GET', '/admin/conflict-analysis/tasks/{id}/', function(body, vars) {
        return { task_id: vars.id, status: 'SUCCESS', progress: 1.0, analyzed_pairs: 2400, total_pairs: 2400, conflict_pairs_found: 15 };
    });

    registerMock('GET', '/admin/conflict-analysis/results/', function() {
        return { count: MOCK_CONFLICT_RESULTS.length, results: MOCK_CONFLICT_RESULTS };
    });

    registerMockPattern('GET', '/admin/conflict-analysis/results/{id}/pairs/', function(body, vars) {
        return { count: 3, results: [
            { course_a: { id: 101, name: "数据结构" }, course_b: { id: 207, name: "经济学原理" }, conflicting_student_count: 56, conflict_rate: 0.47 },
            { course_a: { id: 102, name: "操作系统" }, course_b: { id: 305, name: "人工智能导论" }, conflicting_student_count: 42, conflict_rate: 0.35 },
            { course_a: { id: 103, name: "计算机组成原理" }, course_b: { id: 401, name: "离散数学" }, conflicting_student_count: 38, conflict_rate: 0.31 },
        ]};
    });

    registerMock('GET', '/admin/algorithm-config/', function() {
        return MOCK_ALGORITHM_CONFIG;
    });

    registerMock('PUT', '/admin/algorithm-config/', function(body) {
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
            login: function(username, password) {
                return apiCall('POST', '/auth/login/', { username: username, password: password });
            },
            logout: function() {
                var refresh = getRefreshToken();
                clearTokens();
                if (refresh) return apiCall('POST', '/auth/logout/', { refresh: refresh });
                return Promise.resolve({ detail: 'Logged out' });
            },
            me: function() { return apiCall('GET', '/auth/me/'); }
        },

        student: {
            getSchedule: function() { return apiCall('GET', '/student/schedule/'); },
            getCourses: function(params) {
                params = params || {};
                var query = [];
                if (params.page) query.push('page=' + params.page);
                if (params.page_size) query.push('page_size=' + params.page_size);
                if (params.keyword) query.push('keyword=' + encodeURIComponent(params.keyword));
                if (params.major) query.push('major=' + params.major);
                return apiCall('GET', '/student/courses/?' + query.join('&'));
            },
            getConflictDetail: function(courseId) {
                return apiCall('GET', '/student/courses/' + courseId + '/conflict-detail/');
            },
            selectCourse: function(courseId) {
                return apiCall('POST', '/student/courses/' + courseId + '/select/');
            },
            dropCourse: function(courseId) {
                return apiCall('DELETE', '/student/courses/' + courseId + '/drop/');
            },
            getFreeSlots: function() { return apiCall('GET', '/student/free-slots/'); },
            getFreeSlotRecommendations: function(day, period, params) {
                var query = [];
                if (params && params.major) query.push('major=' + params.major);
                if (params && params.category) query.push('category=' + encodeURIComponent(params.category));
                return apiCall('GET', '/student/free-slots/' + day + '/' + period + '/recommend/?' + query.join('&'));
            }
        },

        admin: {
            getCourses: function(params) { return apiCall('GET', '/admin/courses/'); },
            getTeachers: function(params) { return apiCall('GET', '/admin/teachers/'); },
            getClassrooms: function() { return apiCall('GET', '/admin/classrooms/'); },
            getMajors: function() { return apiCall('GET', '/admin/majors/'); },
            getMajorStudents: function(majorId) { return apiCall('GET', '/admin/majors/' + majorId + '/students/'); },

            getProtectedSlots: function() { return apiCall('GET', '/admin/protected-slots/'); },
            addProtectedSlot: function(data) { return apiCall('POST', '/admin/protected-slots/', data); },
            deleteProtectedSlot: function(id) { return apiCall('DELETE', '/admin/protected-slots/' + id + '/'); },
            batchUpdateProtectedSlots: function(data) { return apiCall('PUT', '/admin/protected-slots/batch-update/', data); },

            getSchedulePlans: function() { return apiCall('GET', '/admin/schedule/plans/'); },
            getSchedulePlan: function(id) { return apiCall('GET', '/admin/schedule/plans/' + id + '/'); },
            getSchedulePlanEvaluation: function(id) { return apiCall('GET', '/admin/schedule/plans/' + id + '/evaluation/'); },
            generateSchedule: function(data) { return apiCall('POST', '/admin/schedule/generate/', data); },
            publishPlan: function(id) { return apiCall('POST', '/admin/schedule/plans/' + id + '/publish/'); },
            getScheduleTask: function(taskId) { return apiCall('GET', '/admin/schedule/tasks/' + taskId + '/'); },

            runConflictAnalysis: function(data) { return apiCall('POST', '/admin/conflict-analysis/run/', data); },
            getConflictTask: function(taskId) { return apiCall('GET', '/admin/conflict-analysis/tasks/' + taskId + '/'); },
            getConflictResults: function() { return apiCall('GET', '/admin/conflict-analysis/results/'); },
            getConflictPairs: function(resultId) { return apiCall('GET', '/admin/conflict-analysis/results/' + resultId + '/pairs/'); },

            getAlgorithmConfig: function() { return apiCall('GET', '/admin/algorithm-config/'); },
            updateAlgorithmConfig: function(data) { return apiCall('PUT', '/admin/algorithm-config/', data); },
        }
    };
})();
/** End of CourseQSortAPI */
