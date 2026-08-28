-- Seed Data for NOTE AI Platform
-- Default test password for all seed accounts: Password123!
-- Password hash: $2a$12$e8yvW68lJ8L4zV6U9V8pme5r3C0aK/D9X9/qGv2xH3O1z7q2fG4d6

-- Insert Test Users
INSERT INTO users (id, email, password_hash, first_name, last_name, role, institution_domain, is_verified)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'admin@noteai.edu', '$2a$12$e8yvW68lJ8L4zV6U9V8pme5r3C0aK/D9X9/qGv2xH3O1z7q2fG4d6', 'System', 'Admin', 'ADMIN', 'noteai.edu', true),
    ('22222222-2222-2222-2222-222222222222', 'dr.sharma@institution.edu', '$2a$12$e8yvW68lJ8L4zV6U9V8pme5r3C0aK/D9X9/qGv2xH3O1z7q2fG4d6', 'Rajesh', 'Sharma', 'TEACHER', 'institution.edu', true),
    ('33333333-3333-3333-3333-333333333333', 'aarav.patel@student.edu', '$2a$12$e8yvW68lJ8L4zV6U9V8pme5r3C0aK/D9X9/qGv2xH3O1z7q2fG4d6', 'Aarav', 'Patel', 'STUDENT', 'student.edu', true),
    ('44444444-4444-4444-4444-444444444444', 'priya.singh@student.edu', '$2a$12$e8yvW68lJ8L4zV6U9V8pme5r3C0aK/D9X9/qGv2xH3O1z7q2fG4d6', 'Priya', 'Singh', 'STUDENT', 'student.edu', true),
    ('55555555-5555-5555-5555-555555555555', 'guest.learner@gmail.com', '$2a$12$e8yvW68lJ8L4zV6U9V8pme5r3C0aK/D9X9/qGv2xH3O1z7q2fG4d6', 'Guest', 'Learner', 'FREE_USER', NULL, true)
ON CONFLICT (email) DO NOTHING;

-- Insert Classrooms
INSERT INTO classrooms (id, name, subject, description, classroom_code, teacher_id)
VALUES 
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Data Structures & Algorithms', 'Computer Science', 'Comprehensive notes on Trees, Graphs, Dynamic Programming, and Vector DBs.', 'DSA101', '22222222-2222-2222-2222-222222222222'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Artificial Intelligence & Machine Learning', 'Computer Science', 'Foundations of Neural Networks, Transformers, and Retrieval-Augmented Generation.', 'AIML20', '22222222-2222-2222-2222-222222222222')
ON CONFLICT (classroom_code) DO NOTHING;

-- Insert Classroom Memberships
INSERT INTO classroom_members (id, classroom_id, student_id)
VALUES 
    ('c1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333'),
    ('c2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444'),
    ('c3333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333')
ON CONFLICT (classroom_id, student_id) DO NOTHING;

-- Insert Student Streaks
INSERT INTO student_streaks (student_id, current_streak, longest_streak, last_active_date)
VALUES 
    ('33333333-3333-3333-3333-333333333333', 5, 12, CURRENT_DATE),
    ('44444444-4444-4444-4444-444444444444', 2, 7, CURRENT_DATE)
ON CONFLICT (student_id) DO NOTHING;
