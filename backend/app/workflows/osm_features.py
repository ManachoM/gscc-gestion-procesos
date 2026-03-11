"""
OSM Features Extraction workflow.

Downloads geographic features (hospitals, parks, schools, etc.) from
OpenStreetMap via the public Overpass API for a given bounding box,
then saves the result as a GeoJSON or CSV artifact.

Overpass API: https://overpass-api.de
"""
import csv
import io
import json

import httpx

from app.workflows.context import WorkflowContext
from app.workflows.registry import workflow

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
TIMEOUT_SECONDS = 90  # Overpass can be slow for large areas

# Maps user-facing feature names to their OSM tag (key, value)
FEATURE_TAGS: dict[str, tuple[str, str]] = {
    "hospitals":    ("amenity", "hospital"),
    "schools":      ("amenity", "school"),
    "parks":        ("leisure", "park"),
    "restaurants":  ("amenity", "restaurant"),
    "pharmacies":   ("amenity", "pharmacy"),
    "bus_stops":    ("highway", "bus_stop"),
    "banks":        ("amenity", "bank"),
    "supermarkets": ("shop", "supermarket"),
    "fuel":         ("amenity", "fuel"),
    "police":       ("amenity", "police"),
}

PARAM_SCHEMA = {
    "type": "object",
    "title": "OSM Features Extraction Parameters",
    "properties": {
        "feature_type": {
            "type": "string",
            "title": "Feature Type",
            "description": "Type of OpenStreetMap feature to download.",
            "enum": list(FEATURE_TAGS.keys()),
        },
        "bbox": {
            "type": "string",
            "title": "Bounding Box",
            "description": (
                "Geographic bounding box as 'south,west,north,east' (decimal degrees). "
                "Example for Santiago de Chile: -33.65,-70.80,-33.30,-70.50"
            ),
            "default": "-33.65,-70.80,-33.30,-70.50",
        },
        "output_format": {
            "type": "string",
            "title": "Output Format",
            "description": "File format for the saved artifact.",
            "enum": ["geojson", "csv"],
            "default": "geojson",
        },
    },
    "required": ["feature_type", "bbox"],
}


# ── Overpass helpers ──────────────────────────────────────────────────────────

def _build_overpass_query(tag_key: str, tag_value: str, bbox: str) -> str:
    """Build an Overpass QL query returning nodes and ways with the given tag.

    Overpass bbox order: south,west,north,east — identical to our input format.
    ``out center tags`` gives each way a centroid so coordinate extraction is uniform.
    """
    return (
        f"[out:json][timeout:{TIMEOUT_SECONDS}];\n"
        f"(\n"
        f"  node[{tag_key}={tag_value}]({bbox});\n"
        f"  way[{tag_key}={tag_value}]({bbox});\n"
        f");\n"
        f"out center tags;"
    )


def _to_geojson(elements: list[dict]) -> dict:
    """Convert Overpass JSON elements to a GeoJSON FeatureCollection."""
    features = []
    for el in elements:
        el_type = el.get("type")
        tags = el.get("tags", {})

        if el_type == "node":
            coords = [el["lon"], el["lat"]]
        elif el_type == "way" and "center" in el:
            coords = [el["center"]["lon"], el["center"]["lat"]]
        else:
            continue  # skip relations and ways without center

        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": coords},
            "properties": {"osm_id": el["id"], "osm_type": el_type, **tags},
        })

    return {"type": "FeatureCollection", "features": features}


def _to_csv(elements: list[dict]) -> bytes:
    """Convert Overpass JSON elements to a flat CSV file."""
    all_tag_keys: set[str] = set()
    rows: list[dict] = []

    for el in elements:
        el_type = el.get("type")
        tags = el.get("tags", {})

        if el_type == "node":
            lat, lon = el.get("lat"), el.get("lon")
        elif el_type == "way" and "center" in el:
            lat, lon = el["center"]["lat"], el["center"]["lon"]
        else:
            continue

        row = {"osm_id": el["id"], "osm_type": el_type, "lat": lat, "lon": lon, **tags}
        all_tag_keys.update(tags.keys())
        rows.append(row)

    buf = io.StringIO()
    header = ["osm_id", "osm_type", "lat", "lon"] + sorted(all_tag_keys)
    writer = csv.DictWriter(buf, fieldnames=header, extrasaction="ignore", lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue().encode("utf-8")


# ── Workflow ──────────────────────────────────────────────────────────────────

@workflow(
    slug="osm_features",
    name="OSM Features Extraction",
    description=(
        "Downloads geographic features from OpenStreetMap via the Overpass API "
        "for a given bounding box and saves them as a GeoJSON or CSV artifact."
    ),
    param_schema=PARAM_SCHEMA,
)
def run(ctx: WorkflowContext) -> None:
    feature_type: str = ctx.params["feature_type"]
    bbox: str = ctx.params.get("bbox", "-33.65,-70.80,-33.30,-70.50").strip()
    output_format: str = ctx.params.get("output_format", "geojson")

    if feature_type not in FEATURE_TAGS:
        raise ValueError(f"Unknown feature_type '{feature_type}'. Valid values: {list(FEATURE_TAGS)}")

    tag_key, tag_value = FEATURE_TAGS[feature_type]
    ctx.info(f"feature_type={feature_type}  tag={tag_key}={tag_value}  bbox={bbox}  format={output_format}")

    # ── Query Overpass ────────────────────────────────────────────────────────
    query = _build_overpass_query(tag_key, tag_value, bbox)
    ctx.info("Sending request to Overpass API…")

    with httpx.Client(timeout=TIMEOUT_SECONDS + 10) as client:
        response = client.post(OVERPASS_URL, data={"data": query})
        response.raise_for_status()

    overpass_data = response.json()
    elements: list[dict] = overpass_data.get("elements", [])
    ctx.info(f"Overpass returned {len(elements)} elements.")

    if not elements:
        ctx.warning("No features found for the given parameters. Saving empty artifact.")

    # ── Convert to target format ──────────────────────────────────────────────
    if output_format == "geojson":
        data = json.dumps(_to_geojson(elements), ensure_ascii=False, indent=2).encode("utf-8")
        filename = f"{feature_type}.geojson"
        mime_type = "application/geo+json"
    else:
        data = _to_csv(elements)
        filename = f"{feature_type}.csv"
        mime_type = "text/csv"

    ctx.info(f"Artifact size: {len(data):,} bytes  file: {filename}")

    # ── Parse bbox for metadata ───────────────────────────────────────────────
    try:
        south, west, north, east = [float(v) for v in bbox.split(",")]
        geo_label = f"bbox({south},{west},{north},{east})"
    except ValueError:
        geo_label = bbox

    ctx.save_artifact(
        filename=filename,
        data=data,
        mime_type=mime_type,
        geo_label=geo_label,
        tags=["osm", feature_type, output_format],
        description=(
            f"{len(elements)} {feature_type} features from OpenStreetMap "
            f"(bbox: {bbox}), {output_format.upper()} format."
        ),
    )

    ctx.info(f"Done. {len(elements)} {feature_type} features saved to '{filename}'.")
