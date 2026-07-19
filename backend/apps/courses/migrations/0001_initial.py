from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Major',
            fields=[
                ('id', models.BigAutoField(
                    auto_created=True, primary_key=True,
                    serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('code', models.CharField(
                    blank=True, default='', max_length=50)),
                ('student_count', models.IntegerField(
                    blank=True, null=True)),
            ],
            options={
                'db_table': 'major',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='Classroom',
            fields=[
                ('id', models.BigAutoField(
                    auto_created=True, primary_key=True,
                    serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('capacity', models.IntegerField(default=60)),
                ('building', models.CharField(
                    blank=True, default='', max_length=200)),
                ('equipment_types', models.JSONField(
                    blank=True, default=list)),
                ('is_lab', models.BooleanField(default=False)),
            ],
            options={
                'db_table': 'classroom',
                'ordering': ['building', 'name'],
            },
        ),
        migrations.CreateModel(
            name='Teacher',
            fields=[
                ('id', models.BigAutoField(
                    auto_created=True, primary_key=True,
                    serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=50)),
                ('employee_no', models.CharField(
                    blank=True, default='', max_length=50)),
                ('department', models.CharField(
                    blank=True, default='', max_length=100)),
                ('unavailable_slots', models.JSONField(
                    blank=True, default=list)),
            ],
            options={
                'db_table': 'teacher',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='Course',
            fields=[
                ('id', models.BigAutoField(
                    auto_created=True, primary_key=True,
                    serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('code', models.CharField(
                    blank=True, default='', max_length=50)),
                ('credit', models.FloatField(default=0.0)),
                ('hours', models.IntegerField(blank=True, null=True)),
                ('semester', models.CharField(
                    blank=True, default='', max_length=20)),
                ('campus', models.CharField(
                    blank=True, default='', max_length=50)),
                ('required_classroom_types', models.JSONField(
                    blank=True, default=list)),
                ('expected_student_count', models.IntegerField(
                    blank=True, null=True)),
                ('is_professional_course', models.BooleanField(default=True)),
                ('prerequisites', models.JSONField(
                    blank=True, default=list)),
                ('course_id_from_source', models.CharField(
                    max_length=50, unique=True,
                    verbose_name='来源系统 courseId')),
                ('major', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to='courses.major')),
                ('teachers', models.ManyToManyField(
                    blank=True, to='courses.Teacher')),
            ],
            options={
                'db_table': 'course',
                'ordering': ['-semester', 'name'],
            },
        ),
        migrations.CreateModel(
            name='CourseScheduleItem',
            fields=[
                ('id', models.BigAutoField(
                    auto_created=True, primary_key=True,
                    serialize=False, verbose_name='ID')),
                ('day_of_week', models.IntegerField()),
                ('period', models.IntegerField()),
                ('week_start', models.IntegerField(default=1)),
                ('week_end', models.IntegerField(default=18)),
                ('class_identification', models.CharField(
                    blank=True, default='', max_length=200)),
                ('classroom', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to='courses.classroom')),
                ('course', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='schedule_items',
                    to='courses.course')),
                ('teacher', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to='courses.teacher')),
            ],
            options={
                'db_table': 'course_schedule_item',
                'ordering': ['day_of_week', 'period'],
            },
        ),
        migrations.CreateModel(
            name='Student',
            fields=[
                ('id', models.BigAutoField(
                    auto_created=True, primary_key=True,
                    serialize=False, verbose_name='ID')),
                ('student_no', models.CharField(
                    blank=True, default='', max_length=50)),
                ('name', models.CharField(
                    blank=True, default='', max_length=50)),
                ('grade', models.CharField(
                    blank=True, default='', max_length=20)),
                ('class_identification', models.CharField(
                    blank=True, default='', max_length=200)),
                ('major', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to='courses.major')),
            ],
            options={
                'db_table': 'student',
                'ordering': ['grade', 'major'],
            },
        ),
    ]
