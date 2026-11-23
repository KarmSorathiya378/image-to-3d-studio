import base64
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from ..config import settings

def get_aesgcm() -> AESGCM:
    master_key = settings.master_key.encode("utf-8")
    # Ensure master key is exactly 32 bytes for AES-256
    if len(master_key) < 32:
        master_key = master_key.ljust(32, b"0")
    else:
        master_key = master_key[:32]
    return AESGCM(master_key)

def mask_credential(secret: str) -> str:
    """Creates a non-sensitive key mask (e.g. sk-••••1234)."""
    if len(secret) <= 8:
        return "••••" + secret[-2:] if len(secret) >= 2 else "••••"
    prefix = secret[:3]
    suffix = secret[-4:]
    return f"{prefix}••••{suffix}"

def encrypt_credential_secret(plain_secret: str) -> tuple[str, str]:
    """
    Encrypts a secret using AES-256-GCM.
    Returns (encrypted_ciphertext_b64, nonce_b64).
    """
    aesgcm = get_aesgcm()
    nonce = os.urandom(12)  # 96-bit standard nonce for AES-GCM
    ciphertext = aesgcm.encrypt(nonce, plain_secret.encode("utf-8"), None)
    return (
        base64.b64encode(ciphertext).decode("ascii"),
        base64.b64encode(nonce).decode("ascii"),
    )

def decrypt_credential_secret(encrypted_ciphertext_b64: str, nonce_b64: str) -> str:
    """Decrypts AES-256-GCM ciphertext using the master key."""
    aesgcm = get_aesgcm()
    ciphertext = base64.b64decode(encrypted_ciphertext_b64.encode("ascii"))
    nonce = base64.b64decode(nonce_b64.encode("ascii"))
    decrypted_bytes = aesgcm.decrypt(nonce, ciphertext, None)
    return decrypted_bytes.decode("utf-8")
