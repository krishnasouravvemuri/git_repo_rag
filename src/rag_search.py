import os
import pickle
from typing import Optional, Tuple

import numpy as np
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from sentence_transformers import SentenceTransformer

from src.vector_db import VectorDB


class RAGSearch:

    def __init__(
        self,
        persist_dir: str = "data",
        index_file: str = "chroma.index",
        metadata_file: str = "metadata.pkl",
        model_name: str = "all-MiniLM-L6-v2",
        groq_model: str = "llama-3.1-8b-instant",
        top_k: int = 5,
        temperature: float = 0.2,
    ):
        load_dotenv()

        self.persist_dir = persist_dir
        self.index_path = os.path.join(persist_dir, index_file)
        self.metadata_path = os.path.join(persist_dir, metadata_file)
        self.collection_name = "rag_collection"
        self.top_k = top_k
        self.embedding_model = SentenceTransformer(model_name)
        self.llm = ChatGroq(model=groq_model, temperature=temperature)

    def _load_local_index(self) -> Tuple[np.ndarray, list, Optional[list], Optional[list], str]:
        if not os.path.exists(self.index_path):
            raise FileNotFoundError(f"Missing index file: {self.index_path}")
        if not os.path.exists(self.metadata_path):
            raise FileNotFoundError(f"Missing metadata file: {self.metadata_path}")

        with open(self.index_path, "rb") as index_file:
            embeddings = np.load(index_file)

        with open(self.metadata_path, "rb") as metadata_file:
            payload = pickle.load(metadata_file)

        documents = payload.get("documents")
        metadatas = payload.get("metadatas")
        ids = payload.get("ids")
        collection_name = payload.get("collection_name", self.collection_name)

        if documents is None:
            raise ValueError("metadata.pkl missing 'documents'.")

        return embeddings, documents, metadatas, ids, collection_name

    def retrieve(self, query: str, top_k: Optional[int] = None):
        embeddings, documents, metadatas, ids, collection_name = self._load_local_index()

        vector_db = VectorDB(
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
            ids=ids,
            collection_name=collection_name,
        )
        vector_db.insert_data()

        query_embedding = self.embedding_model.encode([query])
        return vector_db.query(query_embeddings=query_embedding, n_results=top_k or self.top_k)

    def _format_context(self, results) -> str:
        docs = results.get("documents", [[]])[0]
        metas = results.get("metadatas", [[]])[0]

        context_parts = []
        for i, doc in enumerate(docs):
            meta = metas[i] if metas and i < len(metas) else {}
            source = meta.get("source") or meta.get("path") or meta.get("file_path") or ""
            header = f"Source: {source}\n" if source else ""
            context_parts.append(f"{header}{doc}")

        return "\n\n".join(context_parts)

    def answer(self, query: str, top_k: Optional[int] = None):
        results = self.retrieve(query, top_k=top_k)
        context = self._format_context(results)

        prompt = (
            "You are an agent that are helping the user to understand his code base."
            f"Context:\n{context}\n\nQuestion: {query}"
        )
        response = self.llm.invoke(prompt)
        return response.content, results
