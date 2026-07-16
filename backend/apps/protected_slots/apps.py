from django.apps import AppConfig


class ProtectedSlotsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.protected_slots'
    verbose_name = '辅修时段保护'
