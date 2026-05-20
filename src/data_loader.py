import subprocess
import tempfile
from contextlib import contextmanager
from typing import Iterable, Optional

from langchain_community.document_loaders import DirectoryLoader, TextLoader

class RepoLoader:

    def __init__(self , repo_link , branch: Optional[str] = None , file_glob: str = "**/*" , exclude: Optional[Iterable[str]] = None):
        self.repo_link = repo_link
        self.branch = branch
        self.file_glob = file_glob
        self.exclude = list(exclude) if exclude is not None else [
            ".git/**",
            "**/.git/**",
            "venv/**",
            "**/venv/**",
            ".venv/**",
            "**/.venv/**",
            "node_modules/**",
            "**/node_modules/**",
            "__pycache__/**",
            "**/__pycache__/**",
            ".pytest_cache/**",
            "**/.pytest_cache/**",
            "dist/**",
            "**/dist/**",
            "build/**",
            "**/build/**",
        ]

    @contextmanager
    def build_repo(self):
        temp_dir_obj = tempfile.TemporaryDirectory(prefix="repo_loader_")
        try:
            temp_dir = temp_dir_obj.name
            clone_cmd = ["git", "clone", "--depth", "1"]

            if self.branch:
                clone_cmd.extend(["--branch", self.branch])

            clone_cmd.extend([self.repo_link, temp_dir])

            subprocess.run(clone_cmd, check=True, capture_output=True, text=True)
            yield temp_dir
        finally:
            temp_dir_obj.cleanup()


    def read_repo(self):
        with self.build_repo() as temp_dir:
            loader = DirectoryLoader(
                temp_dir,
                glob=self.file_glob,
                exclude=self.exclude,
                loader_cls=TextLoader,
                loader_kwargs={"encoding": "utf-8", "autodetect_encoding": True},
                show_progress=False,
            )
            return loader.load()
    
    