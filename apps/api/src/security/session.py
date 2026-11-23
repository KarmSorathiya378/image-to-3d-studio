import secrets
import hashlib
from datetime import datetime, timedelta, timezone

def generate_session_token() -> str:
    """Generates a high-entropy cryptographically secure random session token."""
    return secrets.token_urlsafe(32)

def hash_session_token(token: str) -> str:
    """Computes SHA-256 digest of session token to prevent database token leakage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def calculate_expiration(hours: int = 72) -> datetime:
    """Calculates UTC expiration timestamp for sessions."""
    return datetime.now(timezone.utc) + timedelta(hours=hours)
