from celery import Celery
from celery.schedules import timedelta

from app.config import settings

celery_app = Celery(
    "gscc_worker",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Task results are transient — Postgres is the authoritative source of truth
    result_expires=86400,
    task_track_started=True,
    # Beat schedule: check for due recurring schedules every 60 seconds
    beat_schedule={
        "dispatch-due-schedules": {
            "task": "tasks.dispatch_due_schedules",
            "schedule": timedelta(seconds=60),
        },
    },
)
