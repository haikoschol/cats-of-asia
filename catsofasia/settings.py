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

IS_DEVSERVER = len(sys.argv) >= 2 and sys.argv[1] == 'runserver'

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent
environ.Env.read_env(BASE_DIR / ".env")

MAPBOX_ACCESS_TOKEN = env('MAPBOX_ACCESS_TOKEN')
CLOUDFLARE_IMAGES_DOMAIN = env('CLOUDFLARE_IMAGES_DOMAIN')
CLOUDFLARE_IMAGES_ACCOUNT_HASH = env('CLOUDFLARE_IMAGES_ACCOUNT_HASH')
CLOUDFLARE_IMAGES_API_KEY = env('CLOUDFLARE_IMAGES_API_KEY')
GOOGLE_MAPS_API_KEY = env('GOOGLE_MAPS_API_KEY')
SECRET_KEY = env('SECRET_KEY')
DEBUG = env('DEBUG')
try:
    ALLOWED_HOSTS = env('ALLOWED_HOSTS').split(',')
except ImproperlyConfigured:
    ALLOWED_HOSTS = []

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django_unicorn",
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

STATICFILES_DIRS = [
    BASE_DIR / "static",
]

if IS_DEVSERVER:
    STATIC_URL = '/static/'
else:
    STATIC_URL = env('STATIC_URL')

    STORAGES = {
        "staticfiles": {
            "BACKEND": "storages.backends.s3.S3Storage",
            "OPTIONS": {
                'bucket_name': env('AWS_STORAGE_BUCKET_NAME'),
                'endpoint_url': env('AWS_S3_ENDPOINT_URL'),
            },
        },
    }

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
