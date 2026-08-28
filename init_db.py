from sqlalchemy import text
from app.database import engine, Base, SessionLocal
from app.models.user import User
from app.models.classroom import Classroom, Enrollment
from app.utils.security import get_password_hash

def init():
    print("Resetting database schema (CASCADE)...")
    with engine.connect() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE;"))
        conn.execute(text("CREATE SCHEMA public;"))
        conn.commit()

    print("Creating fresh database tables...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Create default teacher account
        teacher = User(
            email="teacher@noteai.com",
            hashed_password=get_password_hash("password123"),
            full_name="Prof. Alan Turing",
            role="teacher"
        )
        db.add(teacher)
        db.commit()
        print("Created default teacher account: teacher@noteai.com / password123")

        # Create default student account
        student = User(
            email="student@noteai.com",
            hashed_password=get_password_hash("password123"),
            full_name="Subham Student",
            role="student"
        )
        db.add(student)
        db.commit()
        print("Created default student account: student@noteai.com / password123")

        print("Database initialization complete! No default classrooms created.")
    finally:
        db.close()

if __name__ == "__main__":
    init()
