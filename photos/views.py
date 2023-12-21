import json

from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render

from photos.models import Photo, Coordinates, Location

DEFAULT_ZOOM = 15
MAX_ZOOM = 22
DEFAULT_RADIUS = 12


def get_photos():
    photos = Photo.objects.select_related('coordinates__location').all()
    return [
        {
            'id': p.id,
            'urlLarge': p.url_large,
            'urlMedium': p.url_medium,
            'urlSmall': p.url_small,
            'sha256': p.sha256,
            'date': p.date.strftime('%Y-%m-%dT00:00:00+00:00'),
            'latitude': p.coordinates.latitude,
            'longitude': p.coordinates.longitude,
            'city': p.coordinates.location.city,
            'country': p.coordinates.location.country,
        }
        for p in photos
    ]


def index(request):
    return render(request, 'photos/index.html', {
        'photos': json.dumps(get_photos()),
        'default_zoom': DEFAULT_ZOOM,
        'max_zoom': MAX_ZOOM,
        'default_radius': DEFAULT_RADIUS,
        'access_token': settings.MAPBOX_ACCESS_TOKEN,
    })


def favorites(request):
    return render(request, 'photos/favorites.html', {'photos': json.dumps(get_photos())})


# TODO require auth
def upload(request):
    return render(request, 'photos/upload.html')


# TODO require auth
def location(request, latitude, longitude):
    coords = Coordinates.objects.filter(latitude=latitude, longitude=longitude).first()
    if not coords:
        return HttpResponse(status=404)

    return JsonResponse({'city': coords.location.city, 'country': coords.location.country})


# TODO require auth
# TODO require POST
def reverse_geocode(request, latitude, longitude, tzoffset):
    return HttpResponse(status=500)
