from typing import List, Any
import numpy as np
from sentence_transformers import SentenceTransformer
from langchain_text_splitters import RecursiveCharacterTextSplitter


class EmbeddingFlow:

    def __init__(self , data , model_name = "all-MiniLM-L6-v2" , chunk_size = 1000, chunk_overlap = 200):
        self.data = data
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.model = SentenceTransformer(model_name)
    
    def chunk_documents(self) -> List[Any]:

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            length_function=len,
            separators=["\n\n", "\n", " ", ""]
        )
        chunks = splitter.split_documents(self.data)

        return chunks

    def embed_chunks(self, chunks: List[Any]) -> np.ndarray:

        texts = [chunk.page_content for chunk in chunks]
        embeddings = self.model.encode(texts, show_progress_bar=True)
        return embeddings