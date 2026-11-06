from django.urls import path

from . import views

app_name = "watch_roulette"
urlpatterns = [
    path("", views.index, name="index"),
    path("titles/", views.titles, name="titles"),
    path("titles/<int:pk>/", views.title_detail, name="title_detail"),
]
