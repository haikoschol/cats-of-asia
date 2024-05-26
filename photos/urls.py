# SPDX-FileCopyrightText: 2023 Haiko Schol
# SPDX-License-Identifier: GPL-3.0-or-later

from django.urls import path

from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('nearme', views.near_me, name='nearme'),
    path('favorites', views.favorites, name='favorites'),
    path('upload', views.upload, name='upload'),
    path('create_upload_url', views.create_upload_url, name='create_upload_url'),
    path('add_photo', views.add_photo, name='add_photo'),
]
