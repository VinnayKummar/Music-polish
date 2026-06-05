import bcrypt

import bcrypt

def hash_password(password: str) -> str:
    """Convert password to hash"""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check if password matches hash"""
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())