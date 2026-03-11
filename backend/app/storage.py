"""
Storage abstraction for artifact files.

LocalStorageBackend writes to a Docker volume mounted at settings.artifacts_path.
The relative path convention is:  {workflow_slug}/{execution_id}/{filename}

To add S3 or another backend later, implement the same interface and swap the
factory function — the rest of the codebase only uses get_storage().
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import BinaryIO


class LocalStorageBackend:
    def __init__(self, base_path: Path) -> None:
        self.base_path = base_path.resolve()
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _safe_path(self, relative_path: str) -> Path:
        """
        Resolve the target path and verify it stays within base_path.

        Raises ValueError if the resolved path would escape the storage root,
        preventing path-traversal attacks (e.g. relative_path='../../etc/passwd').
        """
        dest = (self.base_path / relative_path).resolve()
        # str comparison after resolve() guarantees symlinks are followed too
        if dest != self.base_path and not str(dest).startswith(str(self.base_path) + os.sep):
            raise ValueError(f"Unsafe storage path rejected: {relative_path!r}")
        return dest

    def save(self, relative_path: str, data: bytes) -> int:
        """Write bytes to storage. Returns number of bytes written."""
        dest = self._safe_path(relative_path)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return len(data)

    def open_stream(self, relative_path: str) -> BinaryIO:
        """Return an open binary file handle for streaming reads."""
        return open(self._safe_path(relative_path), "rb")

    def delete(self, relative_path: str) -> None:
        try:
            p = self._safe_path(relative_path)
        except ValueError:
            return  # refuse to delete outside base_path
        if p.exists():
            p.unlink()

    def exists(self, relative_path: str) -> bool:
        try:
            return self._safe_path(relative_path).exists()
        except ValueError:
            return False

    def file_size(self, relative_path: str) -> int | None:
        try:
            p = self._safe_path(relative_path)
        except ValueError:
            return None
        return p.stat().st_size if p.exists() else None

    def full_path(self, relative_path: str) -> Path:
        return self._safe_path(relative_path)


# Module-level singleton — one backend per process lifetime.
_storage: LocalStorageBackend | None = None


def get_storage() -> LocalStorageBackend:
    global _storage
    if _storage is None:
        from app.config import settings
        _storage = LocalStorageBackend(Path(settings.artifacts_path))
    return _storage
