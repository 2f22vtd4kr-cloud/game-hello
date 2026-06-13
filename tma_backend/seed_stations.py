"""
Deterministic station seed generator — 500+ stations across 32 regions.
Named stations from NAMED_STATIONS are injected first, then procedural fill.
Uses a seeded RNG so results are reproducible across restarts.
Includes geocoding validation: rejects points in known water zones.
"""

import random
from tma_backend.seed_regions import (
    REGIONS, STREET_TYPES, STREET_NAMES, FUEL_TYPES, NAMED_STATIONS
)

# ── Water-zone exclusion ─────────────────────────────────────────────────────
# Conservative bounding boxes (lat_min, lng_min, lat_max, lng_max).
# Procedural station placement retries up to _MAX_WATER_RETRIES times before
# falling back to the centre of the bounding box.
_WATER_ZONES = [
    # Black Sea western / central (clear of all coasts)
    (41.5, 29.0, 44.0, 33.5),
    # Black Sea south of Crimea
    (41.5, 33.5, 44.0, 35.0),
    # Eastern Black Sea – narrow corridor between Crimea east and Krasnodar;
    # upper bound 44.1 keeps Novorossiysk (44.72 N) on land, east bound 36.8
    # keeps Kerch city (36.47 E) off this zone
    (43.5, 35.5, 44.1, 36.8),
    # Sea of Azov main body – conservative bounds to keep coastal cities safe:
    # lat cap 46.5 excludes Melitopol (46.85 N), lng cap 38.0 excludes
    # Taganrog / Rostov (lng 38.9-39.7 E)
    (45.4, 34.5, 46.5, 38.0),
    # Caspian Sea
    (37.0, 49.5, 47.0, 54.5),
]
_MAX_WATER_RETRIES = 25


def _is_in_water(lat: float, lng: float) -> bool:
    """Return True if the coordinate falls inside any known water-zone bbox."""
    for lat_min, lng_min, lat_max, lng_max in _WATER_ZONES:
        if lat_min <= lat <= lat_max and lng_min <= lng <= lng_max:
            return True
    return False


def _safe_lat_lng(
    rng: random.Random,
    lat_lo: float, lat_hi: float,
    lng_lo: float, lng_hi: float,
) -> tuple[float, float]:
    """
    Sample a random (lat, lng) inside the bounding box, retrying if the point
    lands in a known water zone.  Falls back to the geometric centre if all
    retries fail (very rare for well-defined land regions).
    """
    for _ in range(_MAX_WATER_RETRIES):
        lat = round(rng.uniform(lat_lo, lat_hi), 6)
        lng = round(rng.uniform(lng_lo, lng_hi), 6)
        if not _is_in_water(lat, lng):
            return lat, lng
    # Fallback: midpoint (almost certainly on land for our region set)
    return round((lat_lo + lat_hi) / 2, 6), round((lng_lo + lng_hi) / 2, 6)


def _status_from_pct(pct: int) -> str:
    if pct >= 60:
        return "green"
    elif pct >= 25:
        return "yellow"
    return "red"


def _availability_pct(rng: random.Random, zone_type: str) -> int:
    """
    Critical zones are harder — more red/yellow.
    Standard zones: green 55%, yellow 30%, red 15%.
    Critical zones: green 35%, yellow 35%, red 30%.
    """
    roll = rng.random()
    if zone_type == "critical":
        if roll < 0.35:
            return rng.randint(60, 100)
        elif roll < 0.70:
            return rng.randint(25, 59)
        else:
            return rng.randint(0, 24)
    else:
        if roll < 0.55:
            return rng.randint(60, 100)
        elif roll < 0.85:
            return rng.randint(25, 59)
        else:
            return rng.randint(0, 24)


def _address(rng: random.Random) -> str:
    street_type = rng.choice(STREET_TYPES)
    street = rng.choice(STREET_NAMES)
    house = rng.randint(1, 250)
    return f"{street_type} {street}, {house}"


def _queue(rng: random.Random, availability_pct: int) -> int:
    base = max(0, int((100 - availability_pct) / 10))
    return rng.randint(base, base + rng.randint(0, 8))


def _make_fuel_statuses(rng: random.Random, zone: str) -> list[dict]:
    fuel_count = rng.randint(3, min(5, len(FUEL_TYPES)))
    fuels = rng.sample(FUEL_TYPES, fuel_count)
    result = []
    for ft in fuels:
        pct = _availability_pct(rng, zone)
        result.append({
            "fuel_type": ft,
            "status": _status_from_pct(pct),
            "availability_pct": pct,
        })
    return result


def generate_stations() -> list[dict]:
    """Return list of station dicts ready for DB insert. ~500+ stations total."""
    rng = random.Random(42)
    stations = []

    # ── Step 1: inject named real stations ──────────────────────────────
    region_map = {r["name"]: r for r in REGIONS}
    named_by_region: dict[str, int] = {}

    for ns in NAMED_STATIONS:
        region_name = ns["region"]
        region = region_map.get(region_name)
        zone = region["zone_type"] if region else "standard"

        fuel_statuses = _make_fuel_statuses(rng, zone)
        avg_pct = int(sum(f["availability_pct"] for f in fuel_statuses) / len(fuel_statuses))

        stations.append({
            "region": region_name,
            "zone_type": zone,
            "name": ns["name"],
            "address": ns["address"],
            "lat": ns["lat"],
            "lng": ns["lng"],
            "network": ns["network"],
            "queue_cars": _queue(rng, avg_pct),
            "fuel_statuses": fuel_statuses,
        })
        named_by_region[region_name] = named_by_region.get(region_name, 0) + 1

    # ── Step 2: procedural fill to hit station_count per region ─────────
    for region in REGIONS:
        lat_lo, lat_hi = region["lat_range"]
        lng_lo, lng_hi = region["lng_range"]
        zone = region["zone_type"]
        chains = region["chains"]
        rname = region["name"]

        already = named_by_region.get(rname, 0)
        remaining = max(0, region["station_count"] - already)

        for i in range(remaining):
            network = chains[i % len(chains)]
            lat, lng = _safe_lat_lng(rng, lat_lo, lat_hi, lng_lo, lng_hi)
            address = _address(rng)

            fuel_statuses = _make_fuel_statuses(rng, zone)
            avg_pct = int(sum(f["availability_pct"] for f in fuel_statuses) / len(fuel_statuses))

            stations.append({
                "region": rname,
                "zone_type": zone,
                "name": network,
                "address": address,
                "lat": lat,
                "lng": lng,
                "network": network,
                "queue_cars": _queue(rng, avg_pct),
                "fuel_statuses": fuel_statuses,
            })

    return stations
