/*
 * OM Software ERP - authenticated tenant / role / subscription gate.
 * Requires Firebase Auth + Firestore compat SDK and the orgdesk-fc207 project.
 * Trust boundary: roles come from owner_accounts or Firebase custom claims, never from localStorage.
 */
(function () {
  'use strict';
  var CFG = {
    apiKey: 'AIzaSyAwuFgPJIUavmRRzkHOz83FUP0EyfZETCU',
    authDomain: 'orgdesk-fc207.firebaseapp.com',
    projectId: 'orgdesk-fc207',
    storageBucket: 'orgdesk-fc207.firebasestorage.app',
    messagingSenderId: '677150519977',
    appId: '1:677150519977:web:74de5f488494280d352fb8'
  };

  function goLogin(message) {
    if (message) alert(message);
    try {
      ['bfc_role','om_active_role','om_logged_user','bfc_gid','om_team_session','om_active_subscription_plan'].forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
    if (!/login\.html/i.test(location.pathname)) location.replace('login.html');
  }

  function safeRole(v) {
    v = String(v || '').toLowerCase();
    return ['owner','manager','staff'].indexOf(v) >= 0 ? v : '';
  }

  function activeSubscription(data) {
    if (!data || String(data.status || '').toLowerCase() !== 'active') return false;
    var expiry = data.expiresAt || data.expiryAt || data.validUntil || null;
    if (!expiry) return true;
    var ms = typeof expiry === 'number' ? expiry : (expiry.toDate ? expiry.toDate().getTime() : Date.parse(expiry));
    return isFinite(ms) && ms >= Date.now();
  }

  function managerModuleAllow(id, permissions) {
    return Array.isArray(permissions) && permissions.indexOf(String(id)) >= 0;
  }


  function addMpinSetupButton() { /* MPIN requires Cloud Functions; disabled in Spark-only mode. */ }

  function publish(session) {
    window.omSecureSession = session;
    if (session.role === 'staff' && !/staff-portal\.html/i.test(location.pathname)) {
      location.replace('staff-portal.html');
      return;
    }
    if (session.role === 'manager' && !/manager-portal\.html|index\.html/i.test(location.pathname)) {
      location.replace('manager-portal.html');
      return;
    }
    try {
      localStorage.setItem('bfc_role', session.role);
      localStorage.setItem('om_active_role', session.role);
      localStorage.setItem('bfc_gid', session.gymId);
      localStorage.setItem('om_logged_user', session.displayName || session.email || session.role);
      localStorage.setItem('om_secure_session_v1', JSON.stringify({ uid: session.uid, role: session.role, gymId: session.gymId, branchId: session.branchId || '' }));
      if (session.planActive) localStorage.setItem('om_active_subscription_plan', JSON.stringify({ name: session.planName, amount: session.planAmount, status: 'active' }));
      else localStorage.removeItem('om_active_subscription_plan');
    } catch (e) {}
    session.canOpenModule = function (id) {
      if (session.isMasterAdmin) return true;
      if (!session.planActive) return false;
      if (session.role === 'owner') return true;
      if (session.role === 'manager') return Number(session.planAmount || 0) >= 499 && managerModuleAllow(id, session.permissions);
      return false;
    };
    addMpinSetupButton(session);
    var masterBtn = document.getElementById('masterConsoleBtn');
    if (masterBtn) masterBtn.style.display = session.isMasterAdmin ? 'inline-block' : 'none';
    window.dispatchEvent(new CustomEvent('om:session-ready', { detail: session }));
    loadCloudStats(session).catch(function (e) { console.warn('Dashboard stats unavailable:', e); });
  }

  async function loadCloudStats(session) {
    var db = firebase.firestore();
    async function countCollection(name, selfOnly) {
      if (!session.isMasterAdmin && !session.planActive) return 0;
      if (name === 'staff' && !session.isMasterAdmin && Number(session.planAmount || 0) < 399) return 0;
      var q = db.collection(name);
      if (!session.isMasterAdmin) q = q.where('gymId', '==', session.gymId);
      if (session.role === 'manager' && session.branchId) q = q.where('branchId', '==', session.branchId);
      if (session.role === 'staff' && selfOnly) q = q.where('uid', '==', session.uid);
      if (session.role === 'staff' && !selfOnly) return 0;
      try { var snap = await q.get(); return snap.size; } catch (e) { return 0; }
    }
    var stats = { members: 0, admissions: 0, staff: 0 };
    if (session.role !== 'staff') {
      var values = await Promise.all([
        countCollection('members', false),
        countCollection('admissions', false),
        countCollection('staff', false)
      ]);
      stats.members = values[0];
      stats.admissions = values[1];
      stats.staff = values[2];
    } else {
      stats.staff = await countCollection('staff', true);
    }
    window.omCloudStats = stats;
    window.dispatchEvent(new CustomEvent('om:stats-ready', { detail: stats }));
  }

  function start() {
    if (!window.firebase || !firebase.auth || !firebase.firestore) {
      goLogin('Firebase authentication load nahi hua. Firebase SDK / auth configuration check karein.');
      return;
    }
    try { if (!firebase.apps.length) firebase.initializeApp(CFG); } catch (e) {}
    var auth = firebase.auth();
    var db = firebase.firestore();

    auth.onAuthStateChanged(async function (user) {
      if (!user) { goLogin(); return; }
      try {
        var token = await user.getIdTokenResult(true);
        var claims = token.claims || {};
        if (claims.masterAdmin === true) {
          publish({ uid: user.uid, role: 'developer', gymId: '__master__', isMasterAdmin: true, planActive: true, planName: 'Master Admin', planAmount: 999, email: user.email || '', displayName: 'Master Admin' });
          return;
        }

        var role = safeRole(claims.role);
        var gymId = String(claims.gymId || claims.orgId || '');
        var branchId = String(claims.branchId || claims.branch || '');
        var profile = null;
        var ownerSnap = await db.collection('owner_accounts').doc(user.uid).get();

        if (ownerSnap.exists) {
          profile = ownerSnap.data() || {};
          role = 'owner';
          gymId = user.uid;
        } else {
          var userSnap = await db.collection('users').doc(user.uid).get();
          if (!userSnap.exists) throw new Error('Employee profile is not registered by Gym Owner.');
          profile = userSnap.data() || {};
          role = safeRole(profile.role);
          gymId = String(profile.gymId || '');
          branchId = String(profile.branchId || '');
          if (!profile.active || !['manager','staff'].includes(role) || !gymId || !branchId) {
            throw new Error('Employee role / Gym / Branch profile is invalid or inactive.');
          }
        }

        var planSnap = await db.collection('subscriptions').doc(gymId).get();
        var plan = planSnap.exists ? (planSnap.data() || {}) : null;
        var planActive = activeSubscription(plan);
        var planAmount = planActive ? Number(plan.amount || 0) : 0;
        if (role === 'manager' && (!planActive || planAmount < 499)) throw new Error('Manager portal requires an active ₹499+ Gym plan.');
        if (role === 'staff' && (!planActive || planAmount < 199)) throw new Error('Staff portal requires an active ₹199+ Gym plan.');
        publish({
          uid: user.uid,
          role: role,
          gymId: gymId,
          branchId: branchId || (profile && profile.branchId) || '',
          isMasterAdmin: false,
          planActive: planActive,
          planName: planActive ? (plan.name || plan.planName || 'Active Plan') : '',
          planAmount: planAmount,
          permissions: Array.isArray(profile && profile.permissions) ? profile.permissions : [],
          employeeCode: profile && profile.employeeCode || '',
          email: user.email || '',
          displayName: (profile && (profile.ownerName || profile.gymName || profile.name)) || claims.name || user.email || role
        });
      } catch (e) {
        console.error('ERP access verification failed:', e);
        goLogin('Account / Role / Gym access verify nahi ho paya. Secure login dobara karein.\n\nKaaran: ' + ((e && (e.code || e.message)) || e));
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
