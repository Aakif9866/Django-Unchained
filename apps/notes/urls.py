from django.urls import path

from . import views

app_name = "notes"
urlpatterns = [
    path("", views.index, name="index"),
    path("items/", views.notes, name="items"),
    path("items/<int:pk>/", views.note_detail, name="item"),
]
