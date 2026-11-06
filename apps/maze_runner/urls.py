from django.urls import path

from . import views

app_name = "maze_runner"
urlpatterns = [
    path("", views.index, name="index"),
    path("board/", views.board, name="board"),
    path("runs/", views.save_run, name="save_run"),
]
