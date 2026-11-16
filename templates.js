/* Organisation templates.
   Har organisation type (gym / school / college) ka apna admission form, documents, plans, groups aur terms yahan data ki tarah likha hai.
   Naya type jodna ho to sirf is file me ek naya block add karein — baaki app apne aap use karega.

   Field format:  F(type, id, label, hindiLabel, options)
   types : text tel email date number textarea select radio check multi computed
   options: req, max, pattern(phone10|aadhaar|pin6|email), opts[], showIf(v), reqWhen(v), labelFn(v), key('name'|'phone'), exclusive, half
*/
(function () {
  "use strict";
  function F(type, id, label, hi, o) { var f = { type: type, id: id, label: label, hi: hi || "" }; if (o) for (var k in o) f[k] = o[k]; return f; }
  var BLOOD = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
  var CATEGORY = ["General", "OBC", "SC", "ST", "EWS"];
  var GENDER = ["Male", "Female", "Other"];

  function address() {
    return { id: "address", title: "Address", hi: "पता", fields: [
      F("textarea", "address", "Permanent Address", "स्थायी पता", { req: 1, max: 300 }),
      F("check", "sameAddr", "Current address is the same as permanent address", "वर्तमान पता भी यही है"),
      F("textarea", "curAddress", "Current Address", "वर्तमान पता", { req: 1, max: 300, showIf: function (v) { return !v.sameAddr; } }),
      F("text", "pincode", "PIN Code", "पिनकोड", { pattern: "pin6", max: 6, inputmode: "numeric" })
    ] };
  }
  function emergency(title) {
    return { id: "emergency", title: title || "Emergency Contact", hi: "आपातकालीन संपर्क", fields: [
      F("text", "emergName", "Contact Person Name", "संपर्क व्यक्ति का नाम", { req: 1, max: 80 }),
      F("text", "emergRelation", "Relationship", "संबंध", { req: 1, max: 30, half: 1 }),
      F("tel", "emergPhone", "Mobile Number", "मोबाइल नंबर", { req: 1, pattern: "phone10", max: 10, half: 1 })
    ] };
  }
  var docIds = ["Aadhaar Card", "Voter ID", "Driving Licence", "PAN Card", "Passport", "School / College ID"];

  var T = window.ORG_TEMPLATES = {};

  /* Gym batches run in 30-minute shifts: morning 05:00–11:00 AM, evening 04:00–11:00 PM (every shift is a separate batch). */
  function gymSlots() {
    function t(mins) { var h = Math.floor(mins / 60), m = mins % 60, ap = h >= 12 ? "PM" : "AM", h12 = h % 12 === 0 ? 12 : h % 12; return (h12 < 10 ? "0" : "") + h12 + ":" + (m < 10 ? "0" : "") + m + " " + ap; }
    var out = [], a;
    for (a = 5 * 60; a < 11 * 60; a += 30) out.push({ name: t(a) + " – " + t(a + 30), time: "Morning" });
    for (a = 16 * 60; a < 23 * 60; a += 30) out.push({ name: t(a) + " – " + t(a + 30), time: "Evening" });
    return out;
  }
  window.ORG_GYM_SLOTS = gymSlots;

  /* ===================================== GYM ===================================== */
  T.gym = {
    id: "gym", name: "Gym / Fitness Club", icon: "🏋️", blurb: "Members, trainers, batches, fee plans, diet and supplement store",
    memberWord: "Member", membersWord: "Members", groupLabel: "Batch", groupsLabel: "Batches", planLabel: "Membership Plan",
    codePrefix: "MB", consent: "minor",
    defaultPlans: [
      { name: "Monthly", months: 1, price: "" }, { name: "Quarterly", months: 3, price: "" },
      { name: "Half-Yearly", months: 6, price: "" }, { name: "Yearly", months: 12, price: "" }
    ],
    defaultGroups: gymSlots(),
    docIdTypes: docIds,
    docSlots: [
      { key: "photo", label: "Member Photograph", hi: "सदस्य की फोटो", req: 1, w: 480, h: 600, len: 60000, camera: "user" },
      { key: "idFront", label: "ID Proof — Front", hi: "पहचान पत्र (आगे)", req: 1, w: 1100, h: 1100, len: 110000, camera: "environment" },
      { key: "idBack", label: "ID Proof — Back", hi: "पहचान पत्र (पीछे)", req: 0, w: 1100, h: 1100, len: 110000, camera: "environment" }
    ],
    sections: [
      { id: "personal", title: "Personal Details", hi: "व्यक्तिगत जानकारी", fields: [
        F("text", "name", "Full Name", "पूरा नाम", { req: 1, max: 80, key: "name" }),
        F("radio", "gender", "Gender", "लिंग", { req: 1, opts: GENDER }),
        F("radio", "marital", "Marital Status", "वैवाहिक स्थिति", { req: 1, opts: ["Single", "Married"], showIf: function (v) { return v.gender === "Female"; } }),
        F("text", "parentName", "Father's Name", "पिता का नाम", { req: 1, max: 80,
          labelFn: function (v) { return v.gender === "Female" && v.marital === "Married" ? ["Husband's Name", "पति का नाम"] : ["Father's Name", "पिता का नाम"]; } }),
        F("text", "fatherName", "Father's Name (optional)", "पिता का नाम (वैकल्पिक)", { max: 80, showIf: function (v) { return v.gender === "Female" && v.marital === "Married"; } }),
        F("date", "dob", "Date of Birth", "जन्म तिथि", { req: 1, half: 1 }),
        F("computed", "age", "Age", "उम्र", { calc: "age", half: 1 }),
        F("tel", "phone", "Mobile Number", "मोबाइल नंबर", { req: 1, pattern: "phone10", max: 10, key: "phone" }),
        F("email", "email", "Email (optional)", "ईमेल (वैकल्पिक)", { pattern: "email", max: 80 }),
        F("text", "occupation", "Occupation (optional)", "व्यवसाय (वैकल्पिक)", { max: 60, half: 1 }),
        F("select", "bloodGroup", "Blood Group (optional)", "ब्लड ग्रुप", { opts: BLOOD, half: 1 })
      ] },
      address(),
      emergency(),
      { id: "health", title: "Health & Fitness", hi: "स्वास्थ्य एवं फिटनेस", fields: [
        F("number", "height", "Height (cm)", "ऊंचाई (सेमी)", { req: 1, min: 80, max: 250, half: 1 }),
        F("number", "weight", "Weight (kg)", "वज़न (किलो)", { req: 1, min: 20, max: 300, half: 1 }),
        F("computed", "bmi", "Body Mass Index (BMI)", "बीएमआई", { calc: "bmi" }),
        F("select", "goal", "Fitness Goal", "फिटनेस लक्ष्य", { req: 1, opts: ["Weight Loss", "Muscle Gain", "General Fitness", "Strength & Conditioning", "Sports Performance", "Rehabilitation"] }),
        F("multi", "conditions", "Existing medical conditions", "पहले से कोई बीमारी", { req: 1, exclusive: "None", opts: ["None", "High Blood Pressure", "Diabetes", "Heart Condition", "Asthma / Breathing Issue", "Thyroid", "Back / Joint Pain", "Recent Surgery / Injury", "Other"] }),
        F("textarea", "conditionsNote", "Details of condition / medication", "बीमारी / दवा का विवरण", { max: 300,
          showIf: function (v) { var c = v.conditions || []; return c.length > 0 && c.indexOf("None") < 0; },
          reqWhen: function (v) { var c = v.conditions || []; return c.length > 0 && c.indexOf("None") < 0; } }),
        F("radio", "medication", "Do you take any regular medicine?", "क्या आप कोई नियमित दवा ले रहे हैं?", { req: 1, opts: ["No", "Yes"] }),
        F("radio", "doctorRestricted", "Has a doctor advised you NOT to exercise?", "क्या डॉक्टर ने व्यायाम से मना किया है?", { req: 1, opts: ["No", "Yes"] }),
        F("radio", "supplements", "Do you currently take any supplements?", "क्या आप कोई सप्लीमेंट लेते हैं?", { opts: ["No", "Yes"] }),
        F("select", "experience", "Gym experience (optional)", "जिम का अनुभव (वैकल्पिक)", { opts: ["Beginner (new)", "Intermediate (1-3 yrs)", "Advanced (3+ yrs)"], half: 1 }),
        F("select", "source", "How did you hear about us? (optional)", "हमारे बारे में कैसे पता चला? (वैकल्पिक)", { opts: ["Friend / Member", "Social media", "Banner / Poster", "Walk-in", "Other"], half: 1 }),
        F("radio", "ptInterest", "Interested in personal training / diet plan?", "पर्सनल ट्रेनिंग / डाइट प्लान में रुचि?", { opts: ["No", "Yes"] })
      ] }
    ],
    terms:
"नियम, शर्तें एवं दायित्व पत्र (Terms, Rules & Waiver)\n\n" +
"1. फीस एवं उपस्थिति नियम (FEES POLICY - STRICT):\n- शिक्षा संस्थानों की तरह यह भी एक अभ्यास संस्थान है। यदि आप महीने में 1 दिन भी आते हैं, तो भी पूरे 1 महीने की पूरी फीस देय होगी।\n- अनुपस्थिति के आधार पर फीस में कोई छूट या रिफंड नहीं मिलेगा। फीस गैर-वापसी योग्य (Non-Refundable) है।\n\n" +
"2. जिम छोड़ने की प्रक्रिया (EXIT POLICY):\n- यदि जिम छोड़ना है, तो महीना पूरा होते ही तुरंत जिम आना बंद कर दें। बिना फीस दिए नया महीना शुरू करने पर प्रबंधन सख्त कदम उठाएगा।\n\n" +
"3. जिम अनुशासन एवं व्यवस्था (DISCIPLINE):\n- जिम के अंदर साफ इनडोर जूते व पर्सनल तौलिया लाना अनिवार्य है। उपकरण पटकना मना है।\n- गुटका, तंबाकू, धूम्रपान या शराब जिम में पूर्णतः प्रतिबंधित है। कीमती सामान की सुरक्षा स्वयं करें।\n\n" +
"4. स्वास्थ्य जोखिम एवं दायित्व मुक्ति (WAIVER):\n- भारी वजन उठाने में होने वाले खिंचाव या चोट की जिम्मेदारी स्वयं सदस्य की होगी। प्रबंधन कानूनी रूप से जिम्मेदार नहीं होगा।\n- मैंने अपनी स्वास्थ्य जानकारी सही और पूरी दी है। मैं अपने फोटो व पहचान पत्र के सदस्यता सत्यापन और उपस्थिति हेतु उपयोग की सहमति देता/देती हूँ."
  };

  /* ===================================== SCHOOL ===================================== */
  T.school = {
    id: "school", name: "School", icon: "🏫", blurb: "Students, classes, teachers & staff, fee heads, transport and school store",
    memberWord: "Student", membersWord: "Students", groupLabel: "Class", groupsLabel: "Classes", planLabel: "Fee Plan",
    codePrefix: "ST", consent: "always",
    defaultPlans: [{ name: "Annual Fee (Academic Year)", months: 12, price: "" }],
    defaultGroups: ["Nursery", "LKG", "UKG", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"].map(function (n) { return { name: n }; }),
    docIdTypes: ["Birth Certificate", "Aadhaar Card", "Passport"],
    docSlots: [
      { key: "photo", label: "Student Photograph", hi: "छात्र की फोटो", req: 1, w: 480, h: 600, len: 60000, camera: "user" },
      { key: "idFront", label: "Birth / Identity Proof", hi: "जन्म / पहचान प्रमाण", req: 1, w: 1100, h: 1100, len: 110000, camera: "environment" },
      { key: "idBack", label: "Identity Proof — Back (if any)", hi: "पहचान प्रमाण (पीछे)", req: 0, w: 1100, h: 1100, len: 110000, camera: "environment" },
      { key: "doc1", label: "Transfer Certificate (TC)", hi: "स्थानांतरण प्रमाण पत्र", req: 0, w: 1100, h: 1100, len: 110000, camera: "environment" },
      { key: "doc2", label: "Previous Report Card", hi: "पिछली कक्षा की रिपोर्ट", req: 0, w: 1100, h: 1100, len: 110000, camera: "environment" },
      { key: "doc3", label: "Parent / Guardian ID", hi: "अभिभावक का पहचान पत्र", req: 0, w: 1100, h: 1100, len: 110000, camera: "environment" }
    ],
    sections: [
      { id: "student", title: "Student Details", hi: "छात्र की जानकारी", fields: [
        F("text", "name", "Student's Full Name", "छात्र का पूरा नाम", { req: 1, max: 80, key: "name" }),
        F("radio", "gender", "Gender", "लिंग", { req: 1, opts: GENDER }),
        F("date", "dob", "Date of Birth", "जन्म तिथि", { req: 1, half: 1 }),
        F("computed", "age", "Age", "उम्र", { calc: "age", half: 1 }),
        F("text", "aadhaar", "Aadhaar Number (optional)", "आधार नंबर (वैकल्पिक)", { pattern: "aadhaar", max: 12, inputmode: "numeric", half: 1 }),
        F("select", "bloodGroup", "Blood Group", "ब्लड ग्रुप", { opts: BLOOD, half: 1 }),
        F("select", "category", "Category", "श्रेणी", { req: 1, opts: CATEGORY, half: 1 }),
        F("text", "religion", "Religion (optional)", "धर्म (वैकल्पिक)", { max: 30, half: 1 })
      ] },
      { id: "parents", title: "Parent / Guardian Details", hi: "माता-पिता / अभिभावक", fields: [
        F("text", "fatherName", "Father's Name", "पिता का नाम", { req: 1, max: 80 }),
        F("text", "fatherOcc", "Father's Occupation", "पिता का व्यवसाय", { max: 60 }),
        F("text", "motherName", "Mother's Name", "माता का नाम", { req: 1, max: 80 }),
        F("text", "motherOcc", "Mother's Occupation", "माता का व्यवसाय", { max: 60 }),
        F("tel", "phone", "Parent / Guardian Mobile", "अभिभावक का मोबाइल", { req: 1, pattern: "phone10", max: 10, key: "phone", half: 1 }),
        F("tel", "altPhone", "Alternate Mobile", "वैकल्पिक मोबाइल", { pattern: "phone10", max: 10, half: 1 }),
        F("email", "email", "Email (optional)", "ईमेल (वैकल्पिक)", { pattern: "email", max: 80 })
      ] },
      address(),
      { id: "previous", title: "Previous School", hi: "पिछला विद्यालय", fields: [
        F("text", "prevSchool", "Name of Previous School (if any)", "पिछले विद्यालय का नाम", { max: 100 }),
        F("text", "prevClass", "Last Class Attended", "अंतिम कक्षा", { max: 30, half: 1 }),
        F("text", "tcNo", "TC Number", "टीसी नंबर", { max: 30, half: 1 })
      ] },
      { id: "services", title: "Transport & Hostel", hi: "परिवहन एवं छात्रावास", fields: [
        F("radio", "transport", "School Transport", "स्कूल वाहन", { req: 1, opts: ["Not required", "School Bus", "Van"] }),
        F("text", "route", "Pick-up Point / Route", "पिक-अप स्थान / रूट", { max: 100, req: 1, showIf: function (v) { return v.transport && v.transport !== "Not required"; } }),
        F("radio", "hostel", "Hostel Required?", "क्या छात्रावास चाहिए?", { req: 1, opts: ["No", "Yes"] })
      ] },
      emergency("Emergency Contact (other than parents)"),
      { id: "medical", title: "Medical Information", hi: "स्वास्थ्य जानकारी", fields: [
        F("textarea", "medical", "Allergies / medical conditions the school should know (if any)", "एलर्जी / बीमारी (यदि कोई हो)", { max: 300 })
      ] }
    ],
    terms:
"SCHOOL ADMISSION TERMS & CONDITIONS\n\n" +
"1. Fees\n- Fees must be paid as per the fee schedule of the school. Fees once paid are not refundable.\n- Late payment may attract a fine as decided by the management.\n\n" +
"2. Attendance & Discipline\n- Students must maintain the minimum attendance prescribed by the school and follow the school discipline code and uniform policy.\n- The school may take disciplinary action, including suspension or removal, for serious misconduct.\n\n" +
"3. Withdrawal\n- A Transfer Certificate is issued only after clearance of all dues and a written application from the parent / guardian.\n\n" +
"4. Transport & Hostel\n- Transport and hostel services are subject to availability and their separate rules and charges.\n\n" +
"5. Medical Emergency\n- I authorise the school to arrange emergency medical care for my ward and to contact me or the emergency contact immediately.\n\n" +
"6. Declaration\n- I confirm that all information and documents submitted are true. Admission may be cancelled if any detail is found to be false.\n- I consent to the use of my ward's photograph for school records and identification."
  };

  /* ===================================== COLLEGE ===================================== */
  T.college = {
    id: "college", name: "College / Institute", icon: "🎓", blurb: "Courses, departments, faculty, semester fees, hostel and attendance",
    memberWord: "Student", membersWord: "Students", groupLabel: "Course", groupsLabel: "Courses", planLabel: "Fee Plan",
    codePrefix: "EN", consent: "minor",
    defaultPlans: [{ name: "Annual Fee", months: 12, price: "" }, { name: "Semester Fee", months: 6, price: "" }],
    defaultGroups: ["B.A.", "B.Sc.", "B.Com.", "BBA", "BCA", "M.A.", "M.Sc.", "M.Com.", "MBA"].map(function (n) { return { name: n }; }),
    docIdTypes: ["Aadhaar Card", "Voter ID", "Driving Licence", "PAN Card", "Passport"],
    docSlots: [
      { key: "photo", label: "Student Photograph", hi: "छात्र की फोटो", req: 1, w: 480, h: 600, len: 60000, camera: "user" },
      { key: "idFront", label: "ID Proof — Front", hi: "पहचान पत्र (आगे)", req: 1, w: 1100, h: 1100, len: 110000, camera: "environment" },
      { key: "idBack", label: "ID Proof — Back", hi: "पहचान पत्र (पीछे)", req: 0, w: 1100, h: 1100, len: 110000, camera: "environment" },
      { key: "doc1", label: "10th Marksheet", hi: "10वीं की मार्कशीट", req: 1, w: 1100, h: 1100, len: 110000, camera: "environment" },
      { key: "doc2", label: "12th Marksheet", hi: "12वीं की मार्कशीट", req: 1, w: 1100, h: 1100, len: 110000, camera: "environment" },
      { key: "doc3", label: "Transfer / Migration Certificate", hi: "टीसी / माइग्रेशन", req: 0, w: 1100, h: 1100, len: 110000, camera: "environment" },
      { key: "doc4", label: "Category Certificate (if applicable)", hi: "जाति प्रमाण पत्र", req: 0, w: 1100, h: 1100, len: 110000, camera: "environment" }
    ],
    sections: [
      { id: "student", title: "Student Details", hi: "छात्र की जानकारी", fields: [
        F("text", "name", "Full Name", "पूरा नाम", { req: 1, max: 80, key: "name" }),
        F("radio", "gender", "Gender", "लिंग", { req: 1, opts: GENDER }),
        F("date", "dob", "Date of Birth", "जन्म तिथि", { req: 1, half: 1 }),
        F("computed", "age", "Age", "उम्र", { calc: "age", half: 1 }),
        F("tel", "phone", "Mobile Number", "मोबाइल नंबर", { req: 1, pattern: "phone10", max: 10, key: "phone" }),
        F("email", "email", "Email", "ईमेल", { req: 1, pattern: "email", max: 80 }),
        F("text", "aadhaar", "Aadhaar Number (optional)", "आधार नंबर", { pattern: "aadhaar", max: 12, inputmode: "numeric", half: 1 }),
        F("select", "category", "Category", "श्रेणी", { req: 1, opts: CATEGORY, half: 1 }),
        F("select", "bloodGroup", "Blood Group (optional)", "ब्लड ग्रुप", { opts: BLOOD })
      ] },
      { id: "family", title: "Parent / Guardian", hi: "माता-पिता / अभिभावक", fields: [
        F("text", "fatherName", "Father's Name", "पिता का नाम", { req: 1, max: 80 }),
        F("text", "motherName", "Mother's Name", "माता का नाम", { req: 1, max: 80 }),
        F("tel", "guardianPhone", "Parent / Guardian Mobile", "अभिभावक का मोबाइल", { req: 1, pattern: "phone10", max: 10 })
      ] },
      address(),
      { id: "academic", title: "Academic Background", hi: "शैक्षणिक पृष्ठभूमि", fields: [
        F("text", "board10", "10th Board / School", "10वीं बोर्ड", { req: 1, max: 80, half: 1 }),
        F("number", "pct10", "10th Percentage", "प्रतिशत", { req: 1, min: 0, max: 100, half: 1 }),
        F("text", "board12", "12th Board / School", "12वीं बोर्ड", { req: 1, max: 80, half: 1 }),
        F("number", "pct12", "12th Percentage", "प्रतिशत", { req: 1, min: 0, max: 100, half: 1 }),
        F("select", "stream12", "12th Stream", "12वीं स्ट्रीम", { opts: ["Science (PCM)", "Science (PCB)", "Commerce", "Arts / Humanities", "Other"] }),
        F("text", "prevInstitute", "Last Institute Attended (UG / PG applicants)", "पिछला संस्थान", { max: 100 }),
        F("text", "entrance", "Entrance Exam & Rank / Score (if any)", "प्रवेश परीक्षा व रैंक", { max: 80 })
      ] },
      { id: "extras", title: "Hostel & Scholarship", hi: "छात्रावास एवं छात्रवृत्ति", fields: [
        F("radio", "hostel", "Hostel Required?", "क्या छात्रावास चाहिए?", { req: 1, opts: ["No", "Yes"] }),
        F("radio", "scholarship", "Applying for Scholarship?", "क्या छात्रवृत्ति के लिए आवेदन?", { req: 1, opts: ["No", "Yes"] })
      ] },
      emergency()
    ],
    terms:
"COLLEGE ADMISSION TERMS & CONDITIONS\n\n" +
"1. Fees\n- Fees are payable as per the fee schedule of the institute. Fees once paid are non-refundable except as per university / regulatory rules.\n- Fee for each semester must be cleared before examinations.\n\n" +
"2. Attendance\n- Students must maintain the minimum attendance required by the university. Students below the required attendance may be barred from examinations.\n\n" +
"3. Conduct\n- Students must follow the code of conduct. Ragging in any form is strictly prohibited and punishable under law.\n\n" +
"4. Documents\n- Original documents may be demanded for verification. Admission stands cancelled if any document or information is found to be false.\n\n" +
"5. Hostel\n- Hostel facilities, if provided, are governed by separate hostel rules and fees.\n\n" +
"6. Consent\n- I consent to my photograph and documents being stored for admission, identification and attendance."
  };

  window.ORG_TYPES = ["gym", "school", "college"];
})();
