from io import BytesIO

import openpyxl
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Profile
from apps.courses.models import Course, Major, Teacher


class CourseImportIntegrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_user = User.objects.create_user(
            username="course-admin",
            password="secret123",
        )
        Profile.objects.create(
            user=self.admin_user,
            role="ADMIN",
            name="Course Admin",
        )
        self.client.force_authenticate(self.admin_user)
        self.major = Major.objects.create(name="Clinical Medicine", code="CM")

    def _build_excel_upload(self, rows):
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        for row in rows:
            sheet.append(row)

        buffer = BytesIO()
        workbook.save(buffer)
        buffer.seek(0)
        return SimpleUploadedFile(
            "courses.xlsx",
            buffer.read(),
            content_type=("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        )

    def test_import_endpoint_creates_courses_and_links_teachers(self):
        upload = self._build_excel_upload(
            [
                [
                    "name",
                    "code",
                    "credit",
                    "hours",
                    "semester",
                    "major",
                    "teacher",
                    "expected_student_count",
                    "is professional",
                ],
                [
                    "Medical Statistics",
                    "MED101",
                    3,
                    48,
                    "2026-1",
                    "Clinical Medicine",
                    "Teacher One, Teacher Two",
                    80,
                    "true",
                ],
                [
                    "Broken Course",
                    "MED102",
                    "bad-credit",
                    32,
                    "2026-1",
                    "Clinical Medicine",
                    "Teacher Three",
                    40,
                    "true",
                ],
            ]
        )

        response = self.client.post(
            "/api/v1/admin/courses/import/",
            {"file": upload},
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["imported_count"], 1)
        self.assertEqual(len(response.data["errors"]), 1)

        course = Course.objects.get(name="Medical Statistics")
        self.assertEqual(course.code, "MED101")
        self.assertEqual(course.major_id, self.major.id)
        self.assertEqual(course.expected_student_count, 80)
        self.assertTrue(course.is_professional_course)
        self.assertTrue(course.course_id_from_source.startswith("import-MED101-"))
        self.assertEqual(course.teachers.count(), 2)
        self.assertSetEqual(
            set(course.teachers.values_list("name", flat=True)),
            {"Teacher One", "Teacher Two"},
        )
        self.assertTrue(Teacher.objects.filter(name="Teacher Three").exists() is False)
