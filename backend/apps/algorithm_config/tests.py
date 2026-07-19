from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Profile
from apps.algorithm_config.models import AlgorithmConfig


class AlgorithmConfigApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_user = User.objects.create_user(
            username="algorithm-admin",
            password="secret123",
        )
        Profile.objects.create(
            user=self.admin_user,
            role="ADMIN",
            name="Algorithm Admin",
        )
        self.student_user = User.objects.create_user(
            username="algorithm-student",
            password="secret123",
        )
        Profile.objects.create(
            user=self.student_user,
            role="STUDENT",
            name="Algorithm Student",
        )

    def test_get_returns_default_singleton_config(self):
        self.client.force_authenticate(self.admin_user)

        response = self.client.get("/api/v1/admin/algorithm-config/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(AlgorithmConfig.objects.count(), 1)
        self.assertEqual(response.data["population_size"], 200)
        self.assertIsNone(response.data["updated_by"])

    def test_patch_updates_config_and_records_updater(self):
        self.client.force_authenticate(self.admin_user)

        response = self.client.patch(
            "/api/v1/admin/algorithm-config/",
            {
                "population_size": 150,
                "mutation_rate": 0.1,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        config = AlgorithmConfig.objects.get(pk=1)
        self.assertEqual(config.population_size, 150)
        self.assertEqual(config.mutation_rate, 0.1)
        self.assertEqual(config.updated_by_id, self.admin_user.id)
        self.assertEqual(response.data["updated_by"], "Algorithm Admin")

    def test_endpoint_requires_admin_role(self):
        self.client.force_authenticate(self.student_user)

        response = self.client.get("/api/v1/admin/algorithm-config/")

        self.assertEqual(response.status_code, 403)
