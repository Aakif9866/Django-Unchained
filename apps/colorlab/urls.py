from django.urls import path

from . import views

app_name = "colorlab"
urlpatterns = [
    path("", views.index, name="index"),
    path("palettes/", views.palettes, name="palettes"),
    path("palettes/<int:pk>/", views.delete_palette, name="delete_palette"),
]
