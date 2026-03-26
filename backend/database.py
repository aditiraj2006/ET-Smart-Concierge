"""
database.py — Firestore-backed storage for ET Smart Concierge.
Uses asyncio.to_thread so Firestore's synchronous client never blocks the event loop.
Collections:
  users        — user profiles (doc ID = Firebase UID)
  chat_history — per-user, per-session message log
"""
import asyncio
from datetime import datetime

import firebase_admin
from firebase_admin import credentials, firestore
from config import settings

# Initialise Firebase Admin once (guard against hot-reload double-init)
if not firebase_admin._apps:
    _cred = credentials.Certificate(settings.firebase_credentials_path)
    firebase_admin.initialize_app(_cred)

db = firestore.client()

# ── Users ──────────────────────────────────────────────────────────────────

async def save_user(user_id: str, data: dict) -> None:
    await asyncio.to_thread(
        db.collection("users").document(user_id).set, data
    )


async def get_user(user_id: str) -> dict | None:
    doc = await asyncio.to_thread(
        db.collection("users").document(user_id).get
    )
    return doc.to_dict() if doc.exists else None


async def update_user(user_id: str, updates: dict) -> dict | None:
    updates["updated_at"] = datetime.utcnow().isoformat()
    ref = db.collection("users").document(user_id)

    doc = await asyncio.to_thread(ref.get)
    if not doc.exists:
        return None

    await asyncio.to_thread(ref.update, updates)
    updated = await asyncio.to_thread(ref.get)
    return updated.to_dict()


async def list_users() -> list[str]:
    docs = await asyncio.to_thread(
        lambda: list(db.collection("users").stream())
    )
    return [d.id for d in docs]


# ── Chat History ───────────────────────────────────────────────────────────

async def save_chat_message(
    user_id: str,
    session_type: str,
    role: str,
    content: str,
) -> None:
    """Append a single message to the chat_history collection."""
    await asyncio.to_thread(
        db.collection("chat_history").add,
        {
            "user_id":      user_id,
            "session_type": session_type,
            "role":         role,
            "content":      content,
            "created_at":   datetime.utcnow().isoformat(),
        },
    )


async def get_chat_history(user_id: str, session_type: str) -> list[dict]:
    """Return messages for a user/session ordered by creation time."""
    def _fetch():
        return list(
            db.collection("chat_history")
            .where("user_id", "==", user_id)
            .where("session_type", "==", session_type)
            .order_by("created_at")
            .stream()
        )
    docs = await asyncio.to_thread(_fetch)
    return [d.to_dict() for d in docs]
