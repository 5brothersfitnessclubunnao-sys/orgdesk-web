OM SOFTWARE ERP — MANUAL UPI PAYMENT + PLAN / ROLE ACCESS PATCH
Firebase project: orgdesk-fc207

IMPORTANT: This ZIP is configured for the Firebase project ID confirmed by the user: orgdesk-fc207.
Web app config used by these files:
apiKey: AIzaSyAwuFgPJUavmRRzkH0z83FUP0EyfZETCU
authDomain: orgdesk-fc207.firebaseapp.com
projectId: orgdesk-fc207
storageBucket: orgdesk-fc207.firebasestorage.app
messagingSenderId: 677150519977
appId: 1:677150519977:web:74de5f488494280d352fb8

WHAT THIS PATCH INCLUDES
1. Manual UPI plan request to GPay Business UPI ID: 12190940245@okbizaixs.
2. Customer chooses a plan, pays the displayed amount (₹1 only while test mode is enabled), then submits UTR and a compressed payment screenshot.
3. Screenshot is stored as a compressed data URL in Firestore. Firebase Storage is not used.
4. Duplicate UTR is blocked by a Firestore transaction marker / security rule.
5. Developer Master Admin sees pending requests in master-admin.html and must compare the UTR and amount against the actual GPay Business transaction history.
6. Approve activates the selected full plan and creates a license key ending in the plan amount (for example -99, -199, -399, -499, -999). Decline does not activate a plan.
7. Plan and employee role checks use Firestore subscription / user records. The Owner's active plan gates available modules; Manager permissions are separately assigned by the Owner; Staff and Manager use separate portal pages.
8. Employee login uses Firebase Authentication email/password alias. The Firebase Auth user must first be created in Firebase Console; the Owner then maps the employee UID, Employee ID, role, branch and permissions in team-access-admin.html.

NO-BLAZE DESIGN LIMITS
This patch does not use Cloud Functions or Firebase Storage. It is intended for Firebase Spark:
- No Cloud Functions or automated server-side push/email.
- Master Admin pending-payment alert updates live only while master-admin.html is open; browser notifications require permission and an open page.
- Employee Auth users are provisioned manually in Firebase Console because secure Auth user creation from the browser requires a trusted Admin SDK backend.
- Screenshots are stored in Firestore; this consumes Firestore document storage and has practical document-size limits.

TEST PAYMENT MODE — CURRENTLY ENABLED
- plans.html: PLAN_PAYMENT_TEST_MODE = false
- firestore.rules: testPlanPaymentsAllowed() returns false
While testing, the UPI link requests ₹1. Master Admin must still verify the ₹1 transaction in GPay Business and click Approve. Approval activates the FULL selected plan. Never approve based only on the screenshot or customer claim.

BEFORE PUBLIC LAUNCH
1. In plans.html set PLAN_PAYMENT_TEST_MODE = false.
2. In firestore.rules set testPlanPaymentsAllowed() to return false.
3. Publish the updated Firestore Rules only after completing the data-writer migration and testing described below.
If either setting remains enabled, the test-price route may remain available.

DEPLOYMENT ORDER — DO NOT SKIP BACKUP
1. Download/back up the currently hosted website and existing Firestore data.
2. Confirm Firebase Console project is orgdesk-fc207 and that Authentication + Firestore are enabled.
3. Upload the included files to the same website root, replacing only the matching files after backup:
   index.html, login.html, plans.html, master-admin.html,
   team-access-admin.html, tenant-access.js, firestore.rules,
   firebase.json, .firebaserc, plan-bridge.js,
   staff-portal.html, manager-portal.html.
4. Keep existing pay.html, staff-records.html, attendance.html, auth-gate.js and tg-notify.js unchanged for now. They were not fully migrated in this patch.
5. Create/confirm your Developer Master Admin Firebase Authentication user.
6. On a trusted computer, install firebase-admin and run set-master-admin.js using Application Default Credentials:
   npm install firebase-admin
   GOOGLE_APPLICATION_CREDENTIALS=/secure/path/service-account.json node set-master-admin.js YOUR_AUTH_UID
   Never upload the service-account JSON to the website or share it in chat.
7. Firestore Rules are NOT safe to publish until every old page that writes members, admissions, attendance, payments, payroll and staff records is migrated to include correct gymId, branchId and uid fields. The current legacy pages still include LocalStorage and old collection patterns.
8. Once all writers are migrated, test with a separate test gym and test accounts. Then deploy:
   firebase deploy --only firestore:rules
9. Create employee Auth accounts manually in Firebase Console, then map each UID / Employee ID / role / branch / permissions in team-access-admin.html.
10. Test a ₹1 plan request. Confirm the same UTR and ₹1 transaction in GPay Business. Only then approve from Master Admin. Verify subscription status, generated license, owner dashboard plan and role-specific employee screens.

PLAN ACCESS MATRIX IN THIS PATCH
- Staff self-service login requires an active plan of ₹199 or above.
- Staff salary-slip visibility requires an active plan of ₹399 or above.
- Manager login requires an active plan of ₹499 or above.
- Manager permissions are controlled by Owner-assigned permission flags and checked by Firestore Rules.
- Owner module access is gated by active subscription amount. ₹999 includes the higher-tier / multi-branch modules described in plans.html.
- Exact screen access still depends on each page having the tenant-access.js guard and the Firestore Rules. Legacy pages listed above are not yet fully migrated, so do not treat this patch as a completed production-wide security rollout.

VALIDATION STATUS
- Firebase config references in this package have been aligned to orgdesk-fc207.
- This package has not been deployed to your Firebase project from this chat.
- Firestore Rules have not been run in the Firebase Emulator here.
- No payment has been submitted or approved; this ZIP only provides the code/configuration for you to deploy and test.
