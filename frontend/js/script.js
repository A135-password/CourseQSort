// ================================================================
// CourseQSort 选课系统 — 前端 UI 控制器
// 数据来源: CourseQSortAPI (支持 Mock / 真实后端双模式)
// ================================================================

// ======================== 登录检查 ========================

(function checkLogin() {
    if (!CourseQSortAPI.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }
    var name = sessionStorage.getItem('studentName') || '同学';
    document.getElementById('student-name-display').textContent = name + '，你好';

    // 数据来源标识
    var badge = document.getElementById('data-source-badge');
    if (CourseQSortAPI.getLoginMode() === 'jwt' && !CourseQSortAPI.isMockMode()) {
        badge.textContent = '后端模式';
        badge.className = 'badge bg-warning text-dark me-2';
    } else {
        badge.textContent = '预览模式';
        badge.className = 'badge bg-light text-dark me-2';
    }
})();

// ======================== DOM 引用 ========================

var courseListTbody = document.getElementById('course-list');
var selectedContainer = document.getElementById('selected-list');
var freeSlotsContainer = document.getElementById('free-slots-list');
var totalCreditsSpan = document.getElementById('total-credits');
var courseCountBadge = document.getElementById('course-count-badge');
var paginationInfo = document.getElementById('pagination-info');
var prevPageBtn = document.getElementById('prev-page-btn');
var nextPageBtn = document.getElementById('next-page-btn');
var loadingOverlay = document.getElementById('loading-overlay');

// ======================== 全局状态 ========================

var selectedCourses = [];     // 已选课程列表
var currentCourses = [];      // 当前页显示的课程
var currentPage = 1;
var pageSize = 20;
var totalCourseCount = 0;
var maxCredits = 25;
var isDataLoading = false;

// ======================== 加载控制 ========================

function showLoading(msg) {
    isDataLoading = true;
    var overlay = loadingOverlay;
    overlay.style.display = 'flex';
    var p = overlay.querySelector('p');
    if (msg) p.textContent = msg;
}

function hideLoading() {
    isDataLoading = false;
    loadingOverlay.style.display = 'none';
}

// ======================== 工具函数 ========================

function buildBitmap(slotsArray) {
    return CourseQSortAPI._buildBitmap(slotsArray);
}

function hasBitmapConflict(bm1, bm2) {
    return CourseQSortAPI._hasBitmapConflict(bm1, bm2);
}

// 合并连续节次显示 (如节次 1,2,3 显示为"1-3节")
function formatTimeSlots(slots) {
    var dayMap = {};
    slots.forEach(function(s) {
        var d = s.day_of_week || s.day;
        if (!dayMap[d]) dayMap[d] = [];
        dayMap[d].push(s.period);
    });
    var parts = [];
    var weekNames = ['一','二','三','四','五'];
    for (var day = 1; day <= 5; day++) {
        if (dayMap[day]) {
            var periods = dayMap[day].sort(function(a,b) { return a - b; });
            var merged = [];
            var start = periods[0], end = periods[0];
            for (var i = 1; i < periods.length; i++) {
                if (periods[i] === end + 1) { end = periods[i]; }
                else {
                    merged.push(start === end ? start + '节' : start + '-' + end + '节');
                    start = periods[i]; end = periods[i];
                }
            }
            merged.push(start === end ? start + '节' : start + '-' + end + '节');
            parts.push('周' + weekNames[day-1] + ' ' + merged.join(','));
        }
    }
    return parts.join('<br>') || '未知';
}

// 计算某课程与已选课程的冲突详情
function getConflictDetails(courseTimeSlots) {
    var conflicts = [];
    var courseBm = buildBitmap(courseTimeSlots);
    selectedCourses.forEach(function(sc) {
        var scBm = buildBitmap(sc.time_slots);
        if (hasBitmapConflict(courseBm, scBm)) {
            var conflictSlots = [];
            for (var i = 0; i < 55; i++) {
                if (courseBm[i] === '1' && scBm[i] === '1') {
                    conflictSlots.push({ day_of_week: Math.floor(i/11)+1, period: (i%11)+1 });
                }
            }
            conflicts.push({
                course_name: sc.name,
                teacher: sc.teacher || '',
                conflict_slots: conflictSlots
            });
        }
    });
    return conflicts;
}

