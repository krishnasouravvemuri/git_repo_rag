from typing import Optional

import chromadb
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from sentence_transformers import SentenceTransformer


class RAGSearch:

    def __init__(
        self,
        persist_dir: str = "data",
        collection_name: str = "rag_collection",
        model_name: str = "all-MiniLM-L6-v2",
        groq_model: str = "llama-3.1-8b-instant",
        top_k: int = 5,
        temperature: float = 0.2,
    ):
        load_dotenv()

        self.persist_dir = persist_dir
        self.collection_name = collection_name
        self.top_k = top_k
        self.embedding_model = SentenceTransformer(model_name)
        self.llm = ChatGroq(model=groq_model, temperature=temperature)
        self.client = chromadb.PersistentClient(path=persist_dir)
        self.collection = self.client.get_or_create_collection(name=self.collection_name)

    def retrieve(self, query: str, repo_id: Optional[str] = None, top_k: Optional[int] = None):
        query_embedding = self.embedding_model.encode([query]).tolist()
        query_params = {
            "query_embeddings": query_embedding,
            "n_results": top_k or self.top_k,
            "include": ["documents", "metadatas", "distances"],
        }

        if repo_id:
            query_params["where"] = {"repo_id": repo_id}

        return self.collection.query(**query_params)

    def fetch_repo_data(self, repo_id: str):
        return self.collection.get(
            where={"repo_id": repo_id},
            include=["documents", "metadatas", "embeddings", "ids"],
        )

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

    def answer(self, query: str, repo_id: Optional[str] = None, top_k: Optional[int] = None):
        results = self.retrieve(query, repo_id=repo_id, top_k=top_k)
        context = self._format_context(results)

        prompt = (
            "You are an agent that are helping the user to understand his code base."
            f"Context:\n{context}\n\nQuestion: {query}"
        )
        response = self.llm.invoke(prompt)
        return response.content, results
