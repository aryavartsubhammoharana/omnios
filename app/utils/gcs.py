import os
import uuid
from typing import Optional
from google.cloud import storage

# Fallback/toggle for GCS vs Local Storage
USE_GCS = os.getenv("USE_GCS", "False").lower() in ["true", "1", "t"]
GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "omnios-documents")

def get_gcs_client():
    try:
        if USE_GCS:
            return storage.Client()
        return None
    except Exception as e:
        print(f"GCS Setup Warning: {e}")
        return None

def upload_file_to_gcs(file_bytes: bytes, filename: str, content_type: str = "application/pdf") -> Optional[str]:
    client = get_gcs_client()
    if not client: return None

    try:
        bucket = client.bucket(GCS_BUCKET_NAME)
        unique_blob_name = f"documents/{uuid.uuid4()}_{filename}"
        blob = bucket.blob(unique_blob_name)
        blob.upload_from_string(file_bytes, content_type=content_type)
        return f"https://storage.googleapis.com/{GCS_BUCKET_NAME}/{unique_blob_name}"
    except Exception as e:
        print(f"Failed to upload to GCS: {e}")
        return None

def delete_file_from_gcs(public_url: str) -> bool:
    client = get_gcs_client()
    if not client or not public_url: return False
    
    try:
        prefix = f"https://storage.googleapis.com/{GCS_BUCKET_NAME}/"
        if public_url.startswith(prefix):
            blob_name = public_url.replace(prefix, "")
            bucket = client.bucket(GCS_BUCKET_NAME)
            blob = bucket.blob(blob_name)
            blob.delete()
            return True
    except Exception as e:
        print(f"Failed to delete from GCS: {e}")
    return False