// ======================== 数据加载 ========================

async function initApp() {
    showLoading('正在加载课程数据...');
    try {
        // 1. 加载已选课表
        var scheduleData = await CourseQSortAPI.student.getSchedule();
        selectedCourses = scheduleData.courses || [];
        sessionStorage.setItem('selectedCoursesData', JSON.stringify(selectedCourses));

        // 2. 加载课程列表
        await loadCoursePage(1);

        // 3. 渲染
        renderAll();
        hideLoading();
    } catch (err) {
        console.error('[App] Init error:', err);
        courseListTbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">加载数据失败，请检查后端服务是否运行</td></tr>';
        hideLoading();
    }
}

async function loadCoursePage(page) {
    try {
        var data = await CourseQSortAPI.student.getCourses({
            page: page,
            page_size: pageSize
        });
        totalCourseCount = data.count;
        currentPage = page;
        currentCourses = data.results || [];

        // 更新分页按钮
        var totalPages = Math.ceil(totalCourseCount / pageSize) || 1;
        paginationInfo.textContent = '第 ' + page + ' / ' + totalPages + ' 页 (共 ' + totalCourseCount + ' 门)';
        prevPageBtn.disabled = page <= 1;
        nextPageBtn.disabled = page >= totalPages;

        return data;
    } catch (err) {
        console.error('[App] Load courses error:', err);
        return null;
    }
}

async function refreshAll() {
    showLoading('正在刷新数据...');
    try {
        var scheduleData = await CourseQSortAPI.student.getSchedule();
        selectedCourses = scheduleData.courses || [];
        sessionStorage.setItem('selectedCoursesData', JSON.stringify(selectedCourses));
        await loadCoursePage(currentPage);
        renderAll();
    } catch (err) {
        console.error('[App] Refresh error:', err);
    }
    hideLoading();
}

// ======================== 渲染函数 ========================

function renderAll() {
    renderCourseList(currentCourses);
    renderSelectedCourses();
    renderFreeSlots();
    updateTotalCredits();
}

function renderCourseList(courses) {
    courseListTbody.innerHTML = '';
    courseCountBadge.textContent = '共 ' + totalCourseCount + ' 门';

    if (!courses || courses.length === 0) {
        courseListTbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">暂无课程数据</td></tr>';
        return;
    }

    courses.forEach(function(course) {
        var alreadySelected = selectedCourses.some(function(sc) {
            return sc.course_id === course.course_id;
        });

        var tr = document.createElement('tr');
        tr.className = (course.conflict && !alreadySelected) ? 'conflict-row' : '';

        var timeStr = formatTimeSlots(course.time_slots);
        var remaining = course.remaining_capacity !== undefined ? course.remaining_capacity :
                        (course.capacity - course.enrolled_count);

        var actionHtml = '';
        if (alreadySelected) {
            var isMandatory = selectedCourses.find(function(sc) { return sc.course_id === course.course_id; });
            actionHtml = '<button class="btn btn-sm btn-secondary" disabled>' +
                         (isMandatory && isMandatory.mandatory ? '必修' : '已选') + '</button>';
        } else if (course.conflict) {
            var conflictInfo = getConflictDetails(course.time_slots);
            actionHtml = '<button class="btn btn-sm btn-secondary" disabled>冲突</button>' +
                         ' <span class="badge bg-danger conflict-badge" data-course-id="' + course.course_id +
                         '" data-conflict-info=\'' + JSON.stringify(conflictInfo).replace(/'/g, "&#39;") + '\'>冲突</span>';
        } else if (remaining <= 0) {
            actionHtml = '<button class="btn btn-sm btn-secondary" disabled>已满</button>';
        } else {
            actionHtml = '<button class="btn btn-sm btn-primary select-btn" data-id="' + course.course_id + '">选课</button>';
        }

        tr.innerHTML =
            '<td>' + (course.name || '') + '</td>' +
            '<td>' + (course.credit || 0) + '</td>' +
            '<td>' + (course.teacher || '') + '</td>' +
            '<td>' + timeStr + '</td>' +
            '<td>' + (course.enrolled_count || 0) + '/' + (course.capacity || 0) + '</td>' +
            '<td>' + actionHtml + '</td>';
        courseListTbody.appendChild(tr);

        // 绑定冲突浮窗
        var badge = tr.querySelector('.conflict-badge');
        if (badge) {
            badge.addEventListener('mouseenter', function(e) {
                var info = JSON.parse(this.getAttribute('data-conflict-info'));
                showConflictPopover(e, info);
            });
            badge.addEventListener('mouseleave', hideConflictPopover);
        }

        // 绑定选课按钮
        var selectBtn = tr.querySelector('.select-btn');
        if (selectBtn) {
            selectBtn.addEventListener('click', function() {
                var cid = parseInt(this.getAttribute('data-id'));
                handleSelectCourse(cid);
            });
        }
    });
}

function renderSelectedCourses() {
    selectedContainer.innerHTML = '';
    if (!selectedCourses || selectedCourses.length === 0) {
        selectedContainer.innerHTML = '<p class="text-muted small mb-0">尚未选择任何课程</p>';
        return;
    }

    var ul = document.createElement('ul');
    ul.className = 'list-group list-group-flush';
    selectedCourses.forEach(function(c) {
        var li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center p-1 small';
        var rightPart = '';
        if (c.mandatory) {
            rightPart = '<span class="badge bg-warning text-dark">必修</span>';
        } else {
            rightPart = '<button class="btn btn-outline-danger btn-sm py-0 px-1 drop-btn" data-id="' + c.course_id + '">x</button>';
        }
        li.innerHTML = '<span>' + (c.name || '') + '</span>' +
                       '<span class="badge bg-secondary me-1">' + (c.credit || 0) + '学分</span>' +
                       rightPart;
        ul.appendChild(li);
    });
    selectedContainer.appendChild(ul);

    // 绑定退课事件
    ul.querySelectorAll('.drop-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var cid = parseInt(this.getAttribute('data-id'));
            handleDropCourse(cid);
        });
    });
}

