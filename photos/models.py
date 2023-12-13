from django.db import models


class Location(models.Model):
    city = models.TextField()
    country = models.TextField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['city', 'country'], name='unique_city_country'),
        ]


class Coordinates(models.Model):
    latitude = models.FloatField()
    longitude = models.FloatField()
    location = models.ForeignKey(Location, on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['latitude', 'longitude'], name='unique_latitude_longitude'),
        ]


class Photo(models.Model):
    url_small = models.URLField()
    url_medium = models.URLField()
    url_large = models.URLField()
    sha256 = models.CharField(max_length=64, unique=True)
    date = models.DateField()
    coordinates = models.ForeignKey(Coordinates, on_delete=models.CASCADE)


class Platform(models.Model):
    name = models.TextField(unique=True)
    profile_url = models.URLField(unique=True)


class Post(models.Model):
    photo = models.ForeignKey(Photo, on_delete=models.CASCADE)
    platform = models.ForeignKey(Platform, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['photo', 'platform'], name='unique_photo_platform'),
        ]
