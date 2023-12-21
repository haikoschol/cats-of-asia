from django.urls import path

from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('favorites', views.favorites, name='favorites'),
    path('upload', views.upload, name='upload'),

    # TODO add converter to float
    # https://docs.djangoproject.com/en/5.0/topics/http/urls/#registering-custom-path-converters
    path('location/<latitude>/<longitude>/', views.location, name='location'),

]
