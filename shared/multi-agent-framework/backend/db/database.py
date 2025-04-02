from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.db.models import Base

DATABASE_URL = "sqlite:///backend/db/database.db"
engine = create_engine(DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, expire_on_commit=False)

# If database is not migrated, you can create tables manually (for development):
# Base.metadata.create_all(bind=engine)
