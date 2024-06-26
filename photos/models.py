# SPDX-FileCopyrightText: 2023 Haiko Schol
# SPDX-License-Identifier: GPL-3.0-or-later

from django.db import connection
from django.contrib.gis.db import models


class Location(models.Model):
    city = models.TextField()
    country = models.TextField()
    tzoffset = models.IntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['city', 'country'], name='unique_city_country'),
        ]

    def __str__(self):
        if self.city and self.country:
            return f'{self.city}, {self.country}'
        if self.country:
            return self.country
        return 'an undisclosed location'


class Coordinates(models.Model):
    point = models.PointField(geography=True, default='POINT(0.0 0.0)')
    altitude = models.FloatField()
    location = models.ForeignKey(Location, on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['point', 'altitude'],
                name='unique_point_altitude',
            ),
        ]
        verbose_name_plural = 'Coordinates'

    def __str__(self):
        return f'{self.point.y},{self.point.x},{self.altitude} in {self.location}'


class Photo(models.Model):
    id = models.UUIDField(primary_key=True, editable=False)  # UUID created by Cloudflare Images
    filename = models.CharField(max_length=255)
    sha256 = models.CharField(max_length=64, unique=True)
    timestamp = models.DateTimeField()
    coordinates = models.ForeignKey(Coordinates, null=True, on_delete=models.SET_NULL)

    def __str__(self):
        return f'{self.filename} ({self.coordinates.location})'


class RawMetadata(models.Model):
    metadata = models.JSONField()
    photo = models.ForeignKey(Photo, to_field='sha256', on_delete=models.CASCADE)


class Platform(models.Model):
    name = models.TextField(unique=True)
    profile_url = models.URLField(unique=True)

    def __str__(self):
        return self.name

    def get_unused_photo(self) -> Photo:
        # Just use squeel!
        query = """
            SELECT p.*
            FROM photos_photo p
            WHERE p.sha256 NOT IN (
                SELECT po.photo_id
                FROM photos_post po
                INNER JOIN photos_platform pl ON po.platform_id = pl.id
                WHERE pl.id = %s
            )
            ORDER BY RANDOM()
            LIMIT 1;
        """

        with connection.cursor() as cursor:
            cursor.execute(query, [self.id])
            result = cursor.fetchone()

        if result:
            return Photo(*result)

        raise RuntimeError(f"Ran out of content for {self.name}! 😱")


class Post(models.Model):
    photo = models.ForeignKey(Photo, to_field='sha256', on_delete=models.CASCADE)
    platform = models.ForeignKey(Platform, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['photo', 'platform'], name='unique_photo_platform'),
        ]

    def __str__(self):
        return f'{self.platform}: {self.photo.filename} on {self.created_at}'
