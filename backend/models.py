from pydantic import BaseModel, Field


class SignupRequest(BaseModel):
    username: str = Field(min_length=1, max_length=30)
    password: str = Field(min_length=6)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class LogRequest(BaseModel):
    username:  str   = Field(min_length=1)
    song:      str   = Field(min_length=1)
    latitude:  float = Field(ge=-90,  le=90)
    longitude: float = Field(ge=-180, le=180)


class ChatRequest(BaseModel):
    receiver: str = Field(min_length=1)
    content:  str = Field(min_length=1, max_length=500)