function renderFreeSlots() {
    freeSlotsContainer.innerHTML = '';
    // 计算空闲位图
    var totalBitmap = new Array(55).fill('0');
    selectedCourses.forEach(function(sc) {
        var bm = buildBitmap(sc.time_slots).split('');
        for (var i = 0; i < 55; i++) {
            if (bm[i] === '1') totalBitmap[i] = '1';
        }
    });

    var freeSlots = [];
    for (var i = 0; i < 55; i++) {
        if (totalBitmap[i] === '0') {
            freeSlots.push({ day_of_week: Math.floor(i / 11) + 1, period: (i % 11) + 1 });
        }
    }

    if (freeSlots.length === 0) {
        freeSlotsContainer.innerHTML = '<p class="text-muted small mb-0">暂无私立时段</p>';
        return;
    }

    freeSlots.forEach(function(slot) {
        var btn = document.createElement('button');
        btn.className = 'btn btn-outline-info btn-sm free-slot-btn';
        btn.textContent = '周' + ['一','二','三','四','五'][slot.day_of_week - 1] + ' 第' + slot.period + '节';
        btn.addEventListener('click', function() {
            filterByFreeSlot(slot.day_of_week, slot.period);
        });
        freeSlotsContainer.appendChild(btn);
    });

    var showAllBtn = document.createElement('button');
    showAllBtn.className = 'btn btn-outline-secondary btn-sm w-100 mt-2';
    showAllBtn.textContent = '显示全部课程';
    showAllBtn.addEventListener('click', function() {
        loadCoursePage(1).then(function() { renderCourseList(currentCourses); });
    });
    freeSlotsContainer.appendChild(showAllBtn);
}

function updateTotalCredits() {
    var total = selectedCourses.reduce(function(sum, sc) { return sum + (sc.credit || 0); }, 0);
    totalCreditsSpan.textContent = total + ' / ' + maxCredits + ' 学分';
}

// ======================== 交互操作 ========================

async function handleSelectCourse(courseId) {
    if (isDataLoading) return;

    // 学分检查
    var currentCredits = selectedCourses.reduce(function(sum, sc) { return sum + (sc.credit || 0); }, 0);
    var course = null;
    for (var i = 0; i < currentCourses.length; i++) {
        if (currentCourses[i].course_id === courseId) {
            course = currentCourses[i];
            break;
        }
    }
    if (!course) return;
    if (currentCredits + course.credit > maxCredits) {
        alert('选课后总学分将超过上限 ' + maxCredits + ' 学分');
        return;
    }

    showLoading('正在选课...');
    try {
        var result = await CourseQSortAPI.student.selectCourse(courseId);
        alert(result.message || '选课成功');
        await refreshAll();
    } catch (err) {
        if (err.data && err.data.message) {
            alert(err.data.message);
        } else {
            alert('选课失败，请重试');
        }
    }
    hideLoading();
}

