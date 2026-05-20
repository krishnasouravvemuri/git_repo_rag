# Repo RAG Flow

## Flowchart

```
        INGESTION FLOW

┌───────────────────────────┐
│         Repo URL          │
└─────────────┬─────────────┘
              │
              v
┌───────────────────────────┐
│ RepoLoader.read_repo      │
│ src/data_loader.py        │
└─────────────┬─────────────┘
              │
              v
┌───────────────────────────┐
│ Documents (LangChain)     │
└─────────────┬─────────────┘
              │
              v
┌───────────────────────────┐
│ EmbeddingFlow.chunk_docs  │
│ src/embedding.py          │
└─────────────┬─────────────┘
              │
              v
┌───────────────────────────┐
│ Chunks                    │
└─────────────┬─────────────┘
              │
              v
┌────────────────────────────┐
│ EmbeddingFlow.embed_chunks │
│ src/embedding.py           │
└─────────────┬──────────────┘
              │
              v
┌───────────────────────────┐
│ Embeddings                │
└─────────────┬─────────────┘
              │
              v
┌───────────────────────────┐
│ repo_ingest.py            │
│ repo_id + metadata        │
└─────────────┬─────────────┘
              │
              v
┌───────────────────────────┐
│ VectorDB.insert_data      │
│ src/vector_db.py          │
└─────────────┬─────────────┘
              │
              v
┌───────────────────────────┐
│ Chroma Persistent Storage │
│ data/ (collection)        │
└───────────────────────────┘

          QUERY FLOW

┌───────────────────────────┐
│ User Query + repo_id      │
└─────────────┬─────────────┘
              │
              v
┌───────────────────────────┐
│ RAGSearch.retrieve        │
│ src/rag_search.py         │
└─────────────┬─────────────┘
              │
              v
┌─────────────────────────────┐
│ Chroma Persistent Storage   │
│ data/ (filtered by repo_id) │
└─────────────┬───────────────┘
              │
              v
┌───────────────────────────┐
│ Top-k chunks + metadata   │
└─────────────┬─────────────┘
              │
              v
┌──────────────────────────────┐
│ RAGSearch.answer -> ChatGroq │
│ src/rag_search.py            │
└─────────────┬────────────────┘
              │
              v
┌───────────────────────────┐
│ Final Answer              │
└───────────────────────────┘
```

## File Explanations

### main.py
Entry point. Ingests a repo URL to generate a repo UUID and store data in Chroma, then runs a sample query scoped to that repo ID.

### src/data_loader.py
Clones the Git repository into a temporary folder and loads all text files into LangChain `Document` objects using `DirectoryLoader` with exclusions.

### src/embedding.py
Splits documents into chunks and generates embeddings using `SentenceTransformer`.

### src/vector_db.py
Wraps Chroma. Validates inputs and adds `ids`, `documents`, `embeddings`, and `metadatas` to a collection. Handles persistent storage via `chromadb.PersistentClient`.

### src/repo_ingest.py
Creates a UUID for the repo, parses the repo owner from the URL, and builds metadata with `repo_url`, `repo_owner`, and `created_at`. Attaches `repo_id` and metadata to each chunk and writes everything to Chroma.

### src/rag_search.py
Embeds the user query, queries Chroma with an optional `repo_id` filter, formats context, and sends it to the LLM. Also supports fetching all stored data for a repo via `fetch_repo_data`.

### requirements.txt
Lists runtime dependencies such as LangChain, ChromaDB, Sentence Transformers, and the Groq client.

### .env
Holds API keys (loaded by `RAGSearch` via `dotenv`). Keep secrets out of source control.

### data/
Chroma persistence directory used by `chromadb.PersistentClient`. Stores the vector collection on disk.

## VectorDB Storage Examples (3)

**Example 1**
```json
{
  "id": "2d7b3e54-6b2a-4f8c-9d32-1b9e3efb2c11_0",
  "document": "def create_user(...):\n    ...",
  "embedding": [0.012, -0.034, 0.560, 0.004, -0.118, "..."],
  "metadata": {
    "source": "src/users.py",
    "repo_id": "2d7b3e54-6b2a-4f8c-9d32-1b9e3efb2c11",
    "repo_url": "https://github.com/example/acme-api.git",
    "repo_owner": "example",
    "created_at": "2026-05-20T22:40:00+05:30"
  }
}
```

**Example 2**
```json
{
  "id": "2d7b3e54-6b2a-4f8c-9d32-1b9e3efb2c11_142",
  "document": "# Installation\npip install -r requirements.txt",
  "embedding": [-0.083, 0.201, -0.019, 0.477, 0.006, "..."],
  "metadata": {
    "source": "README.md",
    "repo_id": "2d7b3e54-6b2a-4f8c-9d32-1b9e3efb2c11",
    "repo_url": "https://github.com/example/acme-api.git",
    "repo_owner": "example",
    "created_at": "2026-05-20T22:40:00+05:30"
  }
}
```

**Example 3**
```json
{
  "id": "2d7b3e54-6b2a-4f8c-9d32-1b9e3efb2c11_311",
  "document": "class OrderService:\n    def total(self):\n        ...",
  "embedding": [0.044, 0.093, -0.221, 0.012, 0.315, "..."],
  "metadata": {
    "source": "src/services/order.py",
    "repo_id": "2d7b3e54-6b2a-4f8c-9d32-1b9e3efb2c11",
    "repo_url": "https://github.com/example/acme-api.git",
    "repo_owner": "example",
    "created_at": "2026-05-20T22:40:00+05:30"
  }
}
```
