from django.urls import path

from . import views

app_name = "typerush"
urlpatterns = [
    path("", views.index, name="index"),
    path("passage/", views.passage, name="passage"),
    path("stats/", views.stats, name="stats"),
    path("results/", views.save_result, name="save_result"),
]
