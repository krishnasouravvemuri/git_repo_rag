import os
import pickle

from src.data_loader import RepoLoader
from src.embedding import EmbeddingFlow
from src.vector_db import VectorDB
from src.rag_search import RAGSearch

if __name__ == "__main__": 

    repo_link = "https://github.com/krishnasouravvemuri/DRF-CRUD.git"

    data_dir = "data"
    index_path = os.path.join(data_dir, "chroma.index")
    metadata_path = os.path.join(data_dir, "metadata.pkl")

    def needs_rebuild() -> bool:
        if not (os.path.exists(index_path) and os.path.exists(metadata_path)):
            return True
        try:
            with open(metadata_path, "rb") as metadata_file:
                payload = pickle.load(metadata_file)
            return payload.get("source_id") != repo_link
        except Exception:
            return True

    if needs_rebuild():
        data_obj = RepoLoader(repo_link = repo_link)
        data = data_obj.read_repo()

        embedding_obj = EmbeddingFlow(data = data)
        chunks = embedding_obj.chunk_documents()
        embedding = embedding_obj.embed_chunks(chunks = chunks)

        documents = [chunk.page_content for chunk in chunks]
        metadatas = [chunk.metadata for chunk in chunks]

        vector_db = VectorDB(
            embeddings=embedding,
            documents=documents,
            metadatas=metadatas,
            persist_dir=data_dir,
            source_id=repo_link,
        )
        vector_db.insert_data()
        vector_db.save_local()

    rag = RAGSearch(persist_dir="data")
    answer, _ = rag.answer("Is there any auth handled in this repo ?")
    print(answer)