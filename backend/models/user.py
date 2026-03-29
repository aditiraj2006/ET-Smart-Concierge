from pydantic import BaseModel, Field
from enum import Enum
from typing import List, Optional
from datetime import datetime
import uuid


class IncomeRange(str, Enum):
    BELOW_30K = "below_30k"
    RANGE_30_60K = "30k_60k"
    RANGE_60_80K = "60k_80k"
    RANGE_80K_1L = "80k_1l"
    ABOVE_1L = "above_1l"


class RiskAppetite(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class InvestmentKnowledge(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    EXPERT = "expert"


class FinancialGoal(BaseModel):
    goal_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    goal_type: str               # "car", "house", "savings", "investment", "education"
    target_amount: float
    timeline_months: int
    monthly_saving: float
    status: str = "active"       # active, completed, paused
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class UserProfile(BaseModel):
    user_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    income_range: IncomeRange
    risk_appetite: RiskAppetite
    investment_knowledge: InvestmentKnowledge
    goals: List[FinancialGoal] = []
    persona: str = ""            # e.g. "Beginner Investor", "Aggressive Saver"
    persona_history: List[dict] = []
    passive_investor: bool = False
    onboarding_completed: bool = False
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class ProfileUpdate(BaseModel):
    """For dynamic updates via chat e.g. 'my income increased to 80k'."""
    income_range: Optional[IncomeRange] = None
    risk_appetite: Optional[RiskAppetite] = None
    investment_knowledge: Optional[InvestmentKnowledge] = None
    name: Optional[str] = None
    persona: Optional[str] = None
    passive_investor: Optional[bool] = None
    onboarding_completed: Optional[bool] = None
