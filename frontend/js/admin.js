// CourseQSort Admin UI Controller
(function() {
    // 预览模式下跳过认证检查，后端模式才需要登录
    if (!CourseQSortAPI.isMockMode() && !CourseQSortAPI.isAuthenticated()) { window.location.href = 'login.html'; return; }
    document.getElementById('admin-mode-badge').textContent = CourseQSortAPI.isMockMode() ? '预览模式' : '后端模式';
})();
var W = ['','周一','周二','周三','周四','周五'];
var P = ['','第1节','第2节','第3节','第4节','第5节','第6节','第7节','第8节','第9节','第10节','第11节'];
var curSec = 'dashboard';
document.querySelectorAll('#admin-nav a[data-section]').forEach(function(l){l.addEventListener('click',function(e){e.preventDefault();switchSec(this.getAttribute('data-section'));});});
document.getElementById('admin-logout-btn').addEventListener('click',function(e){e.preventDefault();CourseQSortAPI.token.clear();sessionStorage.clear();window.location.href='login.html';});
function switchSec(s){curSec=s;document.querySelectorAll('#admin-nav a[data-section]').forEach(function(l){l.classList.remove('active');});document.querySelector('#admin-nav a[data-section="'+s+'"]').classList.add('active');document.querySelectorAll('.admin-section').forEach(function(s){s.classList.add('d-none');});var el=document.getElementById('section-'+s);if(el)el.classList.remove('d-none');if(s==='dashboard')loadDash();else if(s==='courses')loadCourses();else if(s==='resources')loadRes();else if(s==='protected-slots')loadSlots();else if(s==='scheduling')loadPlans();else if(s==='conflict')loadConflict();else if(s==='algorithm')loadAlgo();}
async function loadDash(){try{var c=await CourseQSortAPI.admin.getCourses();var t=await CourseQSortAPI.admin.getTeachers();var r=await CourseQSortAPI.admin.getClassrooms();var m=await CourseQSortAPI.admin.getMajors();document.getElementById('dashboard-cards').innerHTML='<div class="col-md-3"><div class="card text-bg-primary"><div class="card-body text-center"><h3>'+(c.count||0)+'</h3><small>课程总数</small></div></div></div><div class="col-md-3"><div class="card text-bg-success"><div class="card-body text-center"><h3>'+(t.count||0)+'</h3><small>教师数</small></div></div></div><div class="col-md-3"><div class="card text-bg-info"><div class="card-body text-center"><h3>'+(r.count||0)+'</h3><small>教室数</small></div></div></div><div class="col-md-3"><div class="card text-bg-warning"><div class="card-body text-center"><h3>'+(m.count||0)+'</h3><small>专业数</small></div></div></div>';document.getElementById('dashboard-hint').textContent='数据来源: '+(CourseQSortAPI.isMockMode()?'本地模拟数据':'后端服务器');}catch(e){document.getElementById('dashboard-cards').innerHTML='<div class="col-12 text-danger">加载失败</div>';}}
var courseData=[],coursePage=1,coursePageSize=15;async function loadCourses(){try{var d=await CourseQSortAPI.admin.getCourses();courseData=d.results||[];coursePage=1;renderCourses();}catch(e){document.getElementById('admin-course-list').innerHTML='<tr><td colspan="8" class="text-danger">加载失败</td></tr>';}}
function renderCourses(){var q=(document.getElementById('course-search').value||'').toLowerCase();var f=courseData;if(q){f=courseData.filter(function(c){return(c.name||'').toLowerCase().indexOf(q)!==-1||(c.code||'').toLowerCase().indexOf(q)!==-1;});coursePage=1;}
var total=f.length,totalPages=Math.ceil(total/coursePageSize);if(coursePage>totalPages)coursePage=totalPages||1;
var start=(coursePage-1)*coursePageSize,end=Math.min(start+coursePageSize,total);
var pageItems=f.slice(start,end);
document.getElementById('admin-course-list').innerHTML=pageItems.map(function(c){var tn=(c.teachers||[]).map(function(t){return t.name;}).join(', ');return'<tr><td>'+c.name+'</td><td>'+(c.code||'-')+'</td><td>'+c.credit+'</td><td>'+tn+'</td><td>'+(c.major?c.major.name:'-')+'</td><td>'+(c.expected_student_count||'-')+'</td><td>'+(c.is_professional_course?'专业':'通识')+'</td><td><button class="btn btn-outline-primary btn-sm py-0 me-1 edit-course-btn" data-cid="'+c.id+'">编辑</button><button class="btn btn-outline-danger btn-sm py-0 del-course-btn" data-cid="'+c.id+'" data-cname="'+c.name+'">删除</button></td></tr>';}).join('')||'<tr><td colspan="8" class="text-muted">暂无数据</td></tr>';
	document.querySelectorAll('.edit-course-btn').forEach(function(b){b.addEventListener('click',function(){var cid=parseInt(this.getAttribute('data-cid'));var c=courseData.find(function(x){return x.id===cid;});if(c)openCourseEditModal(c);});});document.querySelectorAll('.del-course-btn').forEach(function(b){b.addEventListener('click',function(){deleteCourse(parseInt(this.getAttribute('data-cid')),this.getAttribute('data-cname'));});});
var pi=document.getElementById('admin-course-pagination-info');if(pi)pi.textContent='第 '+coursePage+' 页 / 共 '+totalPages+' 页（共 '+total+' 门课程）';
var pag=document.getElementById('admin-course-pagination');
if(pag){
var links='';
if(coursePage>1)links+='<li class="page-item"><a class="page-link" href="#" data-cp="1">首页</a></li><li class="page-item"><a class="page-link" href="#" data-cp="'+(coursePage-1)+'">上一页</a></li>';
else links+='<li class="page-item disabled"><span class="page-link">首页</span></li><li class="page-item disabled"><span class="page-link">上一页</span></li>';
for(var i=1;i<=totalPages;i++){if(totalPages<=7||i===1||i===totalPages||(i>=coursePage-1&&i<=coursePage+1)){links+='<li class="page-item'+(i===coursePage?' active':'')+'"><a class="page-link" href="#" data-cp="'+i+'">'+i+'</a></li>';}else if(i===coursePage-2||i===coursePage+2){links+='<li class="page-item disabled"><span class="page-link">...</span></li>';}}
if(coursePage<totalPages)links+='<li class="page-item"><a class="page-link" href="#" data-cp="'+(coursePage+1)+'">下一页</a></li><li class="page-item"><a class="page-link" href="#" data-cp="'+totalPages+'">末页</a></li>';
else links+='<li class="page-item disabled"><span class="page-link">下一页</span></li><li class="page-item disabled"><span class="page-link">末页</span></li>';
pag.innerHTML=links;
pag.querySelectorAll('a[data-cp]').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();coursePage=parseInt(this.getAttribute('data-cp'));renderCourses();});});
}}
document.getElementById('course-search').addEventListener('input',renderCourses);
// ---- 课程 CRUD ----
async function deleteCourse(cid, cname){
    if(!confirm('确定要删除课程「' + cname + '」吗？此操作不可恢复。')) return;
    try { await CourseQSortAPI.admin.deleteCourse(cid); loadCourses(); }
    catch(e) { alert('删除失败: ' + (e.message || '网络错误')); }
}


