# routers/assistant.py (updated)
"""
routers/assistant.py — Enhanced goal-planning and financial Q&A with ET integration.
"""
import asyncio
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

import services.gemini_service as gemini
import services.profile_service as profile_svc
from middleware.auth import verify_firebase_token
from models.chat import AssistantRequest, AssistantResponse, GoalPlan

router = APIRouter()

_PROFILE_UPDATE_KEYWORDS = ("income", "salary", "risk", "low risk", "high risk", "medium risk")


@router.post("/chat", response_model=AssistantResponse)
async def assistant_chat(
    req: AssistantRequest,
    verified_uid: str = Depends(verify_firebase_token),
):
    """Send a message to the financial assistant with ET news integration."""
    if req.user_id != verified_uid:
        raise HTTPException(status_code=403, detail="Forbidden")

    profile = await profile_svc.get_profile(req.user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found. Complete onboarding first.")

    # Update profile if user mentions financial details
    msg_lower = req.message.lower()
    if any(kw in msg_lower for kw in _PROFILE_UPDATE_KEYWORDS):
        profile = await profile_svc.update_profile_from_chat(req.user_id, req.message) or profile

    profile_dict = profile.model_dump()
    history = [m.model_dump() for m in req.conversation_history]

    # Use enhanced chat with ET news
    result = await gemini.financial_chat_with_et(
        req.message, 
        history, 
        profile_dict
    )

    # Save goal if one was created
    if result["has_plan"] and result.get("goal_plan"):
        await profile_svc.add_goal(req.user_id, result["goal_plan"])

    goal_plan_model = GoalPlan(**result["goal_plan"]) if result.get("goal_plan") else None

    return AssistantResponse(
        reply=result["reply"],
        goal_plan=goal_plan_model,
        has_plan=result["has_plan"],
        suggestions=result.get("suggestions", []),
    )


@router.get("/journey/{user_id}")
async def get_et_journey(
    user_id: str,
    verified_uid: str = Depends(verify_firebase_token),
):
    """Return personalized ET journey recommendations for the user."""
    if user_id != verified_uid:
        raise HTTPException(status_code=403, detail="Forbidden")
    profile = await profile_svc.get_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    profile_dict = profile.model_dump()
    journey = await gemini.generate_et_journey(profile_dict)
    return journey

@router.get("/explain/{concept}")
async def explain_concept(
    concept: str,
    verified_uid: str = Depends(verify_firebase_token),
):
    """Explain a financial concept in simple terms."""
    profile = await profile_svc.get_profile(verified_uid)
    profile_dict = profile.model_dump() if profile else {}
    
    explanation = await gemini.explain_financial_concept(concept, profile_dict)
    return {"concept": concept, "explanation": explanation}


@router.get("/advice/{topic}")
async def get_advice(
    topic: str,
    verified_uid: str = Depends(verify_firebase_token),
):
    """Get financial advice on a specific topic."""
    profile = await profile_svc.get_profile(verified_uid)
    profile_dict = profile.model_dump() if profile else {}
    
    advice = await gemini.get_financial_advice(topic, profile_dict)
    return {"topic": topic, "advice": advice}


@router.get("/next-action/{user_id}")
async def get_next_action(
    user_id: str,
    verified_uid: str = Depends(verify_firebase_token),
):
    if user_id != verified_uid:
        raise HTTPException(status_code=403, detail="Forbidden")

    profile = await profile_svc.get_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    try:
        result = await gemini.get_next_best_action(profile.model_dump())
        return {
            "action": result.get("action", ""),
            "reason": result.get("reason", ""),
            "cta": result.get("cta", ""),
            "type": result.get("type", "optimize"),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to generate next action: {exc}")


@router.get("/financial-score/{user_id}")
async def get_financial_score(
    user_id: str,
    verified_uid: str = Depends(verify_firebase_token),
):
    if user_id != verified_uid:
        raise HTTPException(status_code=403, detail="Forbidden")

    profile = await profile_svc.get_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    try:
        score = await gemini.calculate_financial_score(profile.model_dump())
        return {
            "score": score.get("score", 0),
            "label": score.get("label", ""),
            "insight": score.get("insight", ""),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to calculate financial score: {exc}")


@router.get("/nudges/{user_id}")
async def get_user_nudges(
    user_id: str,
    verified_uid: str = Depends(verify_firebase_token),
):
    if user_id != verified_uid:
        raise HTTPException(status_code=403, detail="Forbidden")

    profile = await profile_svc.get_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    try:
        nudges = await gemini.generate_nudges(profile.model_dump())
        return nudges
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to generate nudges: {exc}")