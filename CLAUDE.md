# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

CourseQSort（排课规划器）— 大学课程排课优化系统。作为现有教务系统的辅助插件，通过 API 获取课程/教师/教室数据，经遗传算法优化后输出排课建议方案和冲突分析报告。目前仅有后端，前端尚未实现。

## 技术栈

- **后端**: Django 4.x + Django REST Framework + SimpleJWT + Celery
- **数据库**: 默认 SQLite（开发），支持 MySQL（生产）
- **缓存/队列**: Redis（Celery broker）
- **包管理**: pip + requirements.txt

## 常用命令

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 数据库迁移
python manage.py migrate

# 运行开发服务器
python manage.py runserver

# 从旧教务系统爬取的 JSON 导入数据（一次性数据迁移）
python manage.py import_from_crawled_json ../test/test_100.json --dry-run   # 预览
python manage.py import_from_crawled_json ../test/test_100.json             # 正式导入
python manage.py import_from_crawled_json ../data/courses.json --semester 2026-spring

# 创建超级用户（教务）
python manage.py createsuperuser

# 查看 SQLite 数据库
python manage.py dbshell

# Celery worker（需要 Redis 运行中）
celery -A celery worker -l info
```

## 架构概览

### URL 路由结构

```
/api/v1/auth/          — JWT 认证（login/refresh/logout/me）
/api/v1/admin/         — 教务端：课程 CRUD、批量导入、教师/教室/专业列表、
                          辅修时段保护、排课方案生成、冲突预分析、算法参数热配置
/api/v1/student/       — 学生端：个人课表、可选课程（含冲突标记）、选课/退课、
                          空闲时段推荐
```

### Django App 模块

| App | 职责 |
|-----|------|
| `apps.accounts` | 用户认证，Profile 模型扩展 User，包含 ADMIN/STUDENT 角色 |
| `apps.courses` | 核心数据模型：Course、Teacher、Classroom、Major、Student、CourseScheduleItem；Excel 批量导入；`import_from_crawled_json` 管理命令 |
| `apps.protected_slots` | 辅修热门时段保护，教务标记需避开的时段 + 惩罚权重 |
| `apps.scheduling` | 排课方案（SchedulePlan / ScheduleEntry）、异步任务（TaskRecord）、遗传算法模块 |
| `apps.conflict_analysis` | 课程时间冲突预分析，遍历课程对找重叠时段 |
| `apps.algorithm_config` | 算法参数热配置（种群大小、变异率、权重等），存数据库，无需重启 |
| `apps.student` | 学生端视图 + **55-bit 位图**冲突检测工具 |
| `apps.common` | 分页器、mixins、工具函数 |

### 权限模型

两个自定义 DRF 权限类（`apps.accounts.permissions`）：
- `IsAdminUser` — `profile.role == 'ADMIN'`
- `IsStudentUser` — `profile.role == 'STUDENT'`

所有 `/api/v1/admin/` 端点用 `IsAdminUser`，`/api/v1/student/` 用 `IsStudentUser`。

### 55-bit 位图冲突检测

`apps.student.bitmap` — 核心数据结构，用于学生端毫秒级冲突检测：

- **5 天 × 11 节/天 = 55 位**，每位表示一个时间段是否占用
- `build_bitmap(time_slots)` — 将 `[(day, period), ...]` 列表编码为 `0x` 前缀的十六进制字符串
- `has_conflict(a, b)` — 两个位图按位与，结果非零则冲突
- 前端拿到已选课表位图后，与待选课程位图做 `&` 即可在本地判断冲突，无需请求后端

### 排课算法模块（当前为桩实现）

`apps/scheduling/algorithm/` 下的四个文件均为空文件，遗传算法尚未实现：

- `constraints.py` — 硬约束检查（教室容量、教师禁排、午休禁排、体育课后禁排理论课等）
- `fitness.py` — 适应度函数（日课时方差最小化 + 辅修时段惩罚权重）
- `genetic.py` — 遗传算法核心（种群、选择、交叉、变异）
- `optimizer.py` — 调度入口

**当前行为**：`apps/scheduling/tasks.py` 中的 `run_generate_sync` 直接读取 `CourseScheduleItem` 并复制为 `ScheduleEntry`，没有实际算法优化。需要在上述四个文件中实现真正的遗传算法逻辑。

### 数据导入流程

两种导入方式：

1. **Excel 批量导入**（`POST /api/v1/admin/courses/import/`）— 通过 `apps.courses.import_export.import_courses_from_excel` 解析，支持中文列名自动映射
2. **旧教务 JSON 导入**（`manage.py import_from_crawled_json`）— 解析 `teachingTimePlaceStr`（周次/星期/节次/地点/教师/活动类型），自动创建 Course、Teacher、Classroom、Student、Major 等关联记录，`courseId` 防重复

### API 文档

`api/api_contract.md` — 完整的 REST API 接口契约（所有端点的请求/响应格式、状态码、使用场景）
`api/srs.md` — 软件需求规约（用户特征、约束条件、功能性/非功能性需求）
`api/db_guide.md` — JSON 数据导入指南（字段格式、映射关系、操作步骤）

## 配置要点

- `config/settings.py` 中 `SECRET_KEY`、`DEBUG`、`ALLOWED_HOSTS`、`DATABASES` 均通过环境变量覆盖
- JWT access token 有效期 30 分钟，refresh token 7 天
- Celery broker 默认 `redis://127.0.0.1:6379/0`
- 语言/时区：`zh-hans` / `Asia/Shanghai`
- `CORS_ALLOW_ALL_ORIGINS = True`（开发阶段）
