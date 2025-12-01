from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter()
# Create expense (assign to current user)
@router.post("/expenses", response_model=schemas.ExpenseOut)
def create_expense(payload: schemas.ExpenseCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    expense = models.Expense(
        title=payload.title,
        amount =payload.amount,
        description=payload.description,
        category = payload.category,
        user_id=current_user.id)
    
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense

# list user's expenses
@router.get("/expenses", response_model=list[schemas.ExpenseOut])
def list_Expenses(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Expense).filter(models.Expense.user_id == current_user.id).all()

# Update Expense
@router.put("/expenses/{expense_id}", response_model=schemas.ExpenseOut)
def update_expense(expense_id: int, payload: schemas.ExpenseCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    expense = db.query(models.Expense).get(expense_id)
    if not expense or expense.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="expense not found")

    expense.title = payload.title
    expense.amount =payload.amount
    expense.description = payload.description
    expense.category = payload.category

    db.commit()
    db.refresh(expense)
    return expense

# Delete expense
@router.delete("/expenses/{expense_id}")
def delete_expense(expense_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    expense = db.query(models.Expense).get(expense_id)
    if not expense or expense.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="expense not found")

    db.delete(expense)
    db.commit()
    return {"msg": "deleted"}
