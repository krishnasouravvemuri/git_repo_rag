from datetime import datetime
from typing import Optional
from urllib.parse import urlparse
from uuid import uuid4

from .data_loader import RepoLoader
from .embedding import EmbeddingFlow
from .vector_db import VectorDB


def _extract_repo_path(repo_url: str) -> str:
    if repo_url.startswith("git@"):
        if ":" not in repo_url:
            raise ValueError(f"Invalid git URL: {repo_url}")
        path = repo_url.split(":", 1)[1]
    else:
        parsed = urlparse(repo_url)
        path = parsed.path

    return path.strip("/")


def parse_repo_owner(repo_url: str) -> str:
    path = _extract_repo_path(repo_url)
    if path.endswith(".git"):
        path = path[:-4]

    parts = [segment for segment in path.split("/") if segment]
    if len(parts) < 2:
        raise ValueError(f"Unable to parse repo owner from URL: {repo_url}")

    return parts[0]


def build_repo_metadata(repo_url: str) -> dict:
    return {
        "repo_url": repo_url,
        "repo_owner": parse_repo_owner(repo_url),
        "created_at": datetime.now().isoformat(),
    }


def ingest_repo(
    repo_url: str,
    persist_dir: str = "data",
    collection_name: str = "rag_collection",
    branch: Optional[str] = None,
) -> str:
    repo_id = str(uuid4())
    repo_metadata = build_repo_metadata(repo_url)

    data_obj = RepoLoader(repo_link=repo_url, branch=branch)
    data = data_obj.read_repo()
    if not data:
        raise ValueError("No documents were loaded from the repository.")

    embedding_obj = EmbeddingFlow(data=data)
    chunks = embedding_obj.chunk_documents()
    if not chunks:
        raise ValueError("No document chunks were generated for the repository.")

    embeddings = embedding_obj.embed_chunks(chunks=chunks)
    documents = [chunk.page_content for chunk in chunks]

    metadatas = []
    for chunk in chunks:
        metadata = dict(chunk.metadata) if chunk.metadata else {}
        metadata.update(repo_metadata)
        metadata["repo_id"] = repo_id
        metadatas.append(metadata)

    ids = [f"{repo_id}_{i}" for i in range(len(documents))]

    vector_db = VectorDB(
        embeddings=embeddings,
        documents=documents,
        metadatas=metadatas,
        ids=ids,
        persist_dir=persist_dir,
        collection_name=collection_name,
        source_id=repo_id,
    )
    vector_db.insert_data()

    return repo_id
