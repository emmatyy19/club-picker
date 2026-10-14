"""Fetch the observed shared-report endpoint, without account credentials."""

import http.client
import json
from pathlib import Path
from urllib.parse import urljoin, urlsplit

from club_picker.trackman import object_value, read_object, report_settings, text_value

HOSTS = {"tm-short.me", "web-dynamic-reports.trackmangolf.com"}
API_HOST = "golf-player-activities.trackmangolf.com"
LIMIT = 20 * 1024 * 1024


def request(
    url: str,
    *,
    payload: dict[str, object] | None = None,
) -> tuple[int, str | None, bytes]:
    """Make a bounded HTTPS request to a verified provider host."""
    parsed = urlsplit(url)
    allowed = {API_HOST} if payload is not None else HOSTS
    if (
        parsed.scheme != "https"
        or parsed.hostname not in allowed
        or parsed.username
        or parsed.password
        or parsed.port not in (None, 443)
    ):
        raise ValueError("Unsupported Trackman URL")
    connection = http.client.HTTPSConnection(parsed.hostname, timeout=30)
    try:
        connection.request(
            "POST" if payload is not None else "GET",
            (parsed.path or "/") + ("?" + parsed.query if parsed.query else ""),
            body=json.dumps(payload) if payload is not None else None,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "club-picker/0.1",
            },
        )
        response = connection.getresponse()
        data = response.read(LIMIT + 1)
        if len(data) > LIMIT:
            raise ValueError("Report exceeds the 20 MB import limit")
        return response.status, response.getheader("Location"), data
    except http.client.HTTPException as error:
        raise ValueError(
            "Trackman request failed; retry or use the cached report"
        ) from error
    finally:
        connection.close()


def fetch_report(url: str) -> dict[str, object]:
    """Resolve an owner-supplied link and request its structured activity report."""
    resolved = url
    for _ in range(6):
        status, location, _ = request(resolved)
        if status in (301, 302, 303, 307, 308) and location:
            resolved = urljoin(resolved, location)
            continue
        if status != 200:
            raise ValueError(f"Trackman link returned HTTP {status}")
        break
    else:
        raise ValueError("Too many Trackman link redirects")
    _, payload = report_settings(resolved)
    status, _, body = request(
        f"https://{API_HOST}/api/reports/getactivityreport", payload=payload
    )
    if status != 200:
        raise ValueError(f"Trackman report returned HTTP {status}")
    return {
        "version": 1,
        "source_url": url,
        "resolved_url": resolved,
        "report": object_value(json.loads(body)),
    }


def load_report(folder: Path, *, refetch: bool = False) -> dict[str, object]:
    """Cache raw evidence privately and reuse it offline on subsequent imports."""
    url = (folder / "report-link.txt").read_text().strip()
    cache = folder / "trackman-report.json"
    if cache.exists() and not refetch:
        result = read_object(cache)
        if result.get("version") != 1 or result.get("source_url") != url:
            raise ValueError("Cached report does not match the link; use --refetch")
        report_settings(text_value(result.get("resolved_url"), limit=8192))
        return result
    result = fetch_report(url)
    cache.write_text(json.dumps(result, indent=2, allow_nan=False) + "\n")
    cache.chmod(0o600)
    return result
