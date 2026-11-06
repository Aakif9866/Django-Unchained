from django.urls import path

from . import views

app_name = "json_doctor"
urlpatterns = [path("", views.index, name="index")]
