from django.urls import path

from . import views

app_name = "csv_detective"
urlpatterns = [
    path("", views.index, name="index"),
    path("analyze/", views.analyze, name="analyze"),
    path("clean/", views.clean, name="clean"),
]
