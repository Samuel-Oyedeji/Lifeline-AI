from models import Route


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
