from django.urls import path

from .views import (
    AskView,
    ConversationDetailView,
    ConversationListView,
    ConversationTurnView,
    IngestRepoView,
    LoginView,
    QuestionDetailView,
    QuestionListView,
    RegisterView,
    RepoListView,
    SpeakView,
    TranscribeView,
)

urlpatterns = [
    path("register", RegisterView.as_view(), name="register"),
    path("login", LoginView.as_view(), name="login"),
    path("ingest", IngestRepoView.as_view(), name="ingest_repo"),
    path("repos", RepoListView.as_view(), name="repo_list"),
    path("ask", AskView.as_view(), name="ask"),
    path("transcribe", TranscribeView.as_view(), name="transcribe"),
    path("speak", SpeakView.as_view(), name="speak"),
    path("questions", QuestionListView.as_view(), name="question_list"),
    path("questions/<int:question_id>", QuestionDetailView.as_view(), name="question_detail"),
    path("conversations", ConversationListView.as_view(), name="conversation_list"),
    path("conversations/<int:conversation_id>", ConversationDetailView.as_view(), name="conversation_detail"),
    path("conversations/<int:conversation_id>/turn", ConversationTurnView.as_view(), name="conversation_turn"),
]
