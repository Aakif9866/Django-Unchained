from django.urls import path

from . import views

urlpatterns = [
    path('', views.NoteListCreateView.as_view()),
    path('<int:pk>/', views.NoteDetailView.as_view()),
]
