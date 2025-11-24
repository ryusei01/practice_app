"""Initialize database tables"""
from app.core.database import Base, engine
from app.models import user, question, marketplace, answer

def init_db():
    """Create all tables in the database"""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")

if __name__ == "__main__":
    init_db()
