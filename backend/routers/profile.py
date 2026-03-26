"""
routers/profile.py — User profile CRUD.
"""
from fastapi import APIRouter, Depends, HTTPException

import database as db
import services.profile_service as profile_svc
from middleware.auth import verify_firebase_token
from models.user import UserProfile, ProfileUpdate

router = APIRouter()


@router.get("/{user_id}", response_model=UserProfile)
async def get_profile(
    user_id: str,
    verified_uid: str = Depends(verify_firebase_token),
):
    """Return the full profile for a user."""
    if user_id != verified_uid:
        raise HTTPException(status_code=403, detail="Forbidden")
    profile = await profile_svc.get_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.patch("/{user_id}", response_model=UserProfile)
async def patch_profile(
    user_id: str,
    updates: ProfileUpdate,
    verified_uid: str = Depends(verify_firebase_token),
):
    """Partially update a user profile."""
    if user_id != verified_uid:
        raise HTTPException(status_code=403, detail="Forbidden")
    patch = {
        k: v.value if hasattr(v, "value") else v
        for k, v in updates.model_dump().items()
        if v is not None
    }
    if not patch:
        raise HTTPException(status_code=422, detail="No valid fields provided")
    data = await db.update_user(user_id, patch)
    if not data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return UserProfile(**data)


@router.delete("/{user_id}", status_code=200)
async def delete_profile(
    user_id: str,
    verified_uid: str = Depends(verify_firebase_token),
):
    """Permanently delete a user's Firestore document."""
    if user_id != verified_uid:
        raise HTTPException(status_code=403, detail="Forbidden")
    import asyncio
    from database import db as firestore_client
    ref = firestore_client.collection("users").document(user_id)
    doc = await asyncio.to_thread(ref.get)
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Profile not found")
    await asyncio.to_thread(ref.delete)
    return {"deleted": True}
