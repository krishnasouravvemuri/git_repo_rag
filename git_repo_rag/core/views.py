from django.contrib.auth.models import User
from django.http import HttpResponse
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from rest_framework.parsers import FormParser, MultiPartParser

from .models import Conversation, RepoIngestion, RepoQuestion
from .transcribe import VoiceSynthesizer, VoiceTranscriber
from utils.response import ApiResponse

DATA_DIR = "data"


def _tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        password = request.data.get("password")

        if not email or not password:
            msg = "email and password are required."
            return ApiResponse({"error": msg}, status.HTTP_400_BAD_REQUEST, msg).build()

        if User.objects.filter(username=email).exists():
            msg = "User already exists."
            return ApiResponse({"error": msg}, status.HTTP_400_BAD_REQUEST, msg).build()

        user = User.objects.create_user(username=email, email=email, password=password)
        data = {"email": user.email, **_tokens_for(user)}
        return ApiResponse(data, status.HTTP_201_CREATED, "Registered").build()


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        password = request.data.get("password")

        from django.contrib.auth import authenticate
        user = authenticate(username=email, password=password)
        if user is None:
            msg = "Invalid credentials."
            return ApiResponse({"error": msg}, status.HTTP_401_UNAUTHORIZED, msg).build()

        data = {"email": user.email, **_tokens_for(user)}
        return ApiResponse(data, status.HTTP_200_OK, "Logged in").build()


class IngestRepoView(APIView):
    def post(self, request):
        response_data, status_code, message = RepoIngestion.ingest(
            repo_url=request.data.get("repo_url"),
            persist_dir=DATA_DIR,
            branch=request.data.get("branch"),
            title=request.data.get("title"),
            user=request.user,
        )
        return ApiResponse(response_data=response_data, status_code=status_code, message=message).build()


class RepoListView(APIView):
    def get(self, request):
        response_data, status_code, message = RepoIngestion.list_for_user(request.user)
        return ApiResponse(response_data=response_data, status_code=status_code, message=message).build()


class TranscribeView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        response_data, status_code, message = VoiceTranscriber().transcribe(
            audio_file=request.FILES.get("audio"),
        )
        return ApiResponse(response_data=response_data, status_code=status_code, message=message).build()


class AskView(APIView):
    def post(self, request):
        response_data, status_code, message = RepoQuestion.ask(
            question=request.data.get("question"),
            repo_id=request.data.get("repo_id"),
            persist_dir=DATA_DIR,
            user=request.user,
        )
        return ApiResponse(response_data=response_data, status_code=status_code, message=message).build()


class QuestionListView(APIView):
    def get(self, request):
        response_data, status_code, message = RepoQuestion.list_for_user(request.user)
        return ApiResponse(response_data=response_data, status_code=status_code, message=message).build()


class QuestionDetailView(APIView):
    def delete(self, request, question_id):
        response_data, status_code, message = RepoQuestion.delete_for_user(request.user, question_id)
        return ApiResponse(response_data=response_data, status_code=status_code, message=message).build()


class ConversationListView(APIView):
    def get(self, request):
        response_data, status_code, message = Conversation.list_for_user(request.user)
        return ApiResponse(response_data=response_data, status_code=status_code, message=message).build()

    def post(self, request):
        response_data, status_code, message = Conversation.start(
            user=request.user,
            repo_id=request.data.get("repo_id"),
            title=request.data.get("title"),
        )
        return ApiResponse(response_data=response_data, status_code=status_code, message=message).build()


class ConversationDetailView(APIView):
    def get(self, request, conversation_id):
        conv = Conversation.objects.filter(id=conversation_id, user=request.user).first()
        if conv is None:
            return ApiResponse({"error": "Not found."}, status.HTTP_404_NOT_FOUND, "Not found.").build()
        response_data, status_code, message = conv.detail()
        return ApiResponse(response_data=response_data, status_code=status_code, message=message).build()

    def delete(self, request, conversation_id):
        deleted, _ = Conversation.objects.filter(id=conversation_id, user=request.user).delete()
        if not deleted:
            return ApiResponse({"error": "Not found."}, status.HTTP_404_NOT_FOUND, "Not found.").build()
        return ApiResponse({"deleted": conversation_id}, status.HTTP_200_OK, "Deleted").build()


class ConversationTurnView(APIView):
    def post(self, request, conversation_id):
        conv = Conversation.objects.filter(id=conversation_id, user=request.user).first()
        if conv is None:
            return ApiResponse({"error": "Not found."}, status.HTTP_404_NOT_FOUND, "Not found.").build()
        response_data, status_code, message = conv.add_turn(
            question=request.data.get("question"),
            persist_dir=DATA_DIR,
        )
        return ApiResponse(response_data=response_data, status_code=status_code, message=message).build()


class SpeakView(APIView):
    def post(self, request):
        audio, status_code, message = VoiceSynthesizer().synthesize(request.data.get("text"))
        if audio is None:
            return ApiResponse({"error": message}, status_code, message).build()
        return HttpResponse(audio, content_type="audio/wav", status=status_code)
