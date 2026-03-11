"""
Sample extraction workflow — demonstrates the full contract end-to-end.

This file shows how real workflows should be structured:
  1. Declare PARAM_SCHEMA as a JSON Schema object (used by the frontend form renderer).
  2. Decorate the run function with @workflow(...).
  3. Use ctx.log() for progress messages and ctx.save_artifact() to persist output.

Real workflows live in this package. They are discovered automatically on startup
and synced to the DB as draft workflows. Admins publish them from the UI.
"""
from datetime import date

from app.workflows.context import WorkflowContext
from app.workflows.registry import workflow

PARAM_SCHEMA = {
    "type": "object",
    "title": "Sample Extraction Parameters",
    "properties": {
        "region": {
            "type": "string",
            "title": "Geographic Region",
            "description": "Target region for the extraction.",
            "enum": ["norte", "centro", "sur"],
        },
        "date_from": {
            "type": "string",
            "format": "date",
            "title": "Start Date",
            "description": "First date to include in the extraction (YYYY-MM-DD).",
        },
        "record_limit": {
            "type": "integer",
            "title": "Record Limit",
            "description": "Maximum number of records to include.",
            "default": 100,
            "minimum": 1,
            "maximum": 10000,
        },
    },
    "required": ["region", "date_from"],
}


@workflow(
    slug="sample_extraction",
    name="Sample Extraction",
    description=(
        "Demonstration workflow that generates a CSV artifact for a given region "
        "and date range. Use this as a template for real extraction workflows."
    ),
    param_schema=PARAM_SCHEMA,
)
def run(ctx: WorkflowContext) -> None:
    region: str = ctx.params["region"]
    date_from: str = ctx.params["date_from"]
    limit: int = ctx.params.get("record_limit", 100)

    ctx.info(f"Starting extraction: region={region} date_from={date_from} limit={limit}")

    # Simulate data extraction work
    rows = [f"record_{i},{region},{date_from}" for i in range(min(limit, 50))]
    csv_content = "id,region,date\n" + "\n".join(rows) + "\n"

    ctx.info(f"Generated {len(rows)} records")

    try:
        data_date = date.fromisoformat(date_from)
    except ValueError:
        data_date = None

    ctx.save_artifact(
        filename="output.csv",
        data=csv_content.encode("utf-8"),
        mime_type="text/csv",
        geo_region=region,
        data_date=data_date,
        tags=["sample", region, "csv"],
        description=f"Sample extraction — region={region}, from={date_from}, {len(rows)} records.",
    )

    ctx.info("Extraction complete.")
