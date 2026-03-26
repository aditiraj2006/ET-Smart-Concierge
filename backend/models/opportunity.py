from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional
import uuid


class OpportunityType(str, Enum):
    HOME_LOAN = "home_loan"
    CREDIT_CARD = "credit_card"
    MUTUAL_FUND = "mutual_fund"
    FIXED_DEPOSIT = "fixed_deposit"
    SIP = "sip"


class OpportunityCard(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: OpportunityType
    icon: str
    chip_label: str
    headline: str
    subtext: str
    cta_primary: str
    cta_secondary: str
    trigger_context: str        # what user behavior triggered this


class OpportunityTriggerRequest(BaseModel):
    user_id: str
    reading_category: Optional[str] = None   # category slug of article user is viewing
    spending_spike: Optional[bool] = False