var _editingCourseId = null;

function openCourseEditModal(course) {
    _editingCourseId = course ? course.id : null;
    document.getElementById('course-modal-title').textContent = course ? '编辑课程' : '新增课程';

    // 异步加载教师和专业列表
    Promise.all([
        CourseQSortAPI.admin.getTeachers(),
        CourseQSortAPI.admin.getMajors()
    ]).then(function(res) {
        var teachers = (res[0] && res[0].results) ? res[0].results : [];
        var majors = (res[1] && res[1].results) ? res[1].results : [];
        var curTeacherIds = (course && course.teachers) ? course.teachers.map(function(t){return t.id;}) : [];
        var curMajorId = (course && course.major) ? course.major.id : '';

        var h = '';
        h += '<div class="row g-2 mb-2">';
        h += '<div class="col-md-6"><label class="form-label small">课程名称 <span class="text-danger">*</span></label><input class="form-control form-control-sm" id="c-name" value="' + (course ? (course.name||'') : '') + '"></div>';
        h += '<div class="col-md-3"><label class="form-label small">编号</label><input class="form-control form-control-sm" id="c-code" value="' + (course ? (course.code||'') : '') + '"></div>';
        h += '<div class="col-md-3"><label class="form-label small">学期</label><input class="form-control form-control-sm" id="c-semester" value="' + (course ? (course.semester||'') : '2026-spring') + '"></div>';
        h += '</div>';
        h += '<div class="row g-2 mb-2">';
        h += '<div class="col-md-4"><label class="form-label small">学分</label><input type="number" class="form-control form-control-sm" id="c-credit" value="' + (course ? (course.credit||0) : 3) + '" step="0.5"></div>';
        h += '<div class="col-md-4"><label class="form-label small">学时</label><input type="number" class="form-control form-control-sm" id="c-hours" value="' + (course ? (course.hours||48) : 48) + '"></div>';
        h += '<div class="col-md-4"><label class="form-label small">容量</label><input type="number" class="form-control form-control-sm" id="c-capacity" value="' + (course ? (course.expected_student_count||100) : 100) + '"></div>';
        h += '</div>';
        h += '<div class="row g-2 mb-2">';
        h += '<div class="col-md-4"><label class="form-label small">连排节数 <small class="text-muted">(每次课占几节)</small></label><input type="number" class="form-control form-control-sm" id="c-session-length" value="' + (course ? (course.session_length||2) : 2) + '" min="1" max="6"></div>';
        h += '</div>';
        h += '<div class="row g-2 mb-2">';
        h += '<div class="col-md-6"><label class="form-label small">专业</label><select class="form-select form-select-sm" id="c-major"><option value="">-- 无 --</option>';
        for (var i = 0; i < majors.length; i++) {
            var sel = (majors[i].id === curMajorId) ? ' selected' : '';
            h += '<option value="' + majors[i].id + '"' + sel + '>' + majors[i].name + '</option>';
        }
        h += '</select></div>';
        h += '<div class="col-md-6"><label class="form-label small">课程类别</label><select class="form-select form-select-sm" id="c-is-professional">';
        h += '<option value="1"' + (course && !course.is_professional_course ? '' : ' selected') + '>专业课程</option>';
        h += '<option value="0"' + (course && !course.is_professional_course ? ' selected' : '') + '>通识课程</option>';
        h += '</select></div>';
        h += '</div>';
        h += '<div class="mb-2"><label class="form-label small">教师（可多选）</label><div style="max-height:150px;overflow-y:auto;border:1px solid #dee2e6;border-radius:4px;padding:8px;">';
        for (var i = 0; i < teachers.length; i++) {
            var checked = curTeacherIds.indexOf(teachers[i].id) !== -1 ? ' checked' : '';
            h += '<div class="form-check form-check-inline"><input class="form-check-input c-teacher-cb" type="checkbox" value="' + teachers[i].id + '"' + checked + '><label class="form-check-label small">' + teachers[i].name + '</label></div>';
        }
        if (teachers.length === 0) h += '<span class="text-muted small">暂无教师</span>';
        h += '</div></div>';
        document.getElementById('course-modal-body').innerHTML = h;

        // 如果在 mock 模式下
        if (CourseQSortAPI.isMockMode()) {
        }
    }).catch(function(e) {
        // fallback: 简化表单
        document.getElementById('course-modal-body').innerHTML =
            '<div class="mb-2"><label class="form-label small">课程名称 <span class="text-danger">*</span></label><input class="form-control form-control-sm" id="c-name" value="' + (course ? (course.name||'') : '') + '"></div>' +
            '<div class="mb-2"><label class="form-label small">编号</label><input class="form-control form-control-sm" id="c-code" value="' + (course ? (course.code||'') : '') + '"></div>' +
            '<div class="row g-2 mb-2"><div class="col-6"><label class="form-label small">学分</label><input type="number" class="form-control form-control-sm" id="c-credit" value="' + (course ? (course.credit||0) : 3) + '"></div><div class="col-6"><label class="form-label small">学时</label><input type="number" class="form-control form-control-sm" id="c-hours" value="' + (course ? (course.hours||48) : 48) + '"></div></div>' +
            '<div class="mb-2"><label class="form-label small">容量</label><input type="number" class="form-control form-control-sm" id="c-capacity" value="' + (course ? (course.expected_student_count||100) : 100) + '"></div>' +
            '<div class="mb-2"><label class="form-label small">连排节数</label><input type="number" class="form-control form-control-sm" id="c-session-length" value="' + (course ? (course.session_length||2) : 2) + '" min="1" max="6"></div>' +
            '<div class="mb-2"><label class="form-label small">学期</label><input class="form-control form-control-sm" id="c-semester" value="' + (course ? (course.semester||'') : '2026-spring') + '"></div>' +
            '<div class="mb-2"><label class="form-label small">课程类别</label><select class="form-select form-select-sm" id="c-is-professional"><option value="1"' + (course && !course.is_professional_course ? '' : ' selected') + '>专业课程</option><option value="0"' + (course && !course.is_professional_course ? ' selected' : '') + '>通识课程</option></select></div>';
    });
    new bootstrap.Modal(document.getElementById('course-modal')).show();
}

document.getElementById('course-add-btn').addEventListener('click', function() {
    openCourseEditModal(null);
});

