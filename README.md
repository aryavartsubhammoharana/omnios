# NoteAI — Classroom Knowledge & Learning Platform

## Image Extraction & Same-Page Merging with Groq Vision

### Same-Page-Only Merging Rule
When documents (PDF/DOCX) are uploaded, all embedded images are extracted and strictly grouped by their exact `page_number`. Images from different pages are never merged together into the same batch, ensuring that page boundaries and context are strictly preserved. When a page has multiple diagrams, they are merged into a single labeled thumbnail grid (`Image 1`, `Image 2`, etc.) and analyzed in a single Groq Vision request to respect API request limits.

### Installation
```bash
pip install -r requirements.txt
```

### Environment Variables
Configure your `.env` with:
```env
GROQ_API_KEY=your_groq_api_key_here
```

### Example Curl Commands

View all image batches and Groq Vision responses for a document:
```bash
curl -X GET "http://127.0.0.1:8000/api/upload/image-batches/1" \
     -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>"
```

View extracted images with their per-image analysis:
```bash
curl -X GET "http://127.0.0.1:8000/api/upload/images/1" \
     -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>"
```

Re-analyze a specific image:
```bash
curl -X POST "http://127.0.0.1:8000/api/upload/reanalyze-image/<IMAGE_UUID>" \
     -H "Authorization: Bearer <TEACHER_ACCESS_TOKEN>"
```
