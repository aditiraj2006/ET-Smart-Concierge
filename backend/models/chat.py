from pydantic import BaseModel
from enum import Enum
from typing import List, Optional


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"


class ChatMessage(BaseModel):
    role: MessageRole
    content: str


# ── Onboarding ─────────────────────────────────────────────────────────────

class OnboardingRequest(BaseModel):
    user_id: str
    message: str
    conversation_history: List[ChatMessage] = []


class OnboardingResponse(BaseModel):
    reply: str
    is_complete: bool = False
    extracted_profile: Optional[dict] = None   # partial profile data extracted so far


# ── Assistant ──────────────────────────────────────────────────────────────

class AssistantRequest(BaseModel):
    user_id: str
    message: str
    conversation_history: List[ChatMessage] = []


class GoalPlan(BaseModel):
    goal_type: str
    target_amount: float
    timeline_months: int
    monthly_saving: float
    down_payment: Optional[float] = None
    loan_amount: Optional[float] = None
    emi_estimate: Optional[float] = None
    milestones: List[str] = []
    et_recommendations: List[str] = []        # article/tool titles


class AssistantResponse(BaseModel):
    reply: str
    goal_plan: Optional[GoalPlan] = None
    has_plan: bool = False
    suggestions: List[str] = []               # quick-reply chips
