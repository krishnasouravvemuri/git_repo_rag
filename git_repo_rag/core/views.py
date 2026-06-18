from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from rest_framework.parsers import FormParser, MultiPartParser

from .models import RepoIngestion, RepoQuestion
from .transcribe import VoiceTranscriber
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
        )
        return ApiResponse(response_data=response_data, status_code=status_code, message=message).build()
