from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('scheduling', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='scheduleentry',
            name='week',
            field=models.IntegerField(default=1, help_text='第几周'),
        ),
    ]
