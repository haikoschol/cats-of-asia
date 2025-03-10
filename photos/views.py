# SPDX-FileCopyrightText: 2023 Haiko Schol
# SPDX-License-Identifier: GPL-3.0-or-later
import datetime
import json
import urllib.request
import uuid

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D
from django.shortcuts import render
from django.views.decorators.http import require_http_methods
from jsonrpc.backend.django import api
from pydantic import BaseModel

from photos.models import Photo, Coordinates, Location, RawMetadata
from photos.utils import get_photos, add_authed_method

DEFAULT_ZOOM = 15
MAX_ZOOM = 22
DEFAULT_RADIUS = 12


@require_http_methods(['GET'])
def index(request):
    return render(request, 'photos/index.html', {
        'photos': json.dumps(get_photos()),
        'default_zoom': DEFAULT_ZOOM,
        'max_zoom': MAX_ZOOM,
        'default_radius': DEFAULT_RADIUS,
        'access_token': settings.MAPBOX_ACCESS_TOKEN,
    })


@require_http_methods(['GET'])
def near_me(request):
    return render(request, 'photos/nearme.html')


@api.dispatcher.add_method
def get_closest_photos(request, latitude: float, longitude: float, limit: int = 10, max_distance_km: int = 10):
    user_location = Point(longitude, latitude, srid=4326)  # Note the order: longitude, latitude

    closest_photos = Photo.objects.filter(
        coordinates__point__distance_lte=(user_location, D(km=max_distance_km))
    ).annotate(
        distance=Distance('coordinates__point', user_location)
    ).order_by('distance')[:limit]

    return get_photos(closest_photos)


@require_http_methods(['GET'])
def favorites(request):
    return render(request, 'photos/favorites.html', {'photos': json.dumps(get_photos())})


@require_http_methods(['GET'])
@login_required
def upload(request):
    return render(request, 'photos/upload.html')


@add_authed_method
def photo_exists(request, sha256: str) -> bool:
    return Photo.objects.filter(sha256=sha256).first() is not None


CITY_CANDIDATES = {'locality', 'colloquial_area', 'administrative_area_level_1', 'administrative_area_level_2',
                   'administrative_area_level_3', 'administrative_area_level_4', 'administrative_area_level_5'}

URL_TMPL = 'https://maps.googleapis.com/maps/api/geocode/json?language=en&latlng={latitude},{longitude}\
&key={api_key}&result_type=country|%s' % '|'.join(CITY_CANDIDATES)


@add_authed_method
def get_location(request, latitude: float, longitude: float) -> dict[str, object]:
    p = Point(longitude, latitude, srid=4326)
    coords = Coordinates.objects.filter(point=p).first()

    if coords:
        payload = {'city': coords.location.city, 'country': coords.location.country}
    else:
        url = URL_TMPL.format(latitude=latitude, longitude=longitude, api_key=settings.GOOGLE_MAPS_API_KEY)
        country, city_candidates = None, set()

        with urllib.request.urlopen(url) as response:
            results = [r['address_components'] for r in json.load(response)['results']]
            addrcomponents = [i for row in results for i in row]

            for ac in addrcomponents:
                if CITY_CANDIDATES.intersection(set(ac['types'])):
                    city_candidates.add(ac['long_name'])
                if country is None and 'country' in ac['types']:
                    country = ac['long_name']

        payload = {'cityCandidates': sorted(list(city_candidates)), 'country': country}
        if len(payload['cityCandidates']) == 1:
            payload['city'] = payload['cityCandidates'][0]

    return payload


@add_authed_method
def create_upload_url(request):
    url = 'https://api.cloudflare.com/client/v4/accounts/{}/images/v2/direct_upload'.format(
        settings.CLOUDFLARE_IMAGES_ACCOUNT_ID)

    request = urllib.request.Request(url=url, method='POST')
    request.add_header('Authorization', f'Bearer {settings.CLOUDFLARE_IMAGES_API_KEY}')

    with urllib.request.urlopen(request) as response:
        return json.load(response)['result']


class PhotoMetadata(BaseModel):
    id: uuid.UUID
    filename: str
    sha256: str
    latitude: float
    longitude: float
    altitude: float
    city: str
    country: str
    tzoffset: int
    timestamp: datetime.datetime
    raw: dict[str, object]


@add_authed_method
def add_photo(request, metadata: dict[str, object]):
    pm = PhotoMetadata(**metadata)
    p = Point(pm.longitude, pm.latitude, srid=4326)
    coords = Coordinates.objects.filter(point=p).first()

    if not coords:
        loc = Location.objects.filter(
            city=pm.city,
            country=pm.country,
        ).first()

        if not loc:
            loc = Location.objects.create(
                city=pm.city,
                country=pm.country,
                tzoffset=pm.tzoffset, # this is probably wrong
            )

        coords = Coordinates.objects.create(
            point=p,
            altitude=pm.altitude,
            location=loc,
        )

    photo = Photo.objects.create(
        id=pm.id,
        filename=pm.filename,
        sha256=pm.sha256,
        timestamp=pm.timestamp,
        coordinates=coords,
    )

    RawMetadata.objects.create(metadata=pm.raw, photo=photo)
    return {'id': str(photo.id), 'success': True}
