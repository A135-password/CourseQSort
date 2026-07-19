from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Profile
from apps.protected_slots.models import ProtectedSlot


class ProtectedSlotApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_user = User.objects.create_user(
            username="protected-admin",
            password="secret123",
        )
        Profile.objects.create(
            user=self.admin_user,
            role="ADMIN",
            name="Protected Admin",
        )

    def test_batch_update_replaces_existing_slots(self):
        ProtectedSlot.objects.create(
            day_of_week=1,
            start_period=1,
            end_period=2,
            description="old slot",
        )
        self.client.force_authenticate(self.admin_user)

        response = self.client.put(
            "/api/v1/admin/protected-slots/batch-update/",
            [
                {
                    "day_of_week": 2,
                    "start_period": 3,
                    "end_period": 4,
                    "penalty_weight": 10.0,
                    "description": "lab block",
                },
                {
                    "day_of_week": 5,
                    "start_period": 1,
                    "end_period": 1,
                    "penalty_weight": 6.5,
                    "description": "assembly",
                },
            ],
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["updated_count"], 2)
        self.assertEqual(ProtectedSlot.objects.count(), 2)
        self.assertFalse(ProtectedSlot.objects.filter(description="old slot").exists())

    def test_batch_update_requires_list_payload(self):
        self.client.force_authenticate(self.admin_user)

        response = self.client.put(
            "/api/v1/admin/protected-slots/batch-update/",
            {"day_of_week": 1},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("detail", response.data)
