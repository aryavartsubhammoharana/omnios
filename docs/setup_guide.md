# Setup & Deployment Guide

## Prerequisites
- Node.js (v18+)
- Python (3.10+)

## 1. Backend Setup
`ash
cd backend (or app root)
python -m venv venv
source venv/bin/activate  # or venv\Scriptsctivate on Windows
pip install -r requirements.txt
`

### Environment Variables (.env)
`env
USE_GCS=True
GCS_BUCKET_NAME=omnios-documents
GOOGLE_APPLICATION_CREDENTIALS=gcs_credentials.json
GEMINI_API_KEY=your_google_api_key
SARVAM_API_KEY=your_sarvam_api_key
`

### Run Server
`ash
uvicorn app.main:app --reload --port 8000
`

## 2. Frontend Setup
`ash
cd frontend
npm install
npm run dev
`

## 3. Google Cloud Storage (GCS) Setup
1. Create a Bucket in GCP.
2. Create a Service Account with 'Storage Object Admin' role.
3. Download the JSON key, rename it to gcs_credentials.json and place it in the backend root.
