from models import Route, Hospital, Incident
from traffic import incidents_on_route, MockIncidentStore

SECURITY_MIN_SAVINGS_S = 300   # recommend security only if it saves >= 5 min


class NoRouteAvailable(Exception):
    pass


def choose_route(candidates: list[Route], context: dict) -> Route:
    """Phase 1 stub: return the fastest candidate.

    Later this fuses `context` (traffic feeds, accident reports, etc.)
    and scores candidates. Keep the signature stable so the real
    implementation drops in here without touching the endpoint.
    """
    if not candidates:
        raise NoRouteAvailable("No routes returned from routing engine")
    return min(candidates, key=lambda r: r.duration_s)


def choose_hospital_route(
    finalists: list[dict],          # [{"hospital": Hospital, "routes": list[Route]}]
    incident_store: MockIncidentStore,
    context: dict,
) -> dict:
    """Pick the best (hospital, route) pair accounting for incident delays.

    Incidents affect both route choice AND hospital choice:
    a closer hospital with a blocked route can lose to a farther hospital
    with a clear road.

    Returns a dict with: hospital, route, effective_duration_s,
    alternatives (other hospitals, best effective time each),
    and a security_recommendation dict.
    """
    all_incidents = incident_store.all()

    # Score every (hospital, candidate route) combination
    all_options: list[dict] = []
    for finalist in finalists:
        hospital: Hospital = finalist["hospital"]
        for route in finalist["routes"]:
            on_route = incidents_on_route(route.geometry, all_incidents)
            delay_s = sum(i.delay_min * 60 for i in on_route)
            all_options.append({
                "hospital": hospital,
                "route": route,
                "effective_duration_s": route.duration_s + delay_s,
                "incidents": on_route,
            })

    if not all_options:
        raise NoRouteAvailable("No routes available to any hospital")

    all_options.sort(key=lambda x: x["effective_duration_s"])
    chosen = all_options[0]

    # Best effective option per every OTHER hospital
    chosen_id = chosen["hospital"].id
    best_alt: dict[str, dict] = {}
    for opt in all_options:
        hid = opt["hospital"].id
        if hid == chosen_id:
            continue
        if hid not in best_alt or opt["effective_duration_s"] < best_alt[hid]["effective_duration_s"]:
            best_alt[hid] = opt

    alternatives = [
        {
            "name": opt["hospital"].name,
            "lat": opt["hospital"].lat,
            "lng": opt["hospital"].lng,
            "duration_s": opt["route"].duration_s,
            "effective_duration_s": opt["effective_duration_s"],
        }
        for opt in sorted(best_alt.values(), key=lambda x: x["effective_duration_s"])
    ]

    # Security recommendation
    clearable = [i for i in chosen["incidents"] if i.type == "congestion"]
    blockages  = [i for i in chosen["incidents"] if i.type == "blockage"]
    savings_s  = sum(i.delay_min * 60 for i in clearable)

    if savings_s >= SECURITY_MIN_SAVINGS_S:
        worst = max(clearable, key=lambda i: i.delay_min)
        security = {
            "recommended": True,
            "reason": "clearable congestion on fastest route",
            "incident_type": "congestion",
            "estimated_time_saved_s": savings_s,
            "incident_location": {"lat": worst.lat, "lng": worst.lng},
        }
    elif blockages:
        security = {
            "recommended": False,
            "reason": "hard blockage present — security cannot clear; rerouted to fastest available",
            "incident_type": "blockage",
            "estimated_time_saved_s": None,
            "incident_location": None,
        }
    elif clearable:
        security = {
            "recommended": False,
            "reason": "congestion below savings threshold",
            "incident_type": "congestion",
            "estimated_time_saved_s": savings_s,
            "incident_location": None,
        }
    else:
        security = {
            "recommended": False,
            "reason": "no significant incidents",
            "incident_type": None,
            "estimated_time_saved_s": None,
            "incident_location": None,
        }

    return {
        "hospital": chosen["hospital"],
        "route": chosen["route"],
        "effective_duration_s": chosen["effective_duration_s"],
        "alternatives": alternatives,
        "security_recommendation": security,
    }
