from django.urls import path

from . import views

app_name = "focusquest"
urlpatterns = [
    path("", views.index, name="index"),
    path("state/", views.state, name="state"),
    path("start/", views.start, name="start"),
    path("sessions/<int:pk>/complete/", views.complete, name="complete"),
    path("abandon/", views.abandon, name="abandon"),
]
