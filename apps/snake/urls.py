from django.urls import path

from . import views

app_name = "snake"
urlpatterns = [
    path("", views.index, name="index"),
    path("board/", views.board, name="board"),
    path("scores/", views.save_score, name="save_score"),
]
