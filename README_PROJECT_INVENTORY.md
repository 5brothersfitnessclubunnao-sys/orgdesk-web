# Om Software — Project Inventory & Structure

## Core Updated Files
- `login.html` — Owner/Admin sign-in & account setup with Security Question & Answer verification, Staff Access Code login, and zero-personal-data Quick Demo mode.
- `index.html` — Enterprise Control Desk with live automatic metrics, Cash vs Online branch-wise breakdown, 60-second forced-back logout, same-day new form edit & plan lock, permanent license key tracking, audit log, 5-point security hardening, and cloud state sync.

## Supporting & Security Files
- `auth-gate.js` (if present in workspace)
- `branch-manager-security.js` (if present in workspace)
- `firestore.rules` — Non-secret Firestore security rules template.

## Security Note
- No passwords, private keys, or service-account JSON credentials are included in this archive.
