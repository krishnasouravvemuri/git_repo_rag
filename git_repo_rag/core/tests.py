from django.test import SimpleTestCase

from .data_loader import RepoLoader
from .rag_search import _clean_source_path


class RepoLoaderTests(SimpleTestCase):
    def test_default_exclusions_skip_persistence_and_binary_artifacts(self):
        loader = RepoLoader("https://example.com/org/repo.git")

        self.assertIn("data/**", loader.exclude)
        self.assertIn("**/data/**", loader.exclude)
        self.assertIn("**/*.bin", loader.exclude)
        self.assertIn("**/db.sqlite3", loader.exclude)

    def test_custom_exclusions_are_merged_with_defaults(self):
        loader = RepoLoader("https://example.com/org/repo.git", exclude=["custom/**"])

        self.assertIn("custom/**", loader.exclude)
        self.assertIn("data/**", loader.exclude)


class RagSearchTests(SimpleTestCase):
    def test_clean_source_path_normalizes_windows_temp_paths(self):
        source = r"C:\Temp\repo_loader_abc123\src\main\java\com\example\project\Project.java"

        self.assertEqual(
            _clean_source_path(source),
            "src/main/java/com/example/project/Project.java",
        )
