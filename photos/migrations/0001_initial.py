# SPDX-FileCopyrightText: 2023 Haiko Schol
# SPDX-License-Identifier: GPL-3.0-or-later

# Generated by Django 5.0 on 2023-12-21 07:04

import django.db.models.deletion
from django.db import migrations, models


def seed_platforms(_apps, _schema_editor):
    from ..models import Platform
    Platform.objects.create(name='Mastodon', profile_url='https://botsin.space/@CatsOfAsia')
    Platform.objects.create(name='X', profile_url='https://x.com/CatsOfAsia')


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Coordinates',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('latitude', models.FloatField()),
                ('longitude', models.FloatField()),
                ('altitude', models.FloatField()),
            ],
        ),
        migrations.CreateModel(
            name='Location',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('city', models.TextField()),
                ('country', models.TextField()),
                ('tzoffset', models.IntegerField()),
            ],
        ),
        migrations.CreateModel(
            name='Photo',
            fields=[
                ('id', models.UUIDField(editable=False, primary_key=True, serialize=False)),
                ('filename', models.CharField(max_length=255)),
                ('sha256', models.CharField(max_length=64, unique=True)),
                ('timestamp', models.DateTimeField()),
            ],
        ),
        migrations.CreateModel(
            name='Platform',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.TextField(unique=True)),
                ('profile_url', models.URLField(unique=True)),
            ],
        ),
        migrations.CreateModel(
            name='Post',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name='RawMetadata',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('metadata', models.JSONField()),
            ],
        ),
        migrations.AddConstraint(
            model_name='location',
            constraint=models.UniqueConstraint(fields=('city', 'country'), name='unique_city_country'),
        ),
        migrations.AddField(
            model_name='coordinates',
            name='location',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='photos.location'),
        ),
        migrations.AddField(
            model_name='photo',
            name='coordinates',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to='photos.coordinates'),
        ),
        migrations.AddField(
            model_name='post',
            name='photo',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='photos.photo', to_field='sha256'),
        ),
        migrations.AddField(
            model_name='post',
            name='platform',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='photos.platform'),
        ),
        migrations.AddField(
            model_name='rawmetadata',
            name='photo',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='photos.photo', to_field='sha256'),
        ),
        migrations.AddConstraint(
            model_name='coordinates',
            constraint=models.UniqueConstraint(fields=('latitude', 'longitude', 'altitude'), name='unique_latitude_longitude_altitude'),
        ),
        migrations.AddConstraint(
            model_name='post',
            constraint=models.UniqueConstraint(fields=('photo', 'platform'), name='unique_photo_platform'),
        ),
        migrations.RunPython(seed_platforms),
    ]
