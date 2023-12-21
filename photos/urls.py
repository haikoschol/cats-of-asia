from django.urls import path

from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('favorites', views.favorites, name='favorites'),
    path('upload', views.upload, name='upload'),
    path('location/<float:latitude>/<float:longitude>/', views.location, name='location'),
]
