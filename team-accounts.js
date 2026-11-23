/*
 * OM ERP - Manager / Staff account creation (owner only).
 * Include AFTER the Firebase app/auth/firestore scripts on team-access-admin.html:
 *   <script src="team-accounts.js"></script>
 * Usage (owner must be logged in):
 *   await omCreateTeamMember({ role:'staff', loginId:'STF-001-1', password:'abc123',
 *                              name:'Rahul', branchId:'main' });
 *   -> Manager/Staff can then login on login.html with that loginId + password.
 */
(function () {
  'use strict';
  var CFG = {
    apiKey: 'AIzaSyAHEMISEIDSzZz-m2OQT5EPyhTRF-mXqjQ',
    authDomain: 'bfc-gym-215ae.firebaseapp.com',
    projectId: 'bfc-gym-215ae',
    storageBucket: 'bfc-gym-215ae.firebasestorage.app',
    messagingSenderId: '886920088571',
    appId: '1:886920088571:web:c4bc478d246a2700b0d95e'
  };

  function keyOf(loginId) { return String(loginId || '').trim().toLowerCase().replace(/[\/\s]/g, '_'); }
  function emailFor(key, gymId) {
    var local = key.replace(/[^a-z0-9._-]/g, '-') + '.' + String(gymId).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
    return local + '@team.om-erp.app';
  }

  window.omCreateTeamMember = async function (opts) {
    opts = opts || {};
    var role = String(opts.role || '').toLowerCase();
    if (role !== 'manager' && role !== 'staff') throw new Error('role manager ya staff hona chahiye');
    var key = keyOf(opts.loginId);
    if (!key) throw new Error('Login ID daalein');
    if (!opts.password || String(opts.password).length < 6) throw new Error('Password kam se kam 6 character ka ho');
    if (!opts.branchId) throw new Error('Branch ID zaroori hai');

    if (!firebase.apps.length) firebase.initializeApp(CFG);
    var owner = firebase.auth().currentUser;
    if (!owner) throw new Error('Pehle owner login karein');
    var db = firebase.firestore();
    var gymId = (window.omSecureSession && window.omSecureSession.gymId) || opts.gymId || owner.uid;

    var existing = await db.collection('login_index').doc(key).get();
    if (existing.exists) throw new Error('Yeh Login ID pehle se use mein hai: ' + opts.loginId);

    var email = String(opts.email || emailFor(key, gymId)).toLowerCase();
    var secondary = firebase.initializeApp(CFG, 'team-' + Date.now());
    var cred = null;
    try {
      cred = await secondary.auth().createUserWithEmailAndPassword(email, String(opts.password));
      var uid = cred.user.uid;

      // users doc (owner is the writer, allowed by rules)
      await db.collection('users').doc(uid).set({
        uid: uid, role: role, gymId: gymId, branchId: String(opts.branchId),
        displayName: opts.name || opts.loginId, loginId: String(opts.loginId), email: email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // login lookup (written as the new user so it points to its own email)
      await secondary.firestore().collection('login_index').doc(key).set({
        email: email, uid: uid, gymId: gymId, role: role
      });

      await secondary.auth().signOut();
      return { uid: uid, email: email, loginId: opts.loginId, role: role, gymId: gymId, branchId: String(opts.branchId) };
    } catch (e) {
      try { if (cred && cred.user) { await db.collection('users').doc(cred.user.uid).delete().catch(function () {}); await cred.user.delete(); } } catch (x) {}
      throw e;
    } finally {
      try { await secondary.delete(); } catch (x) {}
    }
  };
})();
