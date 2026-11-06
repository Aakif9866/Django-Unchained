from django.urls import path

from . import views

app_name = "regex_playground"
urlpatterns = [
    path("", views.index, name="index"),
    path("patterns/", views.patterns, name="patterns"),
    path("patterns/<int:pk>/", views.delete_pattern, name="delete_pattern"),
]
