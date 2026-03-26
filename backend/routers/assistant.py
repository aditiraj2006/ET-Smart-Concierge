"""
routers/assistant.py — Goal-planning and financial Q&A assistant.
"""
import asyncio
import random
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
    """Send a message to the financial assistant."""
    if req.user_id != verified_uid:
        raise HTTPException(status_code=403, detail="Forbidden")

    profile = await profile_svc.get_profile(req.user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found. Complete onboarding first.")

    msg_lower = req.message.lower()
    if any(kw in msg_lower for kw in _PROFILE_UPDATE_KEYWORDS):
        profile = await profile_svc.update_profile_from_chat(req.user_id, req.message) or profile

    profile_dict = profile.model_dump()
    history = [m.model_dump() for m in req.conversation_history]

    chat_task = asyncio.create_task(gemini.goal_chat(req.message, history, profile_dict))
    opp_task  = asyncio.create_task(gemini.detect_opportunity(req.message, profile_dict))
    result, _ = await asyncio.gather(chat_task, opp_task)

    if result["has_plan"] and result.get("goal_plan"):
        await profile_svc.add_goal(req.user_id, result["goal_plan"])

    goal_plan_model = GoalPlan(**result["goal_plan"]) if result.get("goal_plan") else None

    return AssistantResponse(
        reply=result["reply"],
        goal_plan=goal_plan_model,
        has_plan=result["has_plan"],
        suggestions=result.get("suggestions", []),
    )


@router.get("/goals/{user_id}")
async def get_goals(
    user_id: str,
    verified_uid: str = Depends(verify_firebase_token),
):
    """Return all goals for a user with mock progress percentages."""
    if user_id != verified_uid:
        raise HTTPException(status_code=403, detail="Forbidden")

    profile = await profile_svc.get_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    goals_with_progress: list[dict[str, Any]] = []
    for goal in profile.goals:
        g = goal.model_dump()
        g["progress_pct"] = random.randint(10, 80)
        goals_with_progress.append(g)

    return {"user_id": user_id, "goals": goals_with_progress}
