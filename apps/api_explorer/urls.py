from django.urls import path

from . import views

app_name = "api_explorer"
urlpatterns = [
    path("", views.index, name="index"),
    path("send/", views.send, name="send"),
    path("history/", views.history, name="history"),
    path("saved/", views.saved, name="saved"),
    path("saved/<int:pk>/", views.delete_saved, name="delete_saved"),
]
