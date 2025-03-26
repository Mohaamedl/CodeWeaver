from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func

Base = declarative_base()

class ReviewSession(Base):
    __tablename__ = 'review_sessions'
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    repo_path = Column(Text)
    summary = Column(Text, nullable=True)
    suggestions = relationship('Suggestion', back_populates='session', cascade='all, delete-orphan')

class Suggestion(Base):
    __tablename__ = 'suggestions'
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey('review_sessions.id'), nullable=False)
    agent = Column(String(50))
    message = Column(Text)
    patch = Column(Text, nullable=True)
    file_path = Column(Text, nullable=True)
    status = Column(String(20), default='pending')
    session = relationship('ReviewSession', back_populates='suggestions')
