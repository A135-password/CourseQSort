import openpyxl
from django.db import transaction
from apps.courses.models import Course, Major, Teacher


def import_courses_from_excel(file):
    wb = openpyxl.load_workbook(file, read_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return {'imported_count': 0, 'errors': []}

    headers = [str(h).strip().lower() if h else '' for h in rows[0]]
    errors = []
    imported = 0

    col_map = {}
    for kw, names in [
        ('name', ['课程名称', 'name', 'course name', 'coursename']),
        ('code', ['课程编码', '课程编号', 'code', 'course num', 'coursenum']),
        ('credit', ['学分', 'credit', 'score']),
        ('hours', ['学时', 'hours']),
        ('semester', ['学期', 'semester', 'year term', 'yearterm']),
        ('major', ['专业', 'major', '专业名称']),
        ('teacher', ['教师', 'teacher', '授课教师', 'teachingname', 'teaching name']),
        ('classroom_type', ['教室类型', 'classroom type', 'required classroom types']),
        ('student_count', ['人数', '学生人数', 'expected student count', 'expected_student_count', 'limitnumber', 'limit number']),
        ('is_professional', ['专业课', 'is professional', 'is_professional_course', 'course category', 'coursecategoryname']),
    ]:
        for i, h in enumerate(headers):
            if h in names:
                col_map[kw] = i
                break

    for row_idx, row in enumerate(rows[1:], start=2):
        if not any(row):
            continue
        try:
            name = str(row[col_map.get('name', 0)] or '').strip() if 'name' in col_map else ''
            if not name:
                errors.append({'row': row_idx, 'reason': '课程名称为空'})
                continue

            code = str(row[col_map.get('code', 0)] or '').strip() if 'code' in col_map else ''
            semester = str(row[col_map.get('semester', 0)] or '').strip() if 'semester' in col_map else ''
            credit_str = str(row[col_map.get('credit', 0)] or '0').strip() if 'credit' in col_map else '0'

            try:
                credit = float(credit_str)
            except ValueError:
                errors.append({'row': row_idx, 'reason': '学分格式错误'})
                continue

            hours = None
            if 'hours' in col_map:
                try:
                    hours = int(float(str(row[col_map['hours']] or '0')))
                except ValueError:
                    pass

            major = None
            if 'major' in col_map:
                major_name = str(row[col_map['major']] or '').strip()
                if major_name:
                    major = Major.objects.filter(name=major_name).first()

            category_str = ''
            if 'is_professional' in col_map:
                category_str = str(row[col_map['is_professional']] or '').strip().lower()
            is_professional = category_str in ('专必', '专选', 'true', '1', 'yes')

            count = None
            if 'student_count' in col_map:
                try:
                    count = int(float(str(row[col_map['student_count']] or '0')))
                except ValueError:
                    pass

            Course.objects.create(
                name=name, code=code, credit=credit,
                hours=hours, semester=semester,
                major=major,
                is_professional_course=is_professional,
                expected_student_count=count,
            )
            imported += 1
        except Exception as e:
            errors.append({'row': row_idx, 'reason': str(e)})

    return {'imported_count': imported, 'errors': errors}
