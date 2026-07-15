# 数据库导入指南

## 1. JSON 文件格式说明

导入命令要求 JSON 文件遵循以下格式规则。

### 1.1 根结构

JSON 根层级为一个数组，每个元素为一个包含 `total` 和 `rows` 的对象：

```json
[
  {
    "total": 9917,
    "rows": [
      { /* 课程记录 */ },
      { /* 课程记录 */ }
    ]
  },
  {
    "total": 9917,
    "rows": [
      { /* 课程记录 */ }
    ]
  }
]
```

系统会自动合并所有 `rows` 数组。也支持平铺的普通数组格式：

```json
[
  { /* 课程记录 */ },
  { /* 课程记录 */ }
]
```

### 1.2 每条记录字段说明

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `yearTerm` | string | 是 | 学期，如 `"2025-2"` |
| `courseName` | string | 是 | 课程名称 |
| `courseNum` | string | 是 | 课程编码（如 `"PH402"`） |
| `courseId` | string | 是 | 来源系统的课程唯一 ID，用于去重 |
| `openingUnitName` | string | 是 | 开课学院/单位名称 |
| `courseCategoryName` | string | 是 | 课程类别：`专必` / `专选` / `公必` |
| `score` | string | 是 | 学分，如 `"3.0"` |
| `limitNumber` | number | 否 | 容量限制 |
| `teachingName` | string | 否 | 授课教师，多人用逗号分隔（如 `"毛旭东"`/`"彭雪婷,李永强"`） |
| `teachingTimePlaceStr` | string | 是 | 上课时间地点字符串（下方详述） |
| `openingSchoolName` | string | 是 | 校区名称（如 `"北校园"`、`"南校园"`、`"东校园"`、`"珠海校区"`） |
| `readObj` | string | 否 | 授课对象描述（用于提取专业/年级/班级信息） |

### 1.3 `teachingTimePlaceStr` 格式

该字段描述课程的所有上课时间段，支持 3 种格式变体（按 `/` 分段数量区分）：

#### 格式一：6 段（含地点和教师）
```
周次/星期/节次/地点/教师/活动类型
```
例：`"1-17周/星期二/第3-4节/南校园-第五教学楼(逸夫楼)-逸208/毛旭东/理论环节"`

#### 格式二：5 段（含地点，无教师）
```
周次/星期/节次/地点/活动类型
```
例：`"1-2周/星期五/第5-6节/北校园-新教学楼-新教502/理论环节"`

#### 格式三：4 段（无地点，无教师）
```
周次/星期/节次/活动类型
```
例：`"2-7周/星期一/第5-7节/实验实践环节"`

#### 字段含义

| 组成部分 | 格式 | 示例 |
|---|---|---|
| 周次 | `X-Y周` 或 `X周` | `1-17周`、`8-8周` |
| 星期 | `星期X` | `星期一`、`星期二`、`星期三`、`星期四`、`星期五` |
| 节次 | `第X-Y节` | `第3-4节`、`第5-7节` |
| 地点 | `校区-楼宇-房间号` | `南校园-第五教学楼(逸夫楼)-逸208` |
| 教师 | 教师姓名 | `毛旭东` |
| 活动类型 | 描述教学环节 | `理论环节`、`实验实践环节` |

多个时间段用逗号（`,`）分隔：

```
1-2周/星期五/第5-6节/北校园-新教学楼-新教502/理论环节,8-8周/星期一/第5-7节/北校园-新教学楼-新教502/实验实践环节
```

### 1.4 `readObj` 格式

描述该课程面向的学生群体，多个群体用逗号（`,`）分隔：

```
北校园 公共卫生学院 2022级 22级预防医学
北校园 中山医学院 2022级 22级临床医学 ,北校园 光华口腔医学院 2023级 23级口腔医学（5+3）
```

系统自动跳过开头的校区关键词（北校园/东校园/南校园/珠海校区/深圳校区），提取学院、年级、专业、班级信息。

### 1.5 完整记录示例

```json
{
  "class_ID": "1993115018679668737",
  "yearTerm": "2025-2",
  "courseName": "儿少卫生学",
  "courseNum": "PH402",
  "courseId": "205087591",
  "openingUnitName": "公共卫生学院",
  "courseCategoryName": "专必",
  "score": "2.5",
  "limitNumber": 78,
  "selectedNumber": 76,
  "examMode": "考试",
  "teachingName": "",
  "teachingTimePlaceStr": "1-2周/星期五/第5-6节/北校园-新教学楼-新教502/理论环节,8-8周/星期一/第5-7节/北校园-新教学楼-新教502/实验实践环节",
  "openingSchoolName": "北校园",
  "readObj": "北校园 公共卫生学院 2022级 22级预防医学",
  "classNumber": "202520002",
  "weekDay": "1,1,2,4,5",
  "timePlaceId": "1998677312246095872,1998677588050944000,1998677610540249088",
  "openClass": "1"
}
```

