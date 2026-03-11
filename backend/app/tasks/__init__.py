from app.celery_app import celery_app

# ── Health-check task ─────────────────────────────────────────────────────────

@celery_app.task(name="tasks.ping", bind=True)
def ping(self) -> dict:
    """Health-check task — verifies the worker is reachable."""
    return {"status": "pong", "task_id": self.request.id}


# ── Workflow execution tasks (imports populate registry as a side-effect) ─────
from app.tasks import workflow_runner  # noqa: F401, E402
