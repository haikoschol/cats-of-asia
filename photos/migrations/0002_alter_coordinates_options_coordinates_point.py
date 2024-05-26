# Generated by Django 5.0.3 on 2024-05-26 04:49

import django.contrib.gis.db.models.fields
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('photos', '0001_initial'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='coordinates',
            options={'verbose_name_plural': 'Coordinates'},
        ),
        migrations.AddField(
            model_name='coordinates',
            name='point',
            field=django.contrib.gis.db.models.fields.PointField(default='POINT(0.0 0.0)', geography=True, srid=4326),
        ),
    ]
