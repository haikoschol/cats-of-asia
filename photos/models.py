# SPDX-FileCopyrightText: 2023 Haiko Schol
# SPDX-License-Identifier: GPL-3.0-or-later

from django.db import models


class Location(models.Model):
    city = models.TextField()
    country = models.TextField()
    tzoffset = models.IntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['city', 'country'], name='unique_city_country'),
        ]


class Coordinates(models.Model):
    latitude = models.FloatField()
    longitude = models.FloatField()
    altitude = models.FloatField()
    location = models.ForeignKey(Location, on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['latitude', 'longitude', 'altitude'],
                name='unique_latitude_longitude_altitude',
            ),
        ]


class Photo(models.Model):
    id = models.UUIDField(primary_key=True, editable=False)  # UUID created by Cloudflare Images
    filename = models.CharField(max_length=255)
    sha256 = models.CharField(max_length=64, unique=True)
    timestamp = models.DateTimeField()
    coordinates = models.ForeignKey(Coordinates, null=True, on_delete=models.SET_NULL)


class RawMetadata(models.Model):
    metadata = models.JSONField()
    photo = models.ForeignKey(Photo, to_field='sha256', on_delete=models.CASCADE)


class Platform(models.Model):
    name = models.TextField(unique=True)
    profile_url = models.URLField(unique=True)


class Post(models.Model):
    photo = models.ForeignKey(Photo, to_field='sha256', on_delete=models.CASCADE)
    platform = models.ForeignKey(Platform, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['photo', 'platform'], name='unique_photo_platform'),
        ]