async function handleDropCourse(courseId) {
    if (isDataLoading) return;

    if (!confirm('确定退选该课程吗?')) return;

    showLoading('正在退课...');
    try {
        var result = await CourseQSortAPI.student.dropCourse(courseId);
        alert(result.message || '退课成功');
        await refreshAll();
    } catch (err) {
        if (err.data && err.data.message) {
            alert(err.data.message);
        } else {
            alert('退课失败，请重试');
        }
    }
    hideLoading();
}

async function filterByFreeSlot(day, period) {
    showLoading('正在加载推荐课程...');
    try {
        var data = await CourseQSortAPI.student.getFreeSlotRecommendations(day, period);
        var courses = data.courses || [];
        // 转换为课程列表格式用于渲染
        var displayCourses = courses.map(function(c) {
            var conflict = false;
            var courseBm = buildBitmap(c.time_slots);
            for (var i = 0; i < selectedCourses.length; i++) {
                if (hasBitmapConflict(courseBm, buildBitmap(selectedCourses[i].time_slots))) {
                    conflict = true; break;
                }
            }
            return {
                course_id: c.course_id,
                name: c.name,
                credit: c.credit,
                teacher: c.teacher,
                capacity: c.remaining_capacity + 50,
                enrolled_count: 50,
                remaining_capacity: c.remaining_capacity,
                time_slots: c.time_slots,
                conflict: conflict,
                conflict_with: []
            };
        });
        currentCourses = displayCourses;
        totalCourseCount = displayCourses.length;
        paginationInfo.textContent = '筛选结果 (共 ' + totalCourseCount + ' 门)';
        prevPageBtn.disabled = true;
        nextPageBtn.disabled = true;
        renderCourseList(displayCourses);
    } catch (err) {
        console.error('[App] Filter error:', err);
    }
    hideLoading();
}

// ======================== 冲突浮窗 ========================

function showConflictPopover(e, details) {
    var popover = document.getElementById('conflict-popover');
    var html = '<div class="conflict-popover-content"><strong>冲突课程：</strong><ul>';
    details.forEach(function(d) {
        var slotsStr = d.conflict_slots.map(function(s) {
            var week = ['一','二','三','四','五'][s.day_of_week - 1];
            return '周' + week + '第' + s.period + '节';
        }).join(', ');
        html += '<li>' + d.course_name + '（' + d.teacher + '）<br><small>' + slotsStr + '</small></li>';
    });
    html += '</ul></div>';
    popover.innerHTML = html;
    popover.style.display = 'block';
    popover.style.left = (e.clientX + 10) + 'px';
    popover.style.top = (e.clientY + 10) + 'px';
}

function hideConflictPopover() {
    document.getElementById('conflict-popover').style.display = 'none';
}

// ======================== 分页事件 ========================

prevPageBtn.addEventListener('click', function() {
    if (currentPage > 1) {
        loadCoursePage(currentPage - 1).then(function() {
            renderCourseList(currentCourses);
        });
    }
});

nextPageBtn.addEventListener('click', function() {
    loadCoursePage(currentPage + 1).then(function() {
        renderCourseList(currentCourses);
    });
});

// ======================== 登出 & 打印 ========================

document.getElementById('logout-btn').addEventListener('click', function() {
    if (CourseQSortAPI.getLoginMode() === 'jwt') {
        CourseQSortAPI.auth.logout();
    }
    CourseQSortAPI.token.clear();
    sessionStorage.clear();
    window.location.href = 'login.html';
});

document.getElementById('print-btn').addEventListener('click', function() {
    if (selectedCourses.length === 0) {
        alert('暂我选择课程，无法查看课表');
        return;
    }
    sessionStorage.setItem('selectedCoursesData', JSON.stringify(selectedCourses));
    window.location.href = 'schedule.html';
});

// ======================== 初始化 ========================

initApp();
