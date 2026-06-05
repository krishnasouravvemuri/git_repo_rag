from django.urls import path

from .views import (
    AskView,
    IngestRepoView,
    LoginView,
    RegisterView,
    RepoListView,
)

urlpatterns = [
    path("register", RegisterView.as_view(), name="register"),
    path("login", LoginView.as_view(), name="login"),
    path("ingest", IngestRepoView.as_view(), name="ingest_repo"),
    path("repos", RepoListView.as_view(), name="repo_list"),
    path("ask", AskView.as_view(), name="ask"),
]
