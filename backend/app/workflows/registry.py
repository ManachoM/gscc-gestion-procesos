"""
Workflow registry — the single source of truth for which workflows exist in code.

Usage
-----
from app.workflows.registry import workflow, WorkflowDefinition

@workflow(
    slug="my_extraction",
    name="My Extraction",
    description="...",
    param_schema={...},  # JSON Schema object
)
def run(ctx: WorkflowContext) -> None:
    ...

The @workflow decorator registers the function in _REGISTRY. On app startup,
main.py calls sync_workflows_to_db() to reconcile DB rows with this registry.
Admins change lifecycle state (draft/published/archived) in the DB; the code
is never modified at runtime.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Callable

if TYPE_CHECKING:
    from app.workflows.context import WorkflowContext


@dataclass
class WorkflowDefinition:
    slug: str
    name: str
    description: str
    param_schema: dict
    fn: Callable[["WorkflowContext"], None]


_REGISTRY: dict[str, WorkflowDefinition] = {}


def workflow(
    slug: str,
    name: str,
    description: str = "",
    param_schema: dict | None = None,
) -> Callable:
    """Decorator that registers a workflow function in the in-memory registry."""

    def decorator(fn: Callable[["WorkflowContext"], None]) -> Callable:
        _REGISTRY[slug] = WorkflowDefinition(
            slug=slug,
            name=name,
            description=description,
            param_schema=param_schema or {},
            fn=fn,
        )
        return fn

    return decorator


def get_registry() -> dict[str, WorkflowDefinition]:
    return _REGISTRY


def get_workflow_def(slug: str) -> WorkflowDefinition | None:
    return _REGISTRY.get(slug)


def compute_fingerprint(params: dict) -> str:
    """
    Stable SHA-256 fingerprint of a parameter dict. Keys are sorted so that
    {"a": 1, "b": 2} and {"b": 2, "a": 1} produce the same fingerprint.
    Used for concurrency overlap detection.
    """
    canonical = json.dumps(params, sort_keys=True, ensure_ascii=True, default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()
