from http import HTTPStatus

from django.conf import settings
from django.http import HttpRequest
from django.middleware.csrf import CsrfViewMiddleware, RejectRequest
from jsonrpc.backend.django import api
from jsonrpc.exceptions import JSONRPCDispatchException

from photos.models import Photo


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


def get_photos() -> list[dict[str, object]]:
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


def add_authed_method(f: callable):
    def wrapper(request: HttpRequest, *args, **kwargs):
        m = CsrfViewMiddleware(lambda _: None)

        try:
            m._check_token(request)
        except RejectRequest:
            raise JSONRPCDispatchException(
                code=HTTPStatus.FORBIDDEN,
                message='permission denied'
            )

        # TODO enable together with user management
        # if not request.user.is_authenticated:
        #     raise JSONRPCDispatchException(
        #         code=HTTPStatus.UNAUTHORIZED,
        #         message='requires authentication'
        #     )

        return f(request, *args, **kwargs)

    return api.dispatcher.add_method(wrapper, name=f.__name__)