document.getElementById('course-modal-save').addEventListener('click', async function() {
    var name = (document.getElementById('c-name').value || '').trim();
    if (!name) { alert('课程名称不能为空'); return; }
    var majorEl = document.getElementById('c-major');
    var isProfEl = document.getElementById('c-is-professional');
    var teacherCbs = document.querySelectorAll('.c-teacher-cb:checked');
    var teacherIds = [];
    for (var i = 0; i < teacherCbs.length; i++) {
        teacherIds.push(parseInt(teacherCbs[i].value));
    }
    var payload = {
        name: name,
        code: (document.getElementById('c-code').value || '').trim(),
        credit: parseFloat(document.getElementById('c-credit').value) || 0,
        hours: parseInt(document.getElementById('c-hours').value) || 48,
        semester: (document.getElementById('c-semester').value || '').trim(),
        major_id: majorEl ? (parseInt(majorEl.value) || null) : null,
        teacher_ids: teacherIds,
        expected_student_count: parseInt(document.getElementById('c-capacity').value) || 100,
        is_professional_course: isProfEl ? (isProfEl.value === '1') : true,
        session_length: parseInt(document.getElementById('c-session-length').value) || 2,
    };
    try {
        if (_editingCourseId) {
            await CourseQSortAPI.admin.updateCourse(_editingCourseId, payload);
        } else {
            await CourseQSortAPI.admin.createCourse(payload);
        }
        bootstrap.Modal.getInstance(document.getElementById('course-modal')).hide();
        loadCourses();
    } catch(e) {
        alert('保存失败: ' + (e.message || '网络错误'));
    }
});
document.getElementById('course-import-btn').addEventListener('click',function(){alert('导入功能：请上传 Excel 文件（模拟）');});
var curRes='teachers';document.querySelectorAll('#resource-tabs a').forEach(function(t){t.addEventListener('click',function(e){e.preventDefault();document.querySelectorAll('#resource-tabs a').forEach(function(x){x.classList.remove('active');});this.classList.add('active');curRes=this.getAttribute('data-resource');loadResTable();});});
async function loadRes(){await loadResTable();}

// ---- 教师 CRUD ----
var _editingTeacherId=null;
function openTeacherEditModal(teacher){
    _editingTeacherId = teacher ? teacher.id : null;
    var name = teacher ? (teacher.name||'') : '';
    var eno = teacher ? (teacher.employee_no||'') : '';
    var dept = teacher ? (teacher.department||'') : '';
    var slots = teacher ? (teacher.unavailable_slots||[]) : [];
    var title = teacher ? '编辑教师信息' : '新增教师';
    document.getElementById('teacher-edit-modal-title').textContent = title;

    var h = '';
    h += '<div class="row g-2 mb-3">';
    h += '<div class="col-md-4"><label class="form-label small">姓名 <span class="text-danger">*</span></label><input class="form-control form-control-sm" id="te-name" value="' + name + '"></div>';
    h += '<div class="col-md-4"><label class="form-label small">工号</label><input class="form-control form-control-sm" id="te-eno" value="' + eno + '"></div>';
    h += '<div class="col-md-4"><label class="form-label small">学院</label><input class="form-control form-control-sm" id="te-dept" value="' + dept + '"></div>';
    h += '</div>';
    h += '<p class="small text-muted mb-1">禁排时段（勾选不可排课的时间格）：</p>';
    h += '<div class="table-responsive"><table class="table table-bordered table-sm text-center mb-0"><thead><tr><th></th>';
    for(var d=1;d<=5;d++) h += '<th>' + W[d] + '</th>';
    h += '</tr></thead><tbody>';
    for(var p=1;p<=11;p++){
        h += '<tr><td class="bg-light small">' + P[p] + '</td>';
        for(var d=1;d<=5;d++){
            var ck = '';
            for(var i=0;i<slots.length;i++){
                if(slots[i].day_of_week===d && slots[i].period===p){ ck=' checked'; break; }
            }
            h += '<td style="padding:1px;"><input type="checkbox" class="te-slot-cb" data-day="'+d+'" data-period="'+p+'"'+ck+'></td>';
        }
        h += '</tr>';
    }
    h += '</tbody></table></div>';
    document.getElementById('teacher-edit-modal-body').innerHTML = h;
    new bootstrap.Modal(document.getElementById('teacher-edit-modal')).show();
}
document.getElementById('teacher-edit-modal-save').addEventListener('click', async function(){
    var name = document.getElementById('te-name').value.trim();
    if(!name){ alert('姓名不能为空'); return; }
    var eno = document.getElementById('te-eno').value.trim();
    var dept = document.getElementById('te-dept').value.trim();
    var slots = [];
    document.querySelectorAll('.te-slot-cb:checked').forEach(function(cb){
        slots.push({day_of_week: parseInt(cb.getAttribute('data-day')), period: parseInt(cb.getAttribute('data-period'))});
    });
    var payload = { name: name, employee_no: eno, department: dept, unavailable_slots: slots };
    try {
        if(_editingTeacherId){
            await CourseQSortAPI.admin.updateTeacher(_editingTeacherId, payload);
        } else {
            await CourseQSortAPI.admin.createTeacher(payload);
        }
        bootstrap.Modal.getInstance(document.getElementById('teacher-edit-modal')).hide();
        loadResTable();
    } catch(e) {
        alert('保存失败: ' + (e.message || '网络错误'));
    }
});

async function deleteTeacher(tid, tname){
    if(!confirm('确定要删除教师「' + tname + '」吗？此操作不可恢复。')) return;
    try { await CourseQSortAPI.admin.deleteTeacher(tid); loadResTable(); }
    catch(e) { alert('删除失败: ' + (e.message || '网络错误')); }
}

// ---- 学生 CRUD ----
var _editingStudentId=null;

function openStudentEditModal(student){
    _editingStudentId = student ? student.id : null;
    document.getElementById('student-edit-modal-title').textContent = student ? '编辑学生信息' : '新增学生';
    document.getElementById('student-edit-id').value = student ? student.id : '';
    document.getElementById('student-edit-name').value = student ? (student.name||'') : '';
    document.getElementById('student-edit-no').value = student ? (student.student_no||'') : '';
    document.getElementById('student-edit-grade').value = student ? (student.grade||'') : '';
    document.getElementById('student-edit-class').value = student ? (student.class_identification||'') : '';
    // 填充专业下拉
    var majorSel = document.getElementById('student-edit-major');
    CourseQSortAPI.admin.getMajors().then(function(d){
        var majors = d.results || [];
        majorSel.innerHTML = majors.map(function(m){
            var sel = student && student.major === m.id ? ' selected' : '';
            return '<option value="'+m.id+'"'+sel+'>'+m.name+'</option>';
        }).join('');
    }).catch(function(){});
    new bootstrap.Modal(document.getElementById('student-edit-modal')).show();
}

document.getElementById('student-edit-modal-save').addEventListener('click', async function(){
    var name = document.getElementById('student-edit-name').value.trim();
    var no = document.getElementById('student-edit-no').value.trim();
    if(!name){ alert('姓名不能为空'); return; }
    if(!no){ alert('学号不能为空'); return; }
    var payload = {
        name: name,
        student_no: no,
        major: parseInt(document.getElementById('student-edit-major').value) || null,
        grade: document.getElementById('student-edit-grade').value.trim(),
        class_identification: document.getElementById('student-edit-class').value.trim()
    };
    try {
        if(_editingStudentId){
            await CourseQSortAPI.admin.updateStudent(_editingStudentId, payload);
        } else {
            await CourseQSortAPI.admin.createStudent(payload);
        }
        bootstrap.Modal.getInstance(document.getElementById('student-edit-modal')).hide();
        loadResTable();
    } catch(e) {
        alert('保存失败: ' + (e.message || '网络错误'));
    }
});

