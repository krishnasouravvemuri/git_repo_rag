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
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="questions",
        null=True,
        blank=True,
    )
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
        user=None,
    ) -> Tuple[Dict[str, Any], int, str]:
        if not question:
            message = "question is required."
            return {"error": message}, status.HTTP_400_BAD_REQUEST, message

        rag = RAGSearch(persist_dir=persist_dir)
        answer, _ = rag.answer(question, repo_id=repo_id)

        repo = None
        if repo_id:
            repo = RepoIngestion.objects.filter(repo_id=repo_id).first()

        q = cls.objects.create(user=user, repo=repo, question=question, answer=answer)
        return {
            "id": q.id,
            "answer": answer,
        }, status.HTTP_200_OK, ""

    @classmethod
    def list_for_user(cls, user) -> Tuple[Dict[str, Any], int, str]:
        rows = cls.objects.filter(user=user).order_by("-created_at")
        data = [
            {
                "id": r.id,
                "question": r.question,
                "answer": r.answer,
                "repo_id": r.repo.repo_id if r.repo else None,
                "repo": (r.repo.title or r.repo.repo_owner) if r.repo else None,
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ]
        return {"questions": data}, status.HTTP_200_OK, ""

    @classmethod
    def delete_for_user(cls, user, question_id) -> Tuple[Dict[str, Any], int, str]:
        deleted, _ = cls.objects.filter(user=user, id=question_id).delete()
        if not deleted:
            return {"error": "Not found."}, status.HTTP_404_NOT_FOUND, "Not found."
        return {"deleted": question_id}, status.HTTP_200_OK, "Deleted"


class Conversation(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="conversations",
        null=True,
        blank=True,
    )
    repo = models.ForeignKey(
        RepoIngestion,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="conversations",
    )
    title = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(default=timezone.now)

    @classmethod
    def start(
        cls,
        user,
        repo_id: Optional[str] = None,
        title: Optional[str] = None,
    ) -> Tuple[Dict[str, Any], int, str]:
        repo = RepoIngestion.objects.filter(repo_id=repo_id).first() if repo_id else None
        conv = cls.objects.create(user=user, repo=repo, title=title or "")
        return {"conversation_id": conv.id, "title": conv.title}, status.HTTP_201_CREATED, "Started"

    def add_turn(self, question: str, persist_dir: str = "data") -> Tuple[Dict[str, Any], int, str]:
        if not question:
            return {"error": "question is required."}, status.HTTP_400_BAD_REQUEST, "question is required."

        history = [
            {"role": m.role, "content": m.content}
            for m in self.messages.order_by("created_at")
        ]
        repo_id = self.repo.repo_id if self.repo else None

        rag = RAGSearch(persist_dir=persist_dir)
        answer, _ = rag.chat(question, history=history, repo_id=repo_id)

        ConversationMessage.objects.create(conversation=self, role="user", content=question)
        assistant_msg = ConversationMessage.objects.create(
            conversation=self, role="assistant", content=answer
        )

        # name the conversation from its first user message
        if not self.title:
            self.title = (question[:60] + "…") if len(question) > 60 else question
            self.save(update_fields=["title"])

        return {
            "conversation_id": self.id,
            "message_id": assistant_msg.id,
            "answer": answer,
        }, status.HTTP_200_OK, ""

    @classmethod
    def list_for_user(cls, user) -> Tuple[Dict[str, Any], int, str]:
        rows = cls.objects.filter(user=user).order_by("-created_at")
        data = [
            {
                "conversation_id": c.id,
                "title": c.title or "Untitled conversation",
                "repo_id": c.repo.repo_id if c.repo else None,
                "repo": (c.repo.title or c.repo.repo_owner) if c.repo else None,
                "message_count": c.messages.count(),
                "created_at": c.created_at.isoformat(),
            }
            for c in rows
        ]
        return {"conversations": data}, status.HTTP_200_OK, ""

    def detail(self) -> Tuple[Dict[str, Any], int, str]:
        messages = [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at.isoformat(),
            }
            for m in self.messages.order_by("created_at")
        ]
        return {
            "conversation_id": self.id,
            "title": self.title or "Untitled conversation",
            "repo_id": self.repo.repo_id if self.repo else None,
            "messages": messages,
        }, status.HTTP_200_OK, ""


class ConversationMessage(models.Model):
    ROLE_CHOICES = (("user", "user"), ("assistant", "assistant"))

    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    role = models.CharField(max_length=16, choices=ROLE_CHOICES)
    content = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)
