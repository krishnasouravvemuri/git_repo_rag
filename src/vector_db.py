import os
import pickle
from typing import Iterable, Optional, Sequence

import chromadb
import numpy as np


class VectorDB:

    def __init__(
        self,
        embeddings: Sequence[Sequence[float]],
        documents: Sequence[str],
        collection_name: str = "rag_collection",
        persist_dir: Optional[str] = None,
        metadatas: Optional[Iterable[dict]] = None,
        ids: Optional[Iterable[str]] = None,
        source_id: Optional[str] = None,
    ):
        self.embeddings = np.asarray(embeddings)
        self.documents = list(documents)
        self.collection_name = collection_name
        self.persist_dir = persist_dir
        self.metadatas = list(metadatas) if metadatas is not None else None
        self.ids = list(ids) if ids is not None else None
        self.source_id = source_id

        if persist_dir:
            os.makedirs(persist_dir, exist_ok=True)
            self.client = chromadb.PersistentClient(path=persist_dir)
        else:
            self.client = chromadb.Client()

        self.collection = self.client.get_or_create_collection(name=self.collection_name)

    def _prepare_embeddings(self):
        if self.embeddings.ndim == 1:
            self.embeddings = self.embeddings.reshape(1, -1)

    def _validate_inputs(self):
        self._prepare_embeddings()

        if len(self.documents) != len(self.embeddings):
            raise ValueError("Embeddings count must match documents count.")

        if self.metadatas is not None and len(self.metadatas) != len(self.documents):
            raise ValueError("Metadatas count must match documents count.")

        if self.ids is not None and len(self.ids) != len(self.documents):
            raise ValueError("Ids count must match documents count.")

    def _resolve_ids(self):
        return self.ids or [f"doc_{i}" for i in range(len(self.documents))]

    def insert_data(self):
        self._validate_inputs()
        ids = self._resolve_ids()

        self.collection.add(
            ids=ids,
            documents=self.documents,
            embeddings=self.embeddings.tolist(),
            metadatas=self.metadatas,
        )
        return self.collection

    def save_local(self, persist_dir: Optional[str] = None):
        target_dir = persist_dir or self.persist_dir
        if not target_dir:
            raise ValueError("persist_dir is required to save chroma.index and metadata.pkl.")

        self._validate_inputs()
        os.makedirs(target_dir, exist_ok=True)

        index_path = os.path.join(target_dir, "chroma.index")
        metadata_path = os.path.join(target_dir, "metadata.pkl")

        with open(index_path, "wb") as index_file:
            np.save(index_file, self.embeddings)

        payload = {
            "collection_name": self.collection_name,
            "ids": self._resolve_ids(),
            "documents": self.documents,
            "metadatas": self.metadatas,
            "source_id": self.source_id,
        }
        with open(metadata_path, "wb") as metadata_file:
            pickle.dump(payload, metadata_file)

        return index_path, metadata_path

    def query(self, query_embeddings: Sequence[Sequence[float]], n_results: int = 5):
        query_arr = np.asarray(query_embeddings)
        if query_arr.ndim == 1:
            query_arr = query_arr.reshape(1, -1)

        return self.collection.query(
            query_embeddings=query_arr.tolist(),
            n_results=n_results,
            include=["documents", "metadatas", "distances"],
        )