from django.urls import path

from . import views

app_name = "core"
urlpatterns = [
    path("", views.home, name="home"),
    path("dashboard/", views.dashboard, name="dashboard"),
    path("favourites/<slug:slug>/toggle/", views.favourite_toggle, name="favourite_toggle"),
]
