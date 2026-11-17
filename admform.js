<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Universal SaaS Portal - Professional Digital Admission Form</title>
  <!-- Firebase App & Firestore SDKs -->
  <script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js"></script>
  <style>
    :root { --bg: #0b0b0d; --card: #16161a; --border: #2c2c35; --ac: #ffcc00; --tx: #f0f0f5; --mut: #9999a8; --ok: #2ecc71; --err: #e74c3c; }
    body { background: var(--bg); color: var(--tx); font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 12px; box-sizing: border-box; }
    .container { max-width: 500px; margin: 0 auto; background: var(--card); border: 2px solid var(--ac); border-radius: 16px; padding: 20px; box-shadow: 0 0 30px rgba(255,204,0,0.15); }
    
    .header { text-align: center; border-bottom: 1.5px dashed var(--border); padding-bottom: 12px; margin-bottom: 16px; }
    .header h2 { color: var(--ac); margin: 0; font-size: 18px; font-weight: 900; }
    .header p { color: var(--mut); font-size: 11px; margin: 4px 0 0; }
    
    .step-section { display: none; }
    .step-section.active { display: block; }
    
    .field { margin-bottom: 12px; }
    label { display: block; font-size: 11px; color: #ccc; margin-bottom: 4px; font-weight: 600; }
    input, select, textarea { width: 100%; background: #0b0b0d; border: 1.5px solid var(--border); color: #fff; padding: 10px 12px; border-radius: 8px; font-size: 12px; box-sizing: border-box; outline: none; }
    input:focus, select:focus, textarea:focus { border-color: var(--ac); }
    
    .btn-row { display: flex; gap: 8px; margin-top: 16px; }
    .btn-main { flex: 2; background: var(--ac); color: #000; font-weight: 900; padding: 12px; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; text-align: center; }
    .btn-back { flex: 1; background: #222; color: #aaa; font-weight: bold; padding: 12px; border: 1.5px solid var(--border); border-radius: 8px; cursor: pointer; font-size: 13px; text-align: center; }
    .btn-main:hover, .btn-back:hover { opacity: 0.9; }

    .badge { background: rgba(255,204,0,0.1); border: 1px solid var(--ac); color: var(--ac); font-size: 10px; font-weight: bold; padding: 2px 8px; border-radius: 10px; display: inline-block; margin-bottom: 8px; }
    .warning-box { background: rgba(231,76,60,0.12); border: 1px solid var(--err); color: #ff9999; padding: 10px; border-radius: 8px; font-size: 11px; margin-bottom: 12px; line-height: 1.4; display: none; }
    .up-prev { display: block; margin-top: 6px; width: 100%; max-height: 120px; object-fit: contain; background: #000; border: 1px solid var(--border); border-radius: 6px; }
  </style>
</head>
<body>

<div class="container">
  <!-- Header Bar -->
  <div class="header">
    <div class="badge">UNIVERSAL SAAS PORTAL</div>
    <h2 id="orgTitleDisplay">Loading Organization...</h2>
    <p>Professional Digital Admission & Member Registration</p>
  </div>

  <form id="admissionForm" onsubmit="handleUniversalAdmission(event)">
    
    <!-- STEP 1: Plan & Joining Date -->
    <div id="step1" class="step-section active">
      <div style="font-size: 12px; font-weight: bold; color: var(--ac); margin-bottom: 10px; border-left: 3px solid var(--ac); padding-left: 6px;">1. Membership Plan & Date</div>
      
      <div class="field">
        <label>Joining Date *</label>
        <input type="date" id="admJoiningDate" required>
      </div>

      <div class="field">
        <label>Membership Category / Duration *</label>
        <select id="admPlanCategory">
          <option value="1 Month">1 Month Plan</option>
          <option value="3 Months">3 Months Plan</option>
          <option value="6 Months">6 Months Plan</option>
          <option value="12 Months">12 Months (Annual Plan)</option>
          <option value="Student Offer">Student Special Offer</option>
          <option value="Trial Pass">7 Days Trial Pass</option>
        </select>
      </div>

      <div class="field">
        <label>Time Slot *</label>
        <select id="admTimeSlot">
          <optgroup label="Morning Shift">
            <option value="05:00 AM - 06:00 AM">05:00 AM - 06:00 AM</option>
            <option value="06:00 AM - 07:00 AM" selected>06:00 AM - 07:00 AM</option>
            <option value="07:00 AM - 08:00 AM">07:00 AM - 08:00 AM</option>
          </optgroup>
          <optgroup label="Evening Shift">
            <option value="05:00 PM - 06:00 PM">05:00 PM - 06:00 PM</option>
            <option value="06:00 PM - 07:00 PM">06:00 PM - 07:00 PM</option>
            <option value="07:00 PM - 08:00 PM">07:00 PM - 08:00 PM</option>
          </optgroup>
        </select>
      </div>

      <div class="field">
        <label>Agreed Fee Amount (Set by Admin) *</label>
        <input type="number" id="admFeeInput" required placeholder="Enter fee amount decided by admin">
      </div>

      <button type="button" class="btn-main" style="width:100%; margin-top:10px;" onclick="goToStep(2)">Next: Personal Details ➔</button>
    </div>

    <!-- STEP 2: Personal Details & PIN Code Lookup -->
    <div id="step2" class="step-section">
      <div style="font-size: 12px; font-weight: bold; color: var(--ac); margin-bottom: 10px; border-left: 3px solid var(--ac); padding-left: 6px;">2. Personal Details & Address</div>

      <div class="field">
        <label>Full Name *</label>
        <input type="text" id="admFullName" required placeholder="Enter member full name">
      </div>

      <div class="field">
        <label>Father / Parent Name *</label>
        <input type="text" id="admParentName" required placeholder="Enter parent name">
      </div>

      <div style="display:flex; gap:8px;">
        <div class="field" style="flex:1;">
          <label>Date of Birth *</label>
          <input type="date" id="admDob" required onchange="calculateAge()">
        </div>
        <div class="field" style="flex:0.7;">
          <label>Age *</label>
          <input type="number" id="admAge" required placeholder="18" oninput="checkUnderAge()">
        </div>
        <div class="field" style="flex:0.8;">
          <label>Gender *</label>
          <select id="admGender">
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      <div id="underAgeWarning" class="warning-box">
        <b>⚠️ Under 18 Age Notice:</b> Light exercises only. Heavy weight lifting is strictly restricted without parental consent. Management holds no liability for injuries due to rule violation.
      </div>

      <div style="display:flex; gap:8px;">
        <div class="field" style="flex:1;">
          <label>Mobile Number (WhatsApp) *</label>
          <input type="tel" id="admPhone" required maxlength="10" placeholder="10-digit number">
        </div>
        <div class="field" style="flex:1;">
          <label>PIN Code (Pan-India) *</label>
          <input type="text" id="admPincode" required maxlength="6" placeholder="e.g. 209862" oninput="fetchPincodeDetails(this.value)">
        </div>
      </div>

      <div class="field">
        <label>Locality / Area / City *</label>
        <select id="admLocalitySelect">
          <option value="">-- Enter PIN code first --</option>
        </select>
      </div>

      <div class="field">
        <label>Detailed Address (House No, Street, Landmark)</label>
        <input type="text" id="admAddressDetail" placeholder="e.g. Near Main Market">
      </div>

      <!-- ID Proof Upload -->
      <div style="background:#0b0b0d; border:1px solid var(--border); border-radius:8px; padding:10px; margin-bottom:12px;">
        <div style="font-size:11px; color:var(--ac); font-weight:bold; margin-bottom:6px;">🪪 ID Proof (Front & Back)</div>
        <select id="admIdType" style="margin-bottom:8px;">
          <option value="Aadhaar Card">Aadhaar Card</option>
          <option value="Voter ID">Voter ID</option>
          <option value="Driving License">Driving License</option>
          <option value="College ID">College ID</option>
        </select>
        <div style="display:flex; gap:8px;">
          <div style="flex:1;">
            <label style="font-size:10px; color:#aaa;">Front Image *</label>
            <input type="file" id="admIdFrontFile" accept="image/*" style="font-size:10px;" onchange="previewImg(this, 'idFrontPrev')">
            <img id="idFrontPrev" class="up-prev" hidden>
          </div>
          <div style="flex:1;">
            <label style="font-size:10px; color:#aaa;">Back Image *</label>
            <input type="file" id="admIdBackFile" accept="image/*" style="font-size:10px;" onchange="previewImg(this, 'idBackPrev')">
            <img id="idBackPrev" class="up-prev" hidden>
          </div>
        </div>
      </div>

      <!-- Member Photo & Signature -->
      <div style="background:#0b0b0d; border:1px solid var(--border); border-radius:8px; padding:10px; margin-bottom:12px;">
        <div style="font-size:11px; color:var(--ac); font-weight:bold; margin-bottom:6px;">📸 Member Photo & Signature</div>
        <div style="display:flex; gap:8px; margin-bottom:8px;">
          <div style="flex:1;">
            <label style="font-size:10px; color:#aaa;">Passport Photo *</label>
            <input type="file" id="admPhotoFile" accept="image/*" style="font-size:10px;" onchange="previewImg(this, 'photoPrev')">
            <img id="photoPrev" class="up-prev" hidden>
          </div>
          <div style="flex:1;">
            <label style="font-size:10px; color:#aaa;">Signature Photo / Typed</label>
            <input type="file" id="admSignFile" accept="image/*" style="font-size:10px;" onchange="previewImg(this, 'signPrev')">
            <img id="signPrev" class="up-prev" hidden>
          </div>
        </div>
        <input type="text" id="admTypedSign" placeholder="Or type full name as digital signature">
      </div>

      <div class="btn-row">
        <button type="button" class="btn-back" onclick="goToStep(1)">Back</button>
        <button type="button" class="btn-main" onclick="goToStep(3)">Next: Health Details ➔</button>
      </div>
    </div>

    <!-- STEP 3: Health & Fitness PAR-Q -->
    <div id="step3" class="step-section">
      <div style="font-size: 12px; font-weight: bold; color: var(--ac); margin-bottom: 10px; border-left: 3px solid var(--ac); padding-left: 6px;">3. Health & Fitness History</div>

      <div style="display:flex; gap:8px;">
        <div class="field" style="flex:1;"><label>Height (cm)</label><input type="number" id="admHeight" placeholder="170"></div>
        <div class="field" style="flex:1;"><label>Weight (kg)</label><input type="number" id="admWeight" placeholder="65"></div>
        <div class="field" style="flex:1;"><label>Blood Group</label><input type="text" id="admBloodGroup" placeholder="B+"></div>
      </div>

      <div class="field">
        <label>Medical Conditions / Injuries / History</label>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:11.5px; margin-top:6px;">
          <label><input type="checkbox" value="High/Low BP"> High/Low BP</label>
          <label><input type="checkbox" value="Diabetes"> Diabetes</label>
          <label><input type="checkbox" value="Asthma"> Asthma</label>
          <label><input type="checkbox" value="Back Pain / Slip Disc"> Back Pain / Slip Disc</label>
          <label><input type="checkbox" value="Heart Condition"> Heart Condition</label>
          <label><input type="checkbox" value="Joint / Knee Injury"> Joint / Knee Injury</label>
        </div>
      </div>

      <div class="field">
        <label>Are you taking any fitness supplements?</label>
        <select id="admSupplement" onchange="toggleSuppInput(this.value)">
          <option value="No">No</option>
          <option value="Yes">Yes</option>
        </select>
      </div>
      <div class="field" id="suppNameBox" style="display:none;">
        <label>Supplement Brand / Product Name & Medical Note</label>
        <input type="text" id="admSuppName" placeholder="e.g. Whey Protein / No hospital issues">
      </div>

      <div class="field" style="margin-top:14px;">
        <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer; color:var(--ok); font-weight:bold;">
          <input type="checkbox" id="admHealthCheck" required style="width:auto; margin-top:2px;">
          <span>I declare that I am physically fit to join and train at the facility.</span>
        </label>
      </div>

      <div class="btn-row">
        <button type="button" class="btn-back" onclick="goToStep(2)">Back</button>
        <button type="button" class="btn-main" onclick="goToStep(4)">Next: Terms & Rules ➔</button>
      </div>
    </div>

    <!-- STEP 4: Legal Terms & Payment -->
    <div id="step4" class="step-section">
      <div style="font-size: 12px; font-weight: bold; color: var(--ac); margin-bottom: 10px; border-left: 3px solid var(--ac); padding-left: 6px;">4. Terms & Payment Mode</div>

      <div style="background:#0b0b0d; border:1px solid var(--border); border-radius:8px; padding:10px; font-size:10.5px; line-height:1.5; color:#ccc; max-height:140px; overflow-y:auto; margin-bottom:12px;">
        <b style="color:var(--ac);">1. Fee Policy:</b> Fees is strictly non-refundable. Attending even 1 day incurs full monthly fee.<br>
        <b style="color:var(--ac);">2. Legal Warning:</b> Providing false information or defaulting on dues after admission gives management full right to take appropriate legal action.
      </div>

      <div class="field">
        <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer; color:#fff; font-weight:bold;">
          <input type="checkbox" id="admTermsCheck" required style="width:auto; margin-top:2px;">
          <span>I agree to all rules, fee policies, and legal warnings. *</span>
        </label>
      </div>

      <div class="field" style="margin-top:12px;">
        <label>Payment Mode *</label>
        <select id="admPaymentMode" onchange="togglePaymentTray(this.value)">
          <option value="Cash">Cash (Nagad)</option>
          <option value="Online">Online UPI Payment</option>
        </select>
      </div>

      <div id="onlineTray" style="display:none; background:#0b0b0d; border:1px solid var(--ok); padding:10px; border-radius:8px; margin-bottom:12px;">
        <label style="color:var(--ok); font-weight:bold; margin-bottom:4px; display:block;">Enter UPI UTR / Transaction Reference:</label>
        <input type="text" id="admUtrRef" placeholder="e.g. 427192837465" style="border-color:var(--ok);">
      </div>

      <div class="btn-row">
        <button type="button" class="btn-back" onclick="goToStep(3)">Back</button>
        <button type="submit" class="btn-main" id="submitBtn">Submit Admission Form 🚀</button>
      </div>
    </div>

  </form>
</div>

<script>
  // Firebase SDK Initialization
  const firebaseConfig = {
    apiKey: "AIzaSyA9z1gXZDB3W0lJxyHV9x2vWeb0Ees7z-g",
    authDomain: "brother-s-fitness-club.firebaseapp.com",
    projectId: "brother-s-fitness-club",
    storageBucket: "brother-s-fitness-club.firebasestorage.app",
    messagingSenderId: "781489019006",
    appId: "1:781489019006:web:4a230698f2195e7208202f"
  };
  if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
  const db = firebase.firestore();

  window.addEventListener('DOMContentLoaded', () => {
    document.getElementById("admJoiningDate").valueAsDate = new Date();
    const org = JSON.parse(localStorage.getItem("bfc_org_profile") || "{}");
    document.getElementById("orgTitleDisplay").innerText = org.gymName || "Universal Fitness Club";
  });

  function goToStep(step) {
    if (step === 2 && !document.getElementById("admJoiningDate").value) { alert("Please select joining date."); return; }
    if (step === 3 && (!document.getElementById("admFullName").value || document.getElementById("admPhone").value.length !== 10)) { alert("Please enter valid name and 10-digit mobile number."); return; }
    if (step === 4 && !document.getElementById("admHealthCheck").checked) { alert("Please confirm health declaration."); return; }
    
    document.querySelectorAll('.step-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`step${step}`).classList.add('active');
  }

  function calculateAge() {
    const dob = document.getElementById("admDob").value;
    if (!dob) return;
    const diff = Date.now() - new Date(dob).getTime();
    const age = Math.abs(new Date(diff).getUTCFullYear() - 1970);
    document.getElementById("admAge").value = age;
    checkUnderAge();
  }

  function checkUnderAge() {
    const age = parseInt(document.getElementById("admAge").value || "0", 10);
    document.getElementById("underAgeWarning").style.display = (age > 0 && age < 18) ? "block" : "none";
  }

  async function fetchPincodeDetails(pin) {
    if (pin.length !== 6) return;
    const select = document.getElementById("admLocalitySelect");
    select.innerHTML = '<option value="">Loading locations...</option>';
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const data = await res.json();
      if (data && data[0] && data[0].Status === "Success") {
        select.innerHTML = "";
        data[0].PostOffice.forEach(po => {
          const opt = document.createElement("option");
          opt.value = `${po.Name}, ${po.District}, ${po.State} - ${pin}`;
          opt.innerText = `${po.Name} (${po.District}, ${po.State})`;
          select.appendChild(opt);
        });
      } else {
        select.innerHTML = '<option value="Other">Other / Enter manual address below</option>';
      }
    } catch (e) {
      select.innerHTML = '<option value="Other">Manual entry required</option>';
    }
  }

  function previewImg(input, previewId) {
    const prev = document.getElementById(previewId);
    if (input.files && input.files[0]) {
      const reader = new FileReader();
      reader.onload = e => { prev.src = e.target.result; prev.hidden = false; };
      reader.readAsDataURL(input.files[0]);
    }
  }

  function toggleSuppInput(val) {
    document.getElementById("suppNameBox").style.display = (val === "Yes") ? "block" : "none";
  }

  function togglePaymentTray(mode) {
    document.getElementById("onlineTray").style.display = (mode === "Online") ? "block" : "none";
  }

  async function handleUniversalAdmission(e) {
    e.preventDefault();
    if (!document.getElementById("admTermsCheck").checked) { alert("Please agree to terms and conditions."); return; }

    const btn = document.getElementById("submitBtn");
    btn.disabled = true;
    btn.innerText = "Saving admission to cloud...";

    const memberId = "MEM_" + Date.now();
    const totalFee = parseInt(document.getElementById("admFeeInput").value || "0", 10);

    const memberData = {
      id: memberId,
      code: "MEM-" + String(memberId).slice(-6),
      name: document.getElementById("admFullName").value.trim(),
      parentName: document.getElementById("admParentName").value.trim(),
      dob: document.getElementById("admDob").value,
      age: document.getElementById("admAge").value,
      gender: document.getElementById("admGender").value,
      phone: document.getElementById("admPhone").value.trim(),
      pincode: document.getElementById("admPincode").value.trim(),
      locality: document.getElementById("admLocalitySelect").value,
      addressDetail: document.getElementById("admAddressDetail").value.trim(),
      joinDate: document.getElementById("admJoiningDate").value,
      slot: document.getElementById("admTimeSlot").value,
      plan: document.getElementById("admPlanCategory").value,
        totalFee: totalFee,
        paidFee: document.getElementById("admPaymentMode").value === "Online" ? totalFee : 0,
        dueFee: document.getElementById("admPaymentMode").value === "Online" ? 0 : totalFee,
        payMode: document.getElementById("admPaymentMode").value,
        utrRef: document.getElementById("admUtrRef") ? document.getElementById("admUtrRef").value.trim() : "N/A",
        status: document.getElementById("admPaymentMode").value === "Online" ? "Paid" : "Pending",
        createdAt: new Date().toISOString()
      };

      try {
        // Save to Firestore cloud database
        await db.collection("members").doc(memberId).set(memberData, { merge: true });

        // Save locally
        let list = JSON.parse(localStorage.getItem("bfc_members") || "[]");
        list.unshift(memberData);
        localStorage.setItem("bfc_members", JSON.stringify(list));

        alert("✅ Admission registered and synced successfully!");
        window.location.href = "index.html";
      } catch (err) {
        alert("Error saving admission: " + err.message);
        btn.disabled = false;
        btn.innerText = "Submit Admission Form 🚀";
      }
    }
  </script>

</body>
</html>
