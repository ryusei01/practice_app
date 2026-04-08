from __future__ import annotations

from typing import Any


_DANGEROUS_PREFIXES = ("=", "+", "-", "@")


def sanitize_csv_cell(value: Any) -> Any:
    """
    Mitigate CSV injection (formula injection) for spreadsheet apps.

    If a string value begins (after leading whitespace) with one of: = + - @,
    prefix it with a single quote so Excel/Sheets treat it as literal text.
    """
    if value is None:
        return None
    if not isinstance(value, str):
        return value

    if value == "":
        return value

    stripped = value.lstrip()
    if not stripped:
        return value

    if stripped[0] in _DANGEROUS_PREFIXES:
        # idempotent: if already prefixed, keep as-is
        if value.startswith("'"):
            return value
        return "'" + value

    return value


def sanitize_csv_payload(obj: Any) -> Any:
    """
    Recursively sanitize strings inside dict/list payloads.
    Intended for request validation before DB persistence.
    """
    if obj is None:
        return None
    if isinstance(obj, str):
        return sanitize_csv_cell(obj)
    if isinstance(obj, list):
        return [sanitize_csv_payload(x) for x in obj]
    if isinstance(obj, tuple):
        return tuple(sanitize_csv_payload(x) for x in obj)
    if isinstance(obj, dict):
        return {k: sanitize_csv_payload(v) for k, v in obj.items()}
    return obj

