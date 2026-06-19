from typing import Optional

import chromadb
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from sentence_transformers import SentenceTransformer


def _clean_source_path(source: str) -> str:
    source = source.replace("\\", "/")
    marker = "repo_loader_"
    idx = source.find(marker)
    if idx == -1:
        return source

    rest = source[idx:]
    return rest.split("/", 1)[1] if "/" in rest else rest


class RAGSearch:

    def __init__(
        self,
        persist_dir: str = "data",
        collection_name: str = "rag_collection",
        model_name: str = "all-MiniLM-L6-v2",
        groq_model: str = "llama-3.1-8b-instant",
        top_k: int = 8,
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

    def retrieve(self, query: str, repo_id: Optional[str] = None, top_k: Optional[int] = None,
                 max_per_file: int = 2):
        k = top_k or self.top_k
        query_embedding = self.embedding_model.encode([query]).tolist()
        # over-fetch, then diversify so a single large file can't flood the context
        query_params = {
            "query_embeddings": query_embedding,
            "n_results": max(k * 5, 30),
            "include": ["documents", "metadatas", "distances"],
        }
        if repo_id:
            query_params["where"] = {"repo_id": repo_id}

        raw = self.collection.query(**query_params)
        docs = raw.get("documents", [[]])[0]
        metas = raw.get("metadatas", [[]])[0]
        dists = raw.get("distances", [[]])[0]

        seen = {}
        out_docs, out_metas, out_dists = [], [], []
        for doc, meta, dist in zip(docs, metas, dists):
            src = (meta or {}).get("source") or (meta or {}).get("path") or "?"
            if seen.get(src, 0) >= max_per_file:
                continue
            seen[src] = seen.get(src, 0) + 1
            out_docs.append(doc)
            out_metas.append(meta)
            out_dists.append(dist)
            if len(out_docs) >= k:
                break

        return {"documents": [out_docs], "metadatas": [out_metas], "distances": [out_dists]}

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
            if source:
                source = _clean_source_path(source)
            header = f"Source: {source}\n" if source else ""
            context_parts.append(f"{header}{doc}")

        return "\n\n".join(context_parts)

    def answer(self, query: str, repo_id: Optional[str] = None, top_k: Optional[int] = None):
        results = self.retrieve(query, repo_id=repo_id, top_k=top_k)
        context = self._format_context(results)

        prompt = (
            "You are a senior engineer helping the user understand a codebase. "
            "Answer the question using ONLY the code context below. "
            "If the context does not contain enough information "
            "to answer, say so plainly and do NOT guess or invent details.\n\n"
            f"Context:\n{context}\n\n"
            f"Question: {query}\n\nAnswer:"
        )
        response = self.llm.invoke(prompt)
        return response.content, results
