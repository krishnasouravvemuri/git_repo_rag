from typing import Optional, Tuple, Dict, Any

from django.conf import settings
from django.db import models
from django.utils import timezone
from rest_framework import status

from .rag_search import RAGSearch
from .repo_ingest import ingest_repo, parse_repo_owner


class RepoIngestion(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="repos",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=255, blank=True, default="")
    repo_id = models.CharField(max_length=36, unique=True)
    repo_url = models.URLField()
    repo_owner = models.CharField(max_length=255)
    branch = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)

    @classmethod
    def ingest(
        cls,
        repo_url: Optional[str],
        persist_dir: str = "data",
        branch: Optional[str] = None,
        title: Optional[str] = None,
        user=None,
    ) -> Tuple[Dict[str, Any], int, str]:
        if not repo_url:
            message = "repo_url is required."
            return {"error": message}, status.HTTP_400_BAD_REQUEST, message

        try:
            repo_id = ingest_repo(repo_url=repo_url, persist_dir=persist_dir, branch=branch)
        except ValueError as exc:
            message = str(exc)
            return {"error": message}, status.HTTP_400_BAD_REQUEST, message

        repo_owner = parse_repo_owner(repo_url)
        ingestion = cls.objects.create(
            user=user,
            title=title or "",
            repo_id=repo_id,
            repo_url=repo_url,
            repo_owner=repo_owner,
            branch=branch,
        )
        return {
            "repo_id": ingestion.repo_id,
            "title": ingestion.title,
        }, status.HTTP_200_OK, ""

    @classmethod
    def list_for_user(cls, user) -> Tuple[Dict[str, Any], int, str]:
        repos = cls.objects.filter(user=user).order_by("-created_at")
        data = [
            {
                "repo_id": r.repo_id,
                "title": r.title,
                "repo_url": r.repo_url,
                "repo_owner": r.repo_owner,
                "branch": r.branch,
                "created_at": r.created_at.isoformat(),
            }
            for r in repos
        ]
        return {"repos": data}, status.HTTP_200_OK, ""


class RepoQuestion(models.Model):
    repo = models.ForeignKey(
        RepoIngestion,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="questions",
    )
    question = models.TextField()
    answer = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)

    @classmethod
    def ask(
        cls,
        question: Optional[str],
        repo_id: Optional[str] = None,
        persist_dir: str = "data",
    ) -> Tuple[Dict[str, Any], int, str]:
        if not question:
            message = "question is required."
            return {"error": message}, status.HTTP_400_BAD_REQUEST, message

        rag = RAGSearch(persist_dir=persist_dir)
        answer, _ = rag.answer(question, repo_id=repo_id)

        repo = None
        if repo_id:
            repo = RepoIngestion.objects.filter(repo_id=repo_id).first()

        cls.objects.create(repo=repo, question=question, answer=answer)
        return {"answer": answer}, status.HTTP_200_OK, ""
