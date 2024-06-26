# Generated by Django 5.0.3 on 2024-05-26 05:00

from django.db import migrations
from django.contrib.gis.geos import Point


def migrate_coords(apps, _schema_editor):
    Coordinates = apps.get_model(app_label='photos', model_name='Coordinates')
    for c in Coordinates.objects.all():
        c.point = Point(x=c.longitude, y=c.latitude)
        c.save()


class Migration(migrations.Migration):

    dependencies = [
        ('photos', '0002_alter_coordinates_options_coordinates_point'),
    ]

    operations = [
        migrations.RunPython(migrate_coords),
    ]
