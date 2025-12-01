import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from typing import Generator

DATABASE_URL = "sqlite:///./app.db"

engine = create_engine(DATABASE_URL,connect_args={"check_same_thread": False})

#create session for requesting data from database
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for your models
Base = declarative_base()

#creat session and makes sure its closed
def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
