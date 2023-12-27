# SPDX-FileCopyrightText: 2023 Haiko Schol
# SPDX-License-Identifier: GPL-3.0-or-later

import json
import urllib

from django.conf import settings
from django.shortcuts import render
from django.views.decorators.http import require_http_methods

from jsonrpc.backend.django import api

from photos.models import Photo, Coordinates, Location, RawMetadata

DEFAULT_ZOOM = 15
MAX_ZOOM = 22
DEFAULT_RADIUS = 12


def mkurls(photo: Photo) -> dict[str, str]:
    base = 'https://{}/cdn-cgi/imagedelivery/{}/{}'.format(
        settings.CLOUDFLARE_IMAGES_DOMAIN,
        settings.CLOUDFLARE_IMAGES_ACCOUNT_HASH,
        photo.id,
    )

    return {
        'popup': f'{base}/popup',
        'favorite': f'{base}/favorite',
        'desktop': f'{base}/desktop',
        'mobile': f'{base}/mobile',
    }


# https://catsof.asia/cdn-cgi/imagedelivery/<account_id>/7a430cf5-9755-417f-e4fd-aa4ace106b00/mobile
def get_photos():
    photos = Photo.objects.select_related('coordinates__location').all()
    return [
        {
            'sha256': p.sha256,
            'timestamp': p.timestamp.isoformat(),
            'latitude': p.coordinates.latitude,
            'longitude': p.coordinates.longitude,
            'city': p.coordinates.location.city,
            'country': p.coordinates.location.country,
            'urls': mkurls(p),
        }
        for p in photos
    ]


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
def favorites(request):
    return render(request, 'photos/favorites.html', {'photos': json.dumps(get_photos())})


# TODO require auth
@require_http_methods(['GET'])
def upload(request):
    return render(request, 'photos/upload.html')


@api.dispatcher.add_method # create wrapper that requires auth and csrf token
def photo_exists(request, sha256: str) -> bool:
    return Photo.objects.filter(sha256=sha256).first() is not None


CITY_CANDIDATES = {'locality', 'colloquial_area', 'administrative_area_level_1', 'administrative_area_level_2',
                   'administrative_area_level_3', 'administrative_area_level_4', 'administrative_area_level_5'}

URL_TMPL = 'https://maps.googleapis.com/maps/api/geocode/json?language=en&latlng={latitude},{longitude}\
&key={api_key}&result_type=country|%s' % '|'.join(CITY_CANDIDATES)


@api.dispatcher.add_method
def get_location(request, latitude: float, longitude: float) -> dict[str, object]:
    coords = Coordinates.objects.filter(latitude=latitude, longitude=longitude).first()

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


@api.dispatcher.add_method
def create_upload_url(request):
    url = 'https://api.cloudflare.com/client/v4/accounts/{}/images/v2/direct_upload'.format(
        settings.CLOUDFLARE_IMAGES_ACCOUNT_ID)

    # TODO set expiry to now + 2min
    # https://developers.cloudflare.com/api/operations/cloudflare-images-create-authenticated-direct-upload-url-v-2
    request = urllib.request.Request(url=url, method='POST', data=None)
    request.add_header('Authorization', f'Bearer {settings.CLOUDFLARE_IMAGES_API_KEY}')

    with urllib.request.urlopen(request) as response:
        return json.load(response)['result']


@api.dispatcher.add_method
def add_photo(request, metadata: dict[str, object]):
    coords = Coordinates.objects.filter(latitude=metadata['latitude'], longitude=metadata['longitude']).first()

    if not coords:
        loc, _ = Location.objects.get_or_create(
            city=metadata['city'],
            country=metadata['country'],
            tzoffset=metadata['tzoffset'],
        )

        coords = Coordinates.objects.create(
            latitude=metadata['latitude'],
            longitude=metadata['longitude'],
            altitude=metadata['altitude'],
            location=loc,
        )

    photo = Photo.objects.create(
        id=metadata['id'],
        filename=metadata['filename'],
        sha256=metadata['sha256'],
        timestamp=metadata['timestamp'],
        coordinates=coords,
    )

    RawMetadata.objects.create(metadata=metadata['raw'], photo=photo)
