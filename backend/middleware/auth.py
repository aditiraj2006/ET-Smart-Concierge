"""
middleware/auth.py — Firebase ID token verification for FastAPI.

Extracts the Bearer token from the Authorization header, verifies it with
Firebase Admin SDK (async-wrapped), and returns the verified Firebase UID.

Usage in routers:
    from middleware.auth import verify_firebase_token
    from fastapi import Depends

    @router.get("/something")
    async def handler(verified_uid: str = Depends(verify_firebase_token)):
        ...
"""
import asyncio

from fastapi import Header, HTTPException
from firebase_admin import auth


async def verify_firebase_token(
    authorization: str = Header(..., description="Firebase Bearer token"),
) -> str:
    """
    FastAPI dependency.  Parses and verifies the Firebase ID token.
    Returns the verified uid on success; raises 401 on any failure.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Invalid Authorization header. Expected: Bearer <token>",
        )

    token = authorization.split("Bearer ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")

    try:
        decoded = await asyncio.to_thread(auth.verify_id_token, token)
        return decoded["uid"]
    except auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token expired — please re-authenticate")
    except auth.RevokedIdTokenError:
        raise HTTPException(status_code=401, detail="Token has been revoked")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
