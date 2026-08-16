import pytest
from shared.utils.security import hash_password, verify_password, create_access_token, decode_token

def test_password_hashing():
    raw_pass = "SecurePass123!"
    hashed = hash_password(raw_pass)
    assert hashed != raw_pass
    assert verify_password(raw_pass, hashed) is True
    assert verify_password("WrongPass", hashed) is False

def test_jwt_token_flow():
    user_id = 42
    email = "test@scaleflow.io"
    role = "ADMIN"
    
    token = create_access_token(user_id=user_id, email=email, role=role)
    assert isinstance(token, str)

    payload = decode_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["email"] == email
    assert payload["role"] == role
    assert payload["type"] == "access"