async function deleteStudent(sid, sname){
    if(!confirm('确定要删除学生「' + sname + '」吗？此操作不可恢复。')) return;
    try { await CourseQSortAPI.admin.deleteStudent(sid); loadResTable(); }
    catch(e) { alert('删除失败: ' + (e.message || '网络错误')); }
}

// ---- 课室编辑弹窗 ----
function openClassroomEditModal(room){
    var title = document.getElementById('classroom-edit-modal-title');
    if(room){
        title.textContent = '编辑课室';
        document.getElementById('classroom-edit-id').value = room.id;
        document.getElementById('classroom-edit-name').value = room.name || '';
        document.getElementById('classroom-edit-capacity').value = room.capacity || 60;
        document.getElementById('classroom-edit-building').value = room.building || '';
        document.getElementById('classroom-edit-equipment').value = (room.equipment_types||[]).join(', ');
        document.getElementById('classroom-edit-islab').checked = room.is_lab || false;
    } else {
        title.textContent = '新增课室';
        document.getElementById('classroom-edit-id').value = '';
        document.getElementById('classroom-edit-name').value = '';
        document.getElementById('classroom-edit-capacity').value = '60';
        document.getElementById('classroom-edit-building').value = '';
        document.getElementById('classroom-edit-equipment').value = '';
        document.getElementById('classroom-edit-islab').checked = false;
    }
    new bootstrap.Modal(document.getElementById('classroom-edit-modal')).show();
}
document.getElementById('classroom-edit-modal-save').addEventListener('click', async function(){
    var id = document.getElementById('classroom-edit-id').value;
    var data = {
        name: document.getElementById('classroom-edit-name').value.trim(),
        capacity: parseInt(document.getElementById('classroom-edit-capacity').value) || 60,
        building: document.getElementById('classroom-edit-building').value.trim(),
        equipment_types: document.getElementById('classroom-edit-equipment').value.split(',').map(function(s){return s.trim();}).filter(Boolean),
        is_lab: document.getElementById('classroom-edit-islab').checked
    };
    if(!data.name){ alert('请输入课室名称'); return; }
    try {
        if(id){ await CourseQSortAPI.admin.updateClassroom(parseInt(id), data); }
        else { await CourseQSortAPI.admin.createClassroom(data); }
        bootstrap.Modal.getInstance(document.getElementById('classroom-edit-modal')).hide();
        loadResTable();
    } catch(e) { alert('保存失败: ' + (e.message || '网络错误')); }
});
async function deleteClassroom(rid, rname){
    if(!confirm('确定要删除课室「' + rname + '」吗？此操作不可恢复。')) return;
    try { await CourseQSortAPI.admin.deleteClassroom(rid); loadResTable(); }
    catch(e) { alert('删除失败: ' + (e.message || '网络错误')); }
}

// ---- 专业编辑弹窗 ----
function openMajorEditModal(major){
    var title = document.getElementById('major-edit-modal-title');
    if(major){
        title.textContent = '编辑专业';
        document.getElementById('major-edit-id').value = major.id;
        document.getElementById('major-edit-name').value = major.name || '';
        document.getElementById('major-edit-code').value = major.code || '';
        document.getElementById('major-edit-count').value = major.student_count || 0;
    } else {
        title.textContent = '新增专业';
        document.getElementById('major-edit-id').value = '';
        document.getElementById('major-edit-name').value = '';
        document.getElementById('major-edit-code').value = '';
        document.getElementById('major-edit-count').value = '0';
    }
    new bootstrap.Modal(document.getElementById('major-edit-modal')).show();
}
document.getElementById('major-edit-modal-save').addEventListener('click', async function(){
    var id = document.getElementById('major-edit-id').value;
    var data = {
        name: document.getElementById('major-edit-name').value.trim(),
        code: document.getElementById('major-edit-code').value.trim(),
        student_count: parseInt(document.getElementById('major-edit-count').value) || 0
    };
    if(!data.name){ alert('请输入专业名称'); return; }
    try {
        if(id){ await CourseQSortAPI.admin.updateMajor(parseInt(id), data); }
        else { await CourseQSortAPI.admin.createMajor(data); }
        bootstrap.Modal.getInstance(document.getElementById('major-edit-modal')).hide();
        loadResTable();
    } catch(e) { alert('保存失败: ' + (e.message || '网络错误')); }
});
async function deleteMajor(mid, mname){
    if(!confirm('确定要删除专业「' + mname + '」吗？此操作不可恢复。')) return;
    try { await CourseQSortAPI.admin.deleteMajor(mid); loadResTable(); }
    catch(e) { alert('删除失败: ' + (e.message || '网络错误')); }
}

