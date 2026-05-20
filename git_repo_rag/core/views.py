from rest_framework.views import APIView

from .models import RepoIngestion, RepoQuestion
from utils.response import ApiResponse

DATA_DIR = "data"


class IngestRepoView(APIView):
    def post(self, request):
        response_data, status_code, message = RepoIngestion.ingest(
            repo_url=request.data.get("repo_url"),
            persist_dir=DATA_DIR,
            branch=request.data.get("branch"),
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
