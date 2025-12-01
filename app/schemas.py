from pydantic import BaseModel, Field, constr
from typing import Optional
from datetime import datetime

#user create schema 
class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    
#user info schema
class UserOut(BaseModel):
    id: int
    username: str
    email: str

    class Config:
        orm_mode = True

class LoginSchema(BaseModel):
    username: str
    password: str

class ExpenseBase(BaseModel):
    title: str
    amount : float
    category : str
    description: str
class ExpenseCreate(ExpenseBase):
    pass

class ExpenseUpdate(BaseModel):
    title: str
    amount : float
    category : str
    description: Optional[str]

class ExpenseOut(BaseModel):
    id: int
    title: str
    amount : float
    category : str
    description: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config:#read sql object attributes and map to pydantic
        orm_mode = True
        
class CategoryReq(BaseModel):
    title: str
    description: Optional[str] = ""

class CategoryResp(BaseModel):
    category: str
    source: Optional[str] = None