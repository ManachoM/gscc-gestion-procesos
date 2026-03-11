"""
Workflow package — importing this module populates the workflow registry.

Add new workflow modules here as they are created. Each module registers itself
via the @workflow decorator when imported, so order doesn't matter.
"""
from app.workflows import sample_extraction  # noqa: F401
from app.workflows import osm_features  # noqa: F401

# Add new workflow imports below:
# from app.workflows import my_extraction  # noqa: F401
