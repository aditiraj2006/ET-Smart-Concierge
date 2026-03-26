"""
backend/firebase_admin_init.py
Initialises Firebase Admin SDK from a service-account JSON file.
Provides:
  - firestore_db  : Firestore client (used by database.py)
  - get_current_user() : kept for backward compat — delegates to middleware.auth
"""
import firebase_admin
from firebase_admin import credentials, firestore
from config import settings

if not firebase_admin._apps:
    _cred = credentials.Certificate(settings.firebase_credentials_path)
    firebase_admin.initialize_app(_cred)

firestore_db = firestore.client()
