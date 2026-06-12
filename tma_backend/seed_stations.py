"""
Deterministic station seed generator.
Uses a seeded RNG so results are reproducible across restarts.
"""

import random
from tma_backend.seed_regions import REGIONS, STREET_TYPES, STREET_NAMES, FUEL_TYPES


def _status_from_pct(pct: int) -> str:
    if pct >= 60:
        return "green"
    elif pct >= 25:
        return "yellow"
    return "red"


def _availability_pct(rng: random.Random, zone_type: str) -> int:
    """
    Status distribution:
      green  (60-100%) = 55%
      yellow (25-59%)  = 30%
      red    (0-24%)   = 15%
    """
    roll = rng.random()
    if roll < 0.55:
        return rng.randint(60, 100)
    elif roll < 0.85:
        return rng.randint(25, 59)
    else:
        return rng.randint(0, 24)


def _station_name(rng: random.Random, network: str, idx: int) -> str:
    suffixes = ["№" + str(rng.randint(1, 99)), "АЗС", ""]
    suffix = rng.choice(suffixes)
    return f"{network} {suffix}".strip() if suffix else network


def _address(rng: random.Random) -> str:
    street_type = rng.choice(STREET_TYPES)
    street = rng.choice(STREET_NAMES)
    house = rng.randint(1, 250)
    return f"{street_type} {street}, {house}"


def _queue(rng: random.Random, availability_pct: int) -> int:
    base = max(0, int((100 - availability_pct) / 10))
    return rng.randint(base, base + rng.randint(0, 8))


def generate_stations() -> list[dict]:
    """Return a list of station dicts ready to be inserted into the DB."""
    rng = random.Random(42)   # fixed seed for determinism
    stations = []

    for region in REGIONS:
        lat_lo, lat_hi = region["lat_range"]
        lng_lo, lng_hi = region["lng_range"]
        zone = region["zone_type"]
        chains = region["chains"]

        for i in range(region["station_count"]):
            network = chains[i % len(chains)]
            lat = round(rng.uniform(lat_lo, lat_hi), 6)
            lng = round(rng.uniform(lng_lo, lng_hi), 6)
            address = _address(rng)

            # Only seed 3-5 fuel types per station (realistic)
            fuel_count = rng.randint(3, min(5, len(FUEL_TYPES)))
            fuels = rng.sample(FUEL_TYPES, fuel_count)

            fuel_statuses = []
            for ft in fuels:
                pct = _availability_pct(rng, zone)
                fuel_statuses.append({
                    "fuel_type": ft,
                    "status": _status_from_pct(pct),
                    "availability_pct": pct,
                })

            avg_pct = int(sum(f["availability_pct"] for f in fuel_statuses) / len(fuel_statuses))

            stations.append({
                "region": region["name"],
                "zone_type": zone,
                "name": _station_name(rng, network, i),
                "address": address,
                "lat": lat,
                "lng": lng,
                "network": network,
                "queue_cars": _queue(rng, avg_pct),
                "fuel_statuses": fuel_statuses,
            })

    return stations