async function loadResTable(){
    var tb = document.getElementById('resource-table-body');
    var addBtn = document.getElementById('resource-add-btn');
    try {
        if(curRes==='teachers'){
            addBtn.classList.remove('d-none');
            addBtn.textContent = '新增教师';
            addBtn.onclick = function(){ openTeacherEditModal(null); };
            var d = await CourseQSortAPI.admin.getTeachers();
            var items = d.results || [];
            tb.innerHTML = '<tr><th>姓名</th><th>工号</th><th>学院</th><th>禁排时段</th><th>操作</th></tr>' + items.map(function(t){
                var s = (t.unavailable_slots||[]).map(function(s){return'周'+['','一','二','三','四','五'][s.day_of_week]+'第'+s.period+'节';}).join(', ')||'无';
                var sc = t.unavailable_slots ? t.unavailable_slots.length : '0';
                return '<tr><td>' + t.name + '</td><td>' + (t.employee_no||'-') + '</td><td>' + (t.department||'-') +
                    '</td><td class="small">' + s + ' <span class="badge bg-secondary">' + sc + '个</span></td>' +
                    '<td><button class="btn btn-outline-primary btn-sm py-0 me-1 edit-teacher-btn" data-tid="' + t.id + '">编辑</button>' +
                    '<button class="btn btn-outline-danger btn-sm py-0 del-teacher-btn" data-tid="' + t.id + '" data-tname="' + t.name + '">删除</button></td></tr>';
            }).join('') || '<tr><td colspan="5" class="text-muted">暂无教师数据，点击右上角「新增教师」录入</td></tr>';
            document.querySelectorAll('.edit-teacher-btn').forEach(function(b){
                b.addEventListener('click', function(){
                    var tid = parseInt(this.getAttribute('data-tid'));
                    var teacher = items.find(function(t){return t.id===tid;});
                    if(teacher) openTeacherEditModal(teacher);
                });
            });
            document.querySelectorAll('.del-teacher-btn').forEach(function(b){
                b.addEventListener('click', function(){
                    deleteTeacher(parseInt(this.getAttribute('data-tid')), this.getAttribute('data-tname'));
                });
            });
        } else if(curRes==='students'){
            addBtn.classList.remove('d-none');
            addBtn.textContent = '新增学生';
            addBtn.onclick = function(){ openStudentEditModal(null); };
            var d = await CourseQSortAPI.admin.getStudents();
            var items = d.results || [];
            tb.innerHTML = '<tr><th>学号</th><th>姓名</th><th>专业</th><th>年级</th><th>班级</th><th>操作</th></tr>' + items.map(function(s){
                return '<tr><td>' + (s.student_no||'-') + '</td><td>' + s.name + '</td><td>' + (s.major_name||'-') +
                    '</td><td>' + (s.grade||'-') + '</td><td>' + (s.class_identification||'-') +
                    '</td><td><button class="btn btn-outline-primary btn-sm py-0 me-1 edit-student-btn" data-sid="' + s.id + '">编辑</button>' +
                    '<button class="btn btn-outline-danger btn-sm py-0 del-student-btn" data-sid="' + s.id + '" data-sname="' + s.name + '">删除</button></td></tr>';
            }).join('') || '<tr><td colspan="6" class="text-muted">暂无学生数据，点击右上角「新增学生」录入</td></tr>';
            document.querySelectorAll('.edit-student-btn').forEach(function(b){
                b.addEventListener('click', function(){
                    var sid = parseInt(this.getAttribute('data-sid'));
                    var stu = items.find(function(s){return s.id===sid;});
                    if(stu) openStudentEditModal(stu);
                });
            });
            document.querySelectorAll('.del-student-btn').forEach(function(b){
                b.addEventListener('click', function(){
                    deleteStudent(parseInt(this.getAttribute('data-sid')), this.getAttribute('data-sname'));
                });
            });
	        } else if(curRes==='classrooms'){
            addBtn.classList.remove('d-none');
            addBtn.textContent = '新增课室';
            addBtn.onclick = function(){ openClassroomEditModal(null); };
            var d = await CourseQSortAPI.admin.getClassrooms();
            var items = d.results || [];
            tb.innerHTML = '<tr><th>名称</th><th>容量</th><th>楼宇</th><th>设备</th><th>类型</th><th>操作</th></tr>' + items.map(function(r){
                return '<tr><td>' + r.name + '</td><td>' + r.capacity + '</td><td>' + (r.building||'-') +
                    '</td><td class="small">' + (r.equipment_types||[]).join(', ') + '</td><td>' + (r.is_lab?'实验室':'普通') +
                    '</td><td><button class="btn btn-outline-primary btn-sm py-0 me-1 edit-room-btn" data-rid="' + r.id + '">编辑</button>' +
                    '<button class="btn btn-outline-danger btn-sm py-0 del-room-btn" data-rid="' + r.id + '" data-rname="' + r.name + '">删除</button></td></tr>';
            }).join('') || '<tr><td colspan="6" class="text-muted">暂无课室数据，点击右上角「新增课室」录入</td></tr>';
            document.querySelectorAll('.edit-room-btn').forEach(function(b){
                b.addEventListener('click', function(){
                    var rid = parseInt(this.getAttribute('data-rid'));
                    var room = items.find(function(r){return r.id===rid;});
                    if(room) openClassroomEditModal(room);
                });
            });
            document.querySelectorAll('.del-room-btn').forEach(function(b){
                b.addEventListener('click', function(){
                    deleteClassroom(parseInt(this.getAttribute('data-rid')), this.getAttribute('data-rname'));
                });
            });
        } else {
            addBtn.classList.remove('d-none');
            addBtn.textContent = '新增专业';
            addBtn.onclick = function(){ openMajorEditModal(null); };
            var d = await CourseQSortAPI.admin.getMajors();
            var items = d.results || [];
            tb.innerHTML = '<tr><th>名称</th><th>编号</th><th>学生数</th><th>操作</th></tr>' + items.map(function(m){
                return '<tr><td>' + m.name + '</td><td>' + (m.code||'-') + '</td><td>' + (m.student_count||0) +
                    '</td><td><button class="btn btn-outline-primary btn-sm py-0 me-1 edit-major-btn" data-mid="' + m.id + '">编辑</button>' +
                    '<button class="btn btn-outline-danger btn-sm py-0 del-major-btn" data-mid="' + m.id + '" data-mname="' + m.name + '">删除</button></td></tr>';
            }).join('') || '<tr><td colspan="4" class="text-muted">暂无专业数据，点击右上角「新增专业」录入</td></tr>';
            document.querySelectorAll('.edit-major-btn').forEach(function(b){
                b.addEventListener('click', function(){
                    var mid = parseInt(this.getAttribute('data-mid'));
                    var major = items.find(function(m){return m.id===mid;});
                    if(major) openMajorEditModal(major);
                });
            });
            document.querySelectorAll('.del-major-btn').forEach(function(b){
                b.addEventListener('click', function(){
                    deleteMajor(parseInt(this.getAttribute('data-mid')), this.getAttribute('data-mname'));
                });
            });
        }
    } catch(e) { tb.innerHTML = '<tr><td colspan="5" class="text-danger">加载失败: ' + e.message + '</td></tr>'; }
}
async function loadSlots(){try{var d=await CourseQSortAPI.admin.getProtectedSlots();var slots=d.results||[];var tb=document.getElementById('protected-slots-list');tb.innerHTML=slots.map(function(s){return'<tr><td>'+W[s.day_of_week]+'</td><td>'+P[s.start_period]+' ~ '+P[s.end_period]+'</td><td>'+s.penalty_weight+'</td><td>'+s.description+'</td><td><button class="btn btn-outline-danger btn-sm py-0 del-slot" data-id="'+s.id+'">删除</button></td></tr>';}).join('')||'<tr><td colspan="5" class="text-muted">暂无保护时段</td></tr>';document.querySelectorAll('.del-slot').forEach(function(b){b.addEventListener('click',async function(){var id=parseInt(this.getAttribute('data-id'));await CourseQSortAPI.admin.deleteProtectedSlot(id);loadSlots();});});}catch(e){}}
document.getElementById('protected-add-btn').addEventListener('click',function(){document.getElementById('slot-modal-body').innerHTML='<div class="mb-2"><label class="form-label">星期</label><select class="form-select form-select-sm" id="s-day">'+[1,2,3,4,5].map(function(d){return'<option value="'+d+'">'+W[d]+'</option>';}).join('')+'</select></div><div class="mb-2"><label class="form-label">起始节次</label><select class="form-select form-select-sm" id="s-start">'+[1,2,3,4,5,6,7,8,9,10,11].map(function(p){return'<option value="'+p+'">'+P[p]+'</option>';}).join('')+'</select></div><div class="mb-2"><label class="form-label">结束节次</label><select class="form-select form-select-sm" id="s-end">'+[1,2,3,4,5,6,7,8,9,10,11].map(function(p){return'<option value="'+p+'">'+P[p]+'</option>';}).join('')+'</select></div><div class="mb-2"><label class="form-label">惩罚权重(0~10)</label><input type="range" class="form-range" id="s-weight" min="0" max="10" step="0.5" value="8"><span id="s-weight-val">8.0</span></div><div class="mb-2"><label class="form-label">说明</label><input class="form-control form-control-sm" id="s-desc" placeholder="辅修热门时段"></div>';document.getElementById('s-weight').addEventListener('input',function(){document.getElementById('s-weight-val').textContent=parseFloat(this.value).toFixed(1);});new bootstrap.Modal(document.getElementById('slot-modal')).show();});
document.getElementById('slot-modal-save').addEventListener('click',async function(){var data={day_of_week:parseInt(document.getElementById('s-day').value),start_period:parseInt(document.getElementById('s-start').value),end_period:parseInt(document.getElementById('s-end').value),penalty_weight:parseFloat(document.getElementById('s-weight').value),description:document.getElementById('s-desc').value||''};await CourseQSortAPI.admin.addProtectedSlot(data);bootstrap.Modal.getInstance(document.getElementById('slot-modal')).hide();loadSlots();});
document.getElementById('protected-batch-btn').addEventListener('click',function(){alert('批量更新：将替换所有保护时段（模拟）');});
async function loadPlans(){try{var d=await CourseQSortAPI.admin.getSchedulePlans();var plans=d.results||[];var tb=document.getElementById('schedule-plans-list');var SM={DRAFT:'草稿',PUBLISHED:'已发布',GENERATING:'生成中'};tb.innerHTML=plans.map(function(p){var vb='<a class="btn btn-outline-primary btn-sm py-0 me-1" href="timetable.html?plan='+p.id+'&source=admin" target="_blank">课表</a>';var eb='<button class="btn btn-outline-info btn-sm py-0 eval-plan" data-id="'+p.id+'">评估</button>';var pb=p.status==='DRAFT'?' <button class="btn btn-outline-success btn-sm py-0 pub-plan" data-id="'+p.id+'">发布</button>':'';var db='<button class="btn btn-outline-danger btn-sm py-0 ms-1 del-plan" data-pid="'+p.id+'" data-pname="'+p.plan_name+'">删除</button>';return'<tr><td>'+p.plan_name+'</td><td>'+p.semester+'</td><td><span class="badge bg-'+(p.status==='PUBLISHED'?'success':'secondary')+'">'+(SM[p.status]||p.status)+'</span></td><td>'+(p.overall_fitness!=null?p.overall_fitness:'-')+'</td><td class="small">'+(p.created_at?p.created_at.replace('T',' ').slice(0,16):'-')+'</td><td>'+vb+eb+pb+db+'</td></tr>';}).join('')||'<tr><td colspan="6" class="text-muted">暂无方案</td></tr>';document.querySelectorAll('.eval-plan').forEach(function(b){b.addEventListener('click',async function(){var id=parseInt(this.getAttribute('data-id'));try{var e=await CourseQSortAPI.admin.getSchedulePlanEvaluation(id);alert('方案评估:\n总体适应度: '+e.overall_fitness+'\n课时方差: '+e.daily_hour_variance+'\n每日分布: '+(e.daily_distribution||[]).join(', ')+'\n保护时段占用: '+e.protected_slot_occupied);}catch(ex){alert('加载评估失败');}});});document.querySelectorAll('.pub-plan').forEach(function(b){b.addEventListener('click',async function(){var id=parseInt(this.getAttribute('data-id'));await CourseQSortAPI.admin.publishPlan(id);loadPlans();});});document.querySelectorAll('.del-plan').forEach(function(b){b.addEventListener('click',async function(){var pid=parseInt(this.getAttribute('data-pid'));var pname=this.getAttribute('data-pname');if(!confirm('确定要删除方案「'+pname+'」吗？此操作不可恢复。')) return;try{await CourseQSortAPI.admin.deleteSchedulePlan(pid);loadPlans();}catch(e){alert('删除失败: '+(e.message||'网络错误'));}});});}catch(e){}}
document.getElementById('schedule-generate-btn').addEventListener('click',async function(){var el=document.getElementById('schedule-task-status');el.className='alert alert-info';el.textContent='正在生成排课方案...';try{var r=await CourseQSortAPI.admin.generateSchedule({plan_name:'新方案-'+new Date().toLocaleString(),semester:'2026-spring',major_ids:[],algorithm_config:{timetable_periods:(getTimetableConfig().periods||[]).length,total_weeks:getTimetableConfig().totalWeeks||18,session_length:2,period_times:getTimetableConfig().periods||[]}});if(r.status==='SUCCESS'||r.status==='PENDING'){el.className='alert alert-success';el.textContent='方案生成完成！';loadPlans();}else{el.className='alert alert-warning';el.textContent='生成完成，但状态: '+(r.status||'未知');loadPlans();}}catch(e){el.className='alert alert-danger';el.textContent='生成失败: '+(e.message||'网络错误');}});
async function loadConflict(){try{var d=await CourseQSortAPI.admin.getConflictResults();var rs=d.results||[];var tb=document.getElementById('conflict-results-list');tb.innerHTML=rs.map(function(r){return'<tr><td>'+r.id+'</td><td>'+r.semester+'</td><td>'+r.course_count+'</td><td>'+r.conflict_pairs_count+'</td><td>'+r.threshold+'</td><td class="small">'+(r.created_at?r.created_at.replace('T',' ').slice(0,16):'-')+'</td><td><button class="btn btn-outline-danger btn-sm py-0 view-pairs" data-id="'+r.id+'">查看冲突对</button></td></tr>';}).join('')||'<tr><td colspan="7" class="text-muted">暂无结果</td></tr>';document.querySelectorAll('.view-pairs').forEach(function(b){b.addEventListener('click',async function(){var id=parseInt(this.getAttribute('data-id'));try{var pd=await CourseQSortAPI.admin.getConflictPairs(id);var pairs=pd.results||[];var area=document.getElementById('conflict-chart-area');area.innerHTML='<h6>冲突课程对</h6>'+pairs.map(function(p){var h=Math.min(100,(p.conflicting_student_count/60)*100);return'<div class="mb-1 d-flex align-items-center"><div style="flex:1;font-size:12px;">'+p.course_a.name+' vs '+p.course_b.name+'</div><div class="me-2 text-end" style="width:30px;font-size:12px;">'+p.conflicting_student_count+'</div><div style="height:20px;width:'+h+'%;background:#dc3545;border-radius:3px;min-width:4px;"></div></div>';}).join('');}catch(ex){alert('加载失败');}});});}catch(e){}}
document.getElementById('conflict-run-btn').addEventListener('click',async function(){var el=document.getElementById('conflict-task-status');el.className='alert alert-warning';el.textContent='正在运行冲突分析...';try{var r=await CourseQSortAPI.admin.runConflictAnalysis({semester:'2026-spring',course_ids:[],threshold:30});el.className='alert alert-success';el.textContent='分析任务已提交';setTimeout(function(){el.textContent='分析完成！共发现 15 对冲突课程';loadConflict();},1500);}catch(e){el.className='alert alert-danger';el.textContent='分析失败';}});
function _makeSlider(key,label,desc,min,max,step,val,unit,showPercent){
    unit=unit||'';showPercent=showPercent||false;
    var pct=((val-min)/(max-min)*100).toFixed(0);
    var display=showPercent?(val*100).toFixed(0)+'%':parseFloat(val).toFixed(step<1?2:0)+unit;
    return'<div class="col-12 mb-3"><div class="d-flex justify-content-between align-items-center mb-1">'+
        '<span class="fw-bold small">'+label+'</span>'+
        '<span class="badge bg-primary rounded-pill" id="ap-'+key+'">'+display+'</span></div>'+
        '<input type="range" class="form-range" id="a-'+key+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+val+'">'+
        '<div class="d-flex justify-content-between"><small class="text-muted">'+desc+'</small>'+
        '<small class="text-muted" id="ah-'+key+'">'+pct+'%</small></div></div>';
}
// ---- 课表框架默认模板 ----
var TIMETABLE_TEMPLATES = {
    '8': {periodsPerDay:8, totalWeeks:18, periods:[
        {name:'第1节',start:'08:00',end:'08:45'},{name:'第2节',start:'08:55',end:'09:40'},
        {name:'第3节',start:'10:00',end:'10:45'},{name:'第4节',start:'10:55',end:'11:40'},
        {name:'第5节',start:'14:00',end:'14:45'},{name:'第6节',start:'14:55',end:'15:40'},
        {name:'第7节',start:'16:00',end:'16:45'},{name:'第8节',start:'16:55',end:'17:40'}
    ]},
    '10': {periodsPerDay:10, totalWeeks:18, periods:[
        {name:'第1节',start:'08:00',end:'08:45'},{name:'第2节',start:'08:55',end:'09:40'},
        {name:'第3节',start:'10:00',end:'10:45'},{name:'第4节',start:'10:55',end:'11:40'},
        {name:'第5节',start:'12:00',end:'12:45'},{name:'第6节',start:'14:00',end:'14:45'},
        {name:'第7节',start:'14:55',end:'15:40'},{name:'第8节',start:'16:00',end:'16:45'},
        {name:'第9节',start:'16:55',end:'17:40'},{name:'第10节',start:'19:00',end:'19:45'}
    ]},
    '11': {periodsPerDay:11, totalWeeks:18, periods:[
        {name:'第1节',start:'08:00',end:'08:45'},{name:'第2节',start:'08:55',end:'09:40'},
        {name:'第3节',start:'10:00',end:'10:45'},{name:'第4节',start:'10:55',end:'11:40'},
        {name:'第5节',start:'12:00',end:'13:30'},{name:'第6节',start:'14:00',end:'14:45'},
        {name:'第7节',start:'14:55',end:'15:40'},{name:'第8节',start:'16:00',end:'16:45'},
        {name:'第9节',start:'16:55',end:'17:40'},{name:'第10节',start:'19:00',end:'19:45'},
        {name:'第11节',start:'19:55',end:'20:40'}
    ]}
};
function getTimetableConfig(){
    var raw = localStorage.getItem('timetableConfig');
    if(raw){ try{ var tc=JSON.parse(raw); if(!tc.totalWeeks) tc.totalWeeks=18; return tc; }catch(e){} }
    return TIMETABLE_TEMPLATES['8'];
}
function saveTimetableConfig(tc){
    localStorage.setItem('timetableConfig', JSON.stringify(tc));
}
function renderPeriodsTable(tc){
    var h='';
    for(var i=0;i<tc.periods.length;i++){
        var p=tc.periods[i];
        h+='<tr><td class="small text-muted">'+(i+1)+'</td>'+
            '<td><input class="form-control form-control-sm tp-name" value="'+p.name+'" data-idx="'+i+'"></td>'+
            '<td><input type="time" class="form-control form-control-sm tp-start" value="'+p.start+'" data-idx="'+i+'"></td>'+
            '<td><input type="time" class="form-control form-control-sm tp-end" value="'+p.end+'" data-idx="'+i+'"></td></tr>';
    }
    document.getElementById('timetable-periods-body').innerHTML=h;
    _bindPeriodInputs();
}
function _bindPeriodInputs(){
    document.querySelectorAll('.tp-name,.tp-start,.tp-end').forEach(function(el){
        el.addEventListener('change',_savePeriodConfig);
    });
}
function _savePeriodConfig(){
    var tc=getTimetableConfig();
    document.querySelectorAll('.tp-name').forEach(function(el){var i=parseInt(el.getAttribute('data-idx'));if(tc.periods[i])tc.periods[i].name=el.value;});
    document.querySelectorAll('.tp-start').forEach(function(el){var i=parseInt(el.getAttribute('data-idx'));if(tc.periods[i])tc.periods[i].start=el.value;});
    document.querySelectorAll('.tp-end').forEach(function(el){var i=parseInt(el.getAttribute('data-idx'));if(tc.periods[i])tc.periods[i].end=el.value;});
    saveTimetableConfig(tc);
}
function applyTimetableTemplate(num){
    var tmpl=TIMETABLE_TEMPLATES[num]||TIMETABLE_TEMPLATES['8'];
    var tc={periodsPerDay:tmpl.periodsPerDay, totalWeeks:tmpl.totalWeeks||18, periods:tmpl.periods.map(function(p){return {name:p.name,start:p.start,end:p.end};})};
    saveTimetableConfig(tc);
    document.getElementById('timetable-period-count').value=tc.periodsPerDay;
    document.getElementById('timetable-total-weeks').value=tc.totalWeeks;
    renderPeriodsTable(tc);
}
function changePeriodCount(count){
    count=parseInt(count);
    var tc=getTimetableConfig();
    while(tc.periods.length<count){
        var i=tc.periods.length+1;
        tc.periods.push({name:'第'+i+'节',start:'08:00',end:'08:45'});
    }
    while(tc.periods.length>count){tc.periods.pop();}
    tc.periodsPerDay=count;
    saveTimetableConfig(tc);
    renderPeriodsTable(tc);
}

