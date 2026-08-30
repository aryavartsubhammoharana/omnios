import pytest
from app.models.user import User
from app.utils.security import get_password_hash

def test_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "OmniOS" in data["message"]

def test_teacher_login(client, db_session):
    teacher = User(
        email="teacher@noteai.com",
        hashed_password=get_password_hash("password123"),
        full_name="Teacher User",
        role="teacher",
        auth_provider="local",
        is_verified=True,
        is_role_confirmed=True
    )
    db_session.add(teacher)
    db_session.commit()

    response = client.post("/api/auth/login", json={
        "email": "teacher@noteai.com",
        "password": "password123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["role"] == "teacher"

def test_student_login(client, db_session):
    student = User(
        email="student@noteai.com",
        hashed_password=get_password_hash("password123"),
        full_name="Student User",
        role="student",
        auth_provider="local",
        is_verified=True,
        is_role_confirmed=True
    )
    db_session.add(student)
    db_session.commit()

    response = client.post("/api/auth/login", json={
        "email": "student@noteai.com",
        "password": "password123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["role"] == "student"
