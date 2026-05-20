from django.urls import path

from .views import AskView, IngestRepoView

urlpatterns = [
    path("ingest", IngestRepoView.as_view(), name="ingest_repo"),
    path("ask", AskView.as_view(), name="ask"),
]
