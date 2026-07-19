from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('courses', '0003_add_user_fk'),
    ]

    operations = [
        migrations.AddField(
            model_name='course',
            name='session_length',
            field=models.IntegerField(
                default=2,
                help_text='姣忔璇捐繛鎺掕妭鏁帮紙姣忛棬璇剧▼鐙珛璁剧疆锛?',
            ),
        ),
    ]
