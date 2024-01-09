"""
SPDX-FileCopyrightText: 2023 Haiko Schol
SPDX-License-Identifier: GPL-3.0-or-later

Django settings for catsofasia project.

For more information on this file, see
https://docs.djangoproject.com/en/5.0/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/5.0/ref/settings/
"""
import os
import sys
from pathlib import Path

import environ
from django.core.exceptions import ImproperlyConfigured

env = environ.Env(
    DEBUG=(bool, False)
)

# seemed like a good idea at first...
IS_DEVSERVER = len(sys.argv) >= 2 and sys.argv[1] == 'runserver'
IS_COLLECTSTATIC = len(sys.argv) >= 2 and sys.argv[1] == 'collectstatic'
IS_MIGRATE = len(sys.argv) >= 2 and sys.argv[1] == 'migrate'
IS_CRONJOB = len(sys.argv) >= 2 and sys.argv[1] == 'post_to_mastodon'
IS_GUNICORN = not (IS_DEVSERVER or IS_CRONJOB or IS_COLLECTSTATIC or IS_MIGRATE)

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent
environ.Env.read_env(BASE_DIR / ".env")

if IS_COLLECTSTATIC:
    STATIC_ROOT = "./collectedstatic"

if IS_DEVSERVER or IS_COLLECTSTATIC:
    STATIC_URL = '/static/'

# shared between dev server, gunicorn and cron job
if not (IS_COLLECTSTATIC or IS_MIGRATE):
    CLOUDFLARE_IMAGES_DOMAIN = env('CLOUDFLARE_IMAGES_DOMAIN')
    CLOUDFLARE_IMAGES_ACCOUNT_HASH = env('CLOUDFLARE_IMAGES_ACCOUNT_HASH')

if IS_CRONJOB:
    MASTODON_ACCESS_TOKEN = env('MASTODON_ACCESS_TOKEN')
    MASTODON_BASE_URL = env('MASTODON_BASE_URL')

if IS_DEVSERVER or IS_GUNICORN:
    MAPBOX_ACCESS_TOKEN = env('MAPBOX_ACCESS_TOKEN')
    CLOUDFLARE_IMAGES_ACCOUNT_ID = env('CLOUDFLARE_IMAGES_ACCOUNT_ID')
    CLOUDFLARE_IMAGES_API_KEY = env('CLOUDFLARE_IMAGES_API_KEY')
    GOOGLE_MAPS_API_KEY = env('GOOGLE_MAPS_API_KEY')

if IS_GUNICORN:
    STATIC_URL = env('STATIC_URL')

SECRET_KEY = env('SECRET_KEY')
DEBUG = env('DEBUG')
try:
    ALLOWED_HOSTS = env('ALLOWED_HOSTS').split(',')
    CSRF_TRUSTED_ORIGINS = [f'https://{h}' for h in ALLOWED_HOSTS]
except ImproperlyConfigured:
    ALLOWED_HOSTS = []

STATICFILES_DIRS = [
    BASE_DIR / "static",
]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "photos.apps.PhotosConfig"
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "catsofasia.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "catsofasia.wsgi.application"

DATABASES = {
    "default": env.db(),
}

# Password validation
# https://docs.djangoproject.com/en/5.0/ref/settings/#auth-password-validators
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
