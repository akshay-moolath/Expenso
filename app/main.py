from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles#for getting simple html page for login,register and dashboard
from fastapi.responses import FileResponse
from app.db import Base, engine
import app.models 



Base.metadata.create_all(bind=engine)

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

#include book  & user crud to main.py
from app.crud.expenses import router as book_router
app.include_router(book_router, prefix="/api")
from app.crud.user import router as user_router
app.include_router(user_router, prefix="/api")


@app.get("/")# connecting static pages to url/endpoint
def home():
    return FileResponse("static/login.html")


@app.get("/register-page")
def register_page():
    return FileResponse("static/register.html")

@app.get("/dashboard")
def dashboard_page():
    return FileResponse("static/dashboard.html")