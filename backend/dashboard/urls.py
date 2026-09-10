from django.urls import path

from . import views

urlpatterns = [
    path('phase2/', views.Phase2DashboardView.as_view()),
]
