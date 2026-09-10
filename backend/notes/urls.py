from django.urls import path

from . import views

urlpatterns = [
    path('', views.NoteListCreateView.as_view()),
    path('<str:pk>/', views.NoteDetailView.as_view()),
]
