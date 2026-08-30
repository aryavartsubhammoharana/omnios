import pytest
from unittest.mock import patch, MagicMock
from app.models.user import User
from app.utils.security import get_password_hash, create_access_token

def test_signup_and_verify_otp_flow(client):
    # 1. Signup
    signup_payload = {
        "email": "teststudent@example.com",
        "password": "Password123!",
        "full_name": "Test Student",
        "role": "student",
        "student_class": "10th Grade"
    }
    response = client.post("/api/auth/signup", json=signup_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["requires_otp"] is True
    assert "dev_otp" in data
    otp = data["dev_otp"]

    # 2. Verify with invalid OTP
    bad_verify = client.post("/api/auth/verify-otp", json={
        "email": "teststudent@example.com",
        "otp": "000000"
    })
    assert bad_verify.status_code == 400

    # 3. Verify with correct OTP
    good_verify = client.post("/api/auth/verify-otp", json={
        "email": "teststudent@example.com",
        "otp": otp
    })
    assert good_verify.status_code == 200
    token_data = good_verify.json()
    assert "access_token" in token_data
    assert token_data["user"]["email"] == "teststudent@example.com"
    assert token_data["user"]["is_verified"] is True

    # 4. Login after verification should succeed
    login_success = client.post("/api/auth/login", json={
        "email": "teststudent@example.com",
        "password": "Password123!"
    })
    assert login_success.status_code == 200
    assert "access_token" in login_success.json()

def test_unverified_login_behavior(client):
    # 1. Signup
    client.post("/api/auth/signup", json={
        "email": "unverified@example.com",
        "password": "Password123!",
        "full_name": "Unverified User",
        "role": "student",
        "student_class": "10th Grade"
    })

    # 2. Login before verification should fail with 403
    login_response = client.post("/api/auth/login", json={
        "email": "unverified@example.com",
        "password": "Password123!"
    })
    assert login_response.status_code == 403
    assert "EMAIL_NOT_VERIFIED" in login_response.json()["detail"]

def test_google_auth_endpoint(client):
    mock_google_response = MagicMock()
    mock_google_response.status_code = 200
    mock_google_response.json.return_value = {
        "email": "googler@example.com",
        "name": "Google User",
        "picture": "https://example.com/photo.jpg",
        "sub": "google_uid_12345",
        "email_verified": True,
        "aud": "mock_client_id"
    }

    with patch("requests.get", return_value=mock_google_response):
        response = client.post("/api/auth/google", json={
            "credential": "mock_id_token_xyz",
            "role": "student"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == "googler@example.com"
        assert data["user"]["google_id"] == "google_uid_12345"
        assert data["user"]["auth_provider"] == "google"
        assert data["user"]["is_verified"] is True

def test_confirm_role_and_password_change(client, db_session):
    user = User(
        email="roleuser@example.com",
        hashed_password=get_password_hash("OldPassword123!"),
        full_name="Role User",
        role="student",
        auth_provider="local",
        is_verified=True,
        is_role_confirmed=False
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    user_id = user.id

    token = create_access_token(subject=user_id)
    headers = {"Authorization": f"Bearer {token}"}

    # Test confirm-role via PUT and POST
    put_role = client.put("/api/auth/confirm-role", json={"role": "teacher"}, headers=headers)
    assert put_role.status_code == 200
    assert put_role.json()["role"] == "teacher"
    assert put_role.json()["is_role_confirmed"] is True

    # Test change-password via PUT
    change_pwd = client.put("/api/auth/change-password", json={
        "old_password": "OldPassword123!",
        "new_password": "NewPassword456!"
    }, headers=headers)
    assert change_pwd.status_code == 200
    assert change_pwd.json()["message"] == "Password changed successfully."