### 1.6 字段映射到数据库

| JSON 字段 | 数据库模型/字段 | 说明 |
|---|---|---|
| `courseId` | `Course.course_id_from_source` | 唯一标识，防止重复导入 |
| `courseName` | `Course.name` | 课程名称 |
| `courseNum` | `Course.code` | 课程编码 |
| `score` | `Course.credit` | 学分（字符串转浮点数） |
| `yearTerm` | `Course.semester` | 学期 |
| `openingSchoolName` | `Course.campus` | 校区 |
| `courseCategoryName` | `Course.is_professional_course` | `专必`/`专选` → `true`，`公必` → `false` |
| `limitNumber` | `Course.expected_student_count` | 容量上限 |
| `openingUnitName` | `Major` / `Teacher.department` | 学院信息 |
| `teachingName` | `Teacher` + `Course.teachers` | 逗号分隔，按姓名+学院去重 |
| `teachingTimePlaceStr` | `CourseScheduleItem` | 展开为多条排课记录 |
| `readObj` | `Major.name` / `Student` | 解析专业和班级 |

---

## 2. 导入操作步骤

### 2.1 前提条件

- Python 3.9+
- Django 4.x（已包含在依赖中）
- SQLite（内置，默认）或 MySQL

### 2.2 安装依赖

```bash
pip install -r requirements.txt
```

### 2.3 数据库配置

默认使用 SQLite，无需额外配置。如需切换 MySQL，编辑 `config/settings.py` 中的 DATABASES 配置，或设置环境变量：

```bash
set MYSQL_DB=course_scheduler
set MYSQL_USER=root
set MYSQL_PASSWORD=your_password
set MYSQL_HOST=127.0.0.1
set MYSQL_PORT=3306
```

### 2.4 建表

```bash
cd backend_code

# 首次使用：创建数据库表
python manage.py migrate courses
python manage.py migrate
```

### 2.5 导入数据

```bash
# 1. 预览模式（推荐先运行，确认数据解析正确）
python manage.py import_from_crawled_json ../test/test_100.json --dry-run

# 2. 正式导入
python manage.py import_from_crawled_json ../test/test_100.json

# 3. 指定学期（覆盖 JSON 中的 yearTerm）
python manage.py import_from_crawled_json ../data/my_courses.json --semester 2026-spring
```

### 2.6 验证导入结果

```bash
# 进入 Django shell
python manage.py shell
```

```python
from apps.courses.models import *
print('Courses:', Course.objects.count())
print('Teachers:', Teacher.objects.count())
print('Classrooms:', Classroom.objects.count())
print('Schedule items:', CourseScheduleItem.objects.count())
```

### 2.7 重新导入

如需清空数据重新导入：

```bash
# SQLite
del db.sqlite3
python manage.py migrate

# MySQL
mysql -u root -p -e "DROP DATABASE course_scheduler; CREATE DATABASE course_scheduler;"
python manage.py migrate
```

---

## 3. 特殊数据处理说明

### 3.1 教师信息

系统从两个来源提取教师：
1. **`teachingName` 字段**：逗号分隔的教师姓名列表
2. **`teachingTimePlaceStr` 中的 6 段格式**：当 time string 包含 6 段时，第 5 段为教师姓名

两种来源的教师名会合并去重，并自动关联到课程。

### 3.2 教室信息

教室从 `teachingTimePlaceStr` 的地点段自动提取。地点格式为 `校区-楼宇名-房间号`，系统会自动将校区和楼宇合并为 `building` 字段。

含"实验中心"或"实验室"的地点会自动标记为 `is_lab=True`。

### 3.3 专业信息

专业名称从 `readObj` 提取。系统会跳过校区前缀，从年级标记（如 `2022级`）后的文本中解析专业名和班级名。

---

## 4. 常见问题

### Q: 导入时报错 `ModuleNotFoundError`

A: 其他 app（如 accounts、scheduling 等）尚未实现，不影响导入。如需移除报错，可临时在 `settings.py` 的 `INSTALLED_APPS` 中注释掉未实现的 app。

### Q: 导入时提示 `foreign key constraint failed`

A: 确保迁移已完整运行（`python manage.py migrate`），所有依赖表已创建。

### Q: 如何查看 SQLite 数据库内容？

```bash
python manage.py dbshell
.tables
SELECT name, code, semester FROM course LIMIT 5;
```

### Q: 我的 JSON 文件和示例格式不同怎么办？

A: 导入命令的 `_load_json` 方法支持 3 种根结构：
- `[{"total": N, "rows": [...]}, ...]` — 数组包{total,rows}
- `{"total": N, "rows": [...]}` — 单对象
- `[...]` — 平铺数组

如果你的文件结构不同，可修改 `import_from_crawled_json.py` 中的 `_load_json` 方法适配。
