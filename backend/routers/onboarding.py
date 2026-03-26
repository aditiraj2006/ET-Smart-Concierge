"""
routers/onboarding.py — Conversational onboarding flow.
"""
from fastapi import APIRouter, Depends, HTTPException

import database as db
import services.gemini_service as gemini
import services.profile_service as profile_svc
from middleware.auth import verify_firebase_token
from models.chat import OnboardingRequest, OnboardingResponse

router = APIRouter()


@router.post("/chat", response_model=OnboardingResponse)
async def onboarding_chat(
    req: OnboardingRequest,
):
    verified_uid = req.user_id
    """
    Conversational onboarding.  When the AI collects all 5 profile fields
    it persists the profile under the verified Firebase UID.
    """
    # Users may only onboard themselves
    if req.user_id and req.user_id != verified_uid:
        raise HTTPException(status_code=403, detail="Forbidden")

    result = await gemini.onboarding_chat(
        message=req.message,
        conversation_history=[m.model_dump() for m in req.conversation_history],
    )

    if result["is_complete"] and result.get("extracted_profile"):
        profile = await profile_svc.create_profile(
            {**result["extracted_profile"], "user_id": verified_uid}
        )
        return OnboardingResponse(
            reply=result["reply"],
            is_complete=True,
            extracted_profile={"user_id": profile.user_id, **result["extracted_profile"]},
        )

    return OnboardingResponse(reply=result["reply"])

@router.get("/status/{user_id}")
async def onboarding_status(
    user_id: str,
):
    verified_uid = user_id
    """Return whether a user has completed onboarding and basic profile info."""
    if user_id != verified_uid:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    user = await db.get_user(user_id)
    
    # Return more info for the dashboard
    return {
        "user_id": user_id,
        "onboarding_completed": bool(user and user.get("onboarding_completed")),
        "name": user.get("name") if user else None,
        "goal_type": user.get("goal_type") if user else None,
        "risk_appetite": user.get("risk_appetite") if user else None,
        "investment_knowledge": user.get("investment_knowledge") if user else None,
        "persona": user.get("persona") if user else None,
    }
