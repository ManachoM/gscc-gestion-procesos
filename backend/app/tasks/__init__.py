from app.celery_app import celery_app


@celery_app.task(name="tasks.ping", bind=True)
def ping(self) -> dict:
    """Health-check task — verifies the worker is reachable."""
    return {"status": "pong", "task_id": self.request.id}


# Add domain-specific tasks below, or create separate modules (e.g. tasks/jobs.py)
# and import them here so Celery's autodiscovery picks them up.