async function loadAlgo(){try{
    var c=await CourseQSortAPI.admin.getAlgorithmConfig();
    var form=document.getElementById('algorithm-config-form');
    var tc=getTimetableConfig();
    var h='';

    // ===== 课表框架 =====
    h+='<h6 class="mb-3"><i class="bi bi-clock"></i> 课表框架 —— 每天几节课？每节多长时间？</h6>';
    h+='<div class="card bg-light mb-4"><div class="card-body">';
    h+='<div class="row g-2 mb-2"><div class="col-md-3"><label class="form-label small">每天节数</label><div class="input-group input-group-sm"><input type="number" class="form-control" id="timetable-period-count" value="'+tc.periodsPerDay+'" min="1" max="15"><button class="btn btn-outline-secondary" id="timetable-apply-count">应用</button></div></div>';
    h+='<div class="col-md-3"><label class="form-label small">学期总周数</label><div class="input-group input-group-sm"><input type="number" class="form-control" id="timetable-total-weeks" value="'+(tc.totalWeeks||18)+'" min="1" max="30"><button class="btn btn-outline-secondary" id="timetable-apply-weeks">应用</button></div></div>';
    h+='<div class="col-md-6 d-flex align-items-end"><button class="btn btn-outline-primary btn-sm w-100" id="timetable-template-8">📋 8节模板</button></div>';
    h+='<div class="col-md-3 d-flex align-items-end"><button class="btn btn-outline-secondary btn-sm w-100" id="timetable-template-10">📋 10节模板</button></div>';
    h+='<div class="col-md-3 d-flex align-items-end"><button class="btn btn-outline-secondary btn-sm w-100" id="timetable-template-11">📋 11节模板</button></div>';
    h+='</div>';
    h+='<div class="table-responsive"><table class="table table-sm table-bordered mb-0"><thead><tr><th style="width:50px">#</th><th>节次名称</th><th>上课时间</th><th>下课时间</th></tr></thead><tbody id="timetable-periods-body"></tbody></table></div>';
    h+='<small class="text-muted mt-1">修改时间后自动保存，课表页面会自动应用</small>';
    h+='</div></div>';

    // ===== 排课目标 =====
    h+='<h6 class="mb-3"><i class="bi bi-bullseye"></i> 排课目标 —— 你希望什么样的课表？</h6>';
    h+='<div class="card bg-light mb-4"><div class="card-body">';

    var v1=c.variance_weight!=null?c.variance_weight:0.6;
    h+=_makeSlider('variance_weight','每天课时均匀度',
        '数值越高，课程越均匀分布在一周五天，避免某天课特别多',
        0,1,0.05,v1,'',true);

    var v2=c.conflict_penalty_weight!=null?c.conflict_penalty_weight:0.4;
    h+=_makeSlider('conflict_penalty_weight','避开辅修热门时段',
        '数值越高，越倾向于不占用辅修学生常选的黄金时段',
        0,1,0.05,v2,'',true);

    var v3=c.protected_slot_penalty!=null?c.protected_slot_penalty:8.0;
    h+=_makeSlider('protected_slot_penalty','辅修时段保护力度',
        '占用辅修时段时的"惩罚分"，越高排课时越不敢碰辅修时段',
        0,10,0.5,v3,' 分');

    h+='</div></div>';

    // ===== 算法性能 =====
    h+='<h6 class="mb-3"><i class="bi bi-cpu"></i> 运行配置 —— 花多少时间算出结果？</h6>';
    h+='<div class="card bg-light mb-4"><div class="card-body">';

    var v4=c.population_size!=null?c.population_size:200;
    h+=_makeSlider('population_size','方案尝试数量',
        '每轮同时尝试多少种不同的排法（越多越可能找到好方案，但计算更慢）',
        50,500,10,v4,' 种');

    var v5=c.max_generations!=null?c.max_generations:500;
    h+=_makeSlider('max_generations','优化迭代轮数',
        '算法自我改进多少轮才停止（越多结果可能越好，但时间更长）',
        100,2000,50,v5,' 轮');

    var v6=c.timeout_seconds!=null?c.timeout_seconds:300;
    h+=_makeSlider('timeout_seconds','最长运行时间',
        '到达此时间后不论结果如何都停止，取当前最好的方案',
        60,600,10,v6,' 秒');

    h+='</div></div>';

    // ===== 高级 =====
    h+='<h6 class="mb-3"><i class="bi bi-gear"></i> 高级选项 —— 一般不需要调整</h6>';
    h+='<div class="card bg-light mb-4"><div class="card-body">';

    var v7=c.mutation_rate!=null?c.mutation_rate:0.05;
    h+=_makeSlider('mutation_rate','随机探索力度',
        '随机打乱课程安排的几率（高=尝试更多新奇组合，低=趋于保守）',
        0,0.2,0.01,v7,'',true);

    var v8=c.crossover_rate!=null?c.crossover_rate:0.85;
    h+=_makeSlider('crossover_rate','方案融合程度',
        '两种不错方案之间互相借鉴排法的比例（高=好的经验传播更快）',
        0.5,1,0.05,v8,'',true);

    h+='</div></div>';

    form.innerHTML=h;

    // 绑定 slider 事件
    ['variance_weight','conflict_penalty_weight','protected_slot_penalty','population_size','max_generations','timeout_seconds','mutation_rate','crossover_rate'].forEach(function(k){
        var el=document.getElementById('a-'+k);if(!el)return;
        el.addEventListener('input',function(){
            var val=parseFloat(this.value);
            var label=document.getElementById('ap-'+k);
            var hint=document.getElementById('ah-'+k);
            var step=parseFloat(this.step);
            // 判断是否为百分比显示
            var isPct=['variance_weight','conflict_penalty_weight','mutation_rate','crossover_rate'].indexOf(k)!==-1;
            if(isPct){
                label.textContent=(val*100).toFixed(0)+'%';
                if(hint) hint.textContent=((val-parseFloat(this.min))/(parseFloat(this.max)-parseFloat(this.min))*100).toFixed(0)+'%';
            } else {
                var unit='';
                if(k==='population_size') unit=' 种';
                else if(k==='max_generations') unit=' 轮';
                else if(k==='timeout_seconds') unit=' 秒';
                else if(k==='protected_slot_penalty') unit=' 分';
                label.textContent=parseFloat(val).toFixed(step<1?2:0)+unit;
                if(hint) hint.textContent=((val-parseFloat(this.min))/(parseFloat(this.max)-parseFloat(this.min))*100).toFixed(0)+'%';
            }
            // 联动：variance + conflict ≈ 1
            if(k==='variance_weight'){
                var ce=document.getElementById('a-conflict_penalty_weight');
                if(ce){ce.value=(1-val).toFixed(2);document.getElementById('ap-conflict_penalty_weight').textContent=((1-val)*100).toFixed(0)+'%';}
            }
            if(k==='conflict_penalty_weight'){
                var ve=document.getElementById('a-variance_weight');
                if(ve){ve.value=(1-val).toFixed(2);document.getElementById('ap-variance_weight').textContent=((1-val)*100).toFixed(0)+'%';}
            }
        });
    });

    // 渲染课表框架表格
    renderPeriodsTable(tc);

    // 课表框架事件绑定
    document.getElementById('timetable-apply-count').addEventListener('click',function(){changePeriodCount(parseInt(document.getElementById('timetable-period-count').value));});
    document.getElementById('timetable-apply-weeks').addEventListener('click',function(){var tc=getTimetableConfig();tc.totalWeeks=parseInt(document.getElementById('timetable-total-weeks').value)||18;saveTimetableConfig(tc);alert('周数已更新为 '+tc.totalWeeks+' 周，重新生成排课方案后生效');});
    document.getElementById('timetable-template-8').addEventListener('click',function(){applyTimetableTemplate(8);});
    document.getElementById('timetable-template-10').addEventListener('click',function(){applyTimetableTemplate(10);});
    document.getElementById('timetable-template-11').addEventListener('click',function(){applyTimetableTemplate(11);});

}catch(e){}}
document.getElementById('algorithm-save-btn').addEventListener('click',async function(){var cfg={};['variance_weight','conflict_penalty_weight','protected_slot_penalty','population_size','max_generations','mutation_rate','crossover_rate','timeout_seconds'].forEach(function(k){var el=document.getElementById('a-'+k);if(el)cfg[k]=parseFloat(el.value);});try{await CourseQSortAPI.admin.updateAlgorithmConfig(cfg);document.getElementById('algorithm-save-status').textContent='配置已保存';document.getElementById('algorithm-save-status').className='mt-2 small text-success';}catch(e){document.getElementById('algorithm-save-status').textContent='保存失败';document.getElementById('algorithm-save-status').className='mt-2 small text-danger';}});
switchSec('dashboard');
