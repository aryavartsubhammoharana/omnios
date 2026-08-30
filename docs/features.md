# Core Features of OmniOS

## 1. OmniAI Studio
- Chat directly with your study materials.
- Ask doubts, solve math formulas (rendered in LaTeX via KaTeX).
- AI searches specific documents or the entire enrolled classroom context.

## 2. Classroom Management
- Teachers can create classrooms and share a 5-character unique code.
- Students join via code.
- Teachers upload Study Material (PDFs) which instantly sync to all enrolled students.
- Zero-pollution rule: Students cannot upload files into the global classroom stream.

## 3. Quick PDF Reader
- Split-screen interface: Real PDF viewer (iframe) on the left, AI Copilot on the right.
- Persistent document storage.

## 4. Zero-Load Academic Streak System
- Tracks daily engagement based on IST (Indian Standard Time).
- Streaks update automatically upon taking quizzes, chatting with AI, or viewing documents.
- Uses 0-load idempotency (no background polling/timers).

## 5. UI/UX Excellence
- Interactive Canvas Backgrounds that automatically pause when tabs are hidden (isibilitychange API) to save CPU/RAM.
- Static, unclickable branding elements to prevent UI jitter.
