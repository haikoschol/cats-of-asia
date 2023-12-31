from django.contrib import admin

from photos import models

admin.site.register(models.Location)
admin.site.register(models.Coordinates)
admin.site.register(models.Photo)
admin.site.register(models.RawMetadata)
admin.site.register(models.Platform)
admin.site.register(models.Post)
