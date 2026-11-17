rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    match /admissions/{id} {
      allow create: if true;
    }
    match /members/{id} {
      allow read, write: if true;
    }
    match /attendance/{id} {
      allow read, write: if true;
    }
    match /attendance_attempts/{id} {
      allow read, write: if true;
    }
    match /ex_members/{id} {
      allow read, write: if true;
    }
  }
}
