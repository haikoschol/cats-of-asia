# SPDX-FileCopyrightText: 2023 Haiko Schol
# SPDX-License-Identifier: GPL-3.0-or-later
import datetime
import urllib.request

from django.conf import settings
from django.core.management.base import BaseCommand
from mastodon import Mastodon

from photos.models import Photo, Post, Platform
from photos.utils import mkurls

USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0'


class Command(BaseCommand):
    help = 'Posts a random cat photo to Mastodon'

    def handle(self, *_args, **_options):
        mastodon = Mastodon(
            access_token=settings.MASTODON_ACCESS_TOKEN,
            api_base_url=settings.MASTODON_BASE_URL,
        )

        platform = Platform.objects.filter(name__iexact='mastodon').first()
        photo = platform.get_unused_photo()
        url = mkurls(photo)['desktop']
        status = render_status(photo)

        request = urllib.request.Request(
            url=url,
            method='GET',
            headers={
                'User-Agent': USER_AGENT,
            }
        )

        with urllib.request.urlopen(request) as response:
            media = mastodon.media_post(
                response,
                file_name=photo.filename,
                mime_type=response.headers['Content-Type']
            )
            mastodon.status_post(status=status, media_ids=[media])

        Post.objects.create(photo=photo, platform=platform)
        self.stdout.write(self.style.SUCCESS('Successfully posted image to Mastodon'))


def render_status(photo: Photo) -> str:
    sign = -1 if photo.coordinates.location.tzoffset < 0 else 1
    td = datetime.timedelta(minutes=abs(photo.coordinates.location.tzoffset))
    tzinfo = datetime.timezone(sign * td)
    date = photo.timestamp.astimezone(tzinfo).strftime('%A, %B %-d %Y')

    return f'Another fine feline, captured in {photo.coordinates.location} on {date} #CatsOfAsia #CatsOfMastodon'
