import uuid

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Profile
from apps.courses.models import Student


class AuthApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_register_binds_existing_student_record(self):
        student = Student.objects.create(name="Alice", student_no="S001")

        response = self.client.post(
            "/api/v1/auth/register/",
            {
                "username": "alice",
                "password": "secret123",
                "role": "STUDENT",
                "name": "Alice",
                "identifier": "S001",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

        user = User.objects.get(username="alice")
        profile = Profile.objects.get(user=user)
        student.refresh_from_db()

        self.assertEqual(profile.role, "STUDENT")
        self.assertEqual(profile.name, "Alice")
        self.assertEqual(student.user_id, user.id)

    def test_login_and_me_return_profile_data(self):
        user = User.objects.create_user(
            username="student1",
            password="secret123",
            email="student1@example.com",
        )
        Profile.objects.create(
            user=user,
            role="STUDENT",
            name="Student One",
            major="Computer Science",
        )

        login_response = self.client.post(
            "/api/v1/auth/login/",
            {"username": "student1", "password": "secret123"},
            format="json",
        )

        self.assertEqual(login_response.status_code, 200)
        self.assertIn("access", login_response.data)

        access_token = login_response.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        me_response = self.client.get("/api/v1/auth/me/")

        self.assertEqual(me_response.status_code, 200)
        self.assertEqual(me_response.data["username"], "student1")
        self.assertEqual(me_response.data["role"], "STUDENT")
        self.assertEqual(me_response.data["name"], "Student One")
        self.assertEqual(me_response.data["major"], "Computer Science")

    def test_login_rejects_invalid_password(self):
        User.objects.create_user(username="wrong-pass-user", password="secret123")

        response = self.client.post(
            "/api/v1/auth/login/",
            {"username": "wrong-pass-user", "password": "bad-password"},
            format="json",
        )

        self.assertEqual(response.status_code, 401)
        self.assertIn("detail", response.data)
