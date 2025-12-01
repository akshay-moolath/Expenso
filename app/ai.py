import re
import logging
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.auth import get_current_user
from app import schemas

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ai", tags=["ai"])



def rule_based_category(title: str, description: str) -> str:
    """
    Improved simple classifier:
    - tokenizes title+description
    - matches whole words (word boundaries) to keyword lists
    - returns first matching category, else 'Other'
    """
    text = (title or "") + " " + (description or "")
    text = text.lower()
    # normalize punctuation to spaces so tokens are clean
    text = re.sub(r"[._/,\-:();]+", " ", text)
    # token set for quick membership checks
    tokens = set(re.findall(r"\b[a-z0-9]+\b", text))

    # priority buckets (expandable)
    buckets = [
        ("Food & Drink", {"coffee","tea","restaurant","cafe","latte","eat","eating","dinner","lunch","breakfast","meal","burger","pizza","snack","food","canteen","starbucks","tea"}),
        ("Groceries", {"grocery","supermarket","shop","buy","milk","bread","vegetable","fruit","fruits","groceries","store","bigbasket","aldi"}),
        ("Transport", {"uber","ola","taxi","bus","train","petrol","diesel","fuel","metro","gas","parking","toll","ride","cab"}),
        ("Bills", {"electric","electricity","water","bill","rent","subscription","netflix","isp","invoice","phone","mobile","broadband"}),
        ("Shopping", {"amazon","flipkart","shopping","shirt","pants","shoe","mall","order","purchase","shop"}),
        ("Health", {"pharm","pharmacy","doctor","clinic","hospital","medicine","med","running","run","gym","fitness","exercise","health"}),
        ("Entertainment", {"movie","cinema","spotify","concert","netflix","game","games","entertainment"}),
        ("Travel", {"hotel","flight","airline","booking","trip","travel","airbnb"}),
        ("Education", {"course","udemy","education","books","training","school","college"}),
    ]

    # first check for direct token membership
    for cat, kws in buckets:
        if tokens & kws:
            return cat

    # fallback: substring match for multi-word tokens
    for cat, kws in buckets:
        for kw in kws:
            if kw in text:
                return cat

    return "Other"


@router.post("/category", response_model=schemas.CategoryResp)
async def predict_category(payload: schemas.CategoryReq, current_user = Depends(get_current_user)):
    """
    Predict a category for an expense (server-side rule-based).
    Requires authentication (same dependency you already use).
    Response: { "category": "Food & Drink", "source": "rule-based" }
    """
    title = payload.title or ""
    description = payload.description or ""

    try:
        # run local classifier
        cat = rule_based_category(title, description)
        logger.info("AI (rule-based) predicted category=%s for title=%r", cat, title)
        return {"category": cat, "source": "rule-based"}
    except Exception as exc:
        logger.exception("Category prediction failed: %s", exc)
        # graceful fallback to "Other"
        return {"category": "Other", "source": "rule-based"}
