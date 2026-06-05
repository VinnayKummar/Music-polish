from sqlalchemy import Column, create_engine, String, Float, Integer, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime

Base = declarative_base()


class User(Base):
    __tablename__ = 'users'

    username      = Column(String, primary_key=True)
    password      = Column(String, nullable=False)
    song          = Column(String, default="")
    latitude      = Column(Float, default=0)
    longitude     = Column(Float, default=0)
    last_active   = Column(DateTime, default=datetime.utcnow)


class Message(Base):
    __tablename__ = 'messages'

    id        = Column(Integer, primary_key=True, autoincrement=True)
    sender    = Column(String, nullable=False)
    receiver  = Column(String, nullable=False)
    content   = Column(String, nullable=False)
    timestamp = Column(String, nullable=False)


engine = create_engine('sqlite:///polish.db')
Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)
