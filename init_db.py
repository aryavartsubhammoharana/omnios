from sqlalchemy import text
from app.database import engine, Base

def init():
    print("Resetting database schema (CASCADE)...")
    with engine.connect() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE;"))
        conn.execute(text("CREATE SCHEMA public;"))
        conn.commit()

    print("Creating fresh database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database initialization complete! Clean database ready for Google OAuth users.")

if __name__ == "__main__":
    init()
