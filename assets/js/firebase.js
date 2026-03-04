// assets/js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyB-UK8Fa0FN2bt4tfQMl6ksWFwktqB8htU",
  authDomain: "codebase-83525.firebaseapp.com",
  projectId: "codebase-83525",
  storageBucket: "codebase-83525.firebasestorage.app",
  messagingSenderId: "729735531784",
  appId: "1:729735531784:web:c6eba0c9a92ef6fff270bd",
  measurementId: "G-DTPQ1PHCBN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const ALLOWED_DOMAINS = ["@std.uwu.ac.lk", "@stu.vau.ac.lk"];

// ------------------------------------------------------------------------------------------
// GOOGLE LOGIN
// ------------------------------------------------------------------------------------------
window.googleLogin = async function () {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Save basic user info locally
    const userData = {
      uid: user.uid,
      name: user.displayName,
      email: user.email,
      photo: user.photoURL
    };
    localStorage.setItem("user", JSON.stringify(userData));

    // ---------------------------
    // FIRESTORE CHECK → allowedEmails
    // ---------------------------
    const allowedRef = collection(db, "login_control", "access", "allowedEmails");
    const allowedSnap = await getDocs(allowedRef);
    const allowedDocs = allowedSnap.docs.map(d => d.data());

    // Find the record corresponding to the logged-in user
    const allowedUser = allowedDocs.find(d => d.email === user.email);

    // Save current allowed user details locally
    if (allowedUser) {
      localStorage.setItem("allowedUserDetails", JSON.stringify({
        email: allowedUser.email,
        regNo: allowedUser.regNo
      }));
    }

    const domainAllowed = ALLOWED_DOMAINS.some(d => user.email.endsWith(d));
    const emailAllowed = !!allowedUser; // true if user is in allowedEmails

    if (!domainAllowed && !emailAllowed) {
      alert("Access denied. Only approved emails allowed.");
      await signOut(auth);
      localStorage.removeItem("user");
      return;
    }

    // ---------------------------
    // FIRESTORE CHECK → bannedReg
    // ---------------------------
    const bannedRef = collection(db, "login_control", "access", "bannedReg");
    const bannedSnap = await getDocs(bannedRef);
    const bannedList = bannedSnap.docs.map(d => d.data().regNo);

    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const reg = userDoc.data().registrationNumber;

      if (bannedList.includes(reg)) {
        alert("Your account is banned.");
        await signOut(auth);
        localStorage.removeItem("user");
        return;
      }

      // Redirect based on role
      redirectByRole(userDoc.data().role || "student");
    } else {
      // First login → go to register page
      window.location.href = "register.html";
    }

  } catch (err) {
    console.error("Login failed:", err);
  }
};

// ------------------------------------------------------------------------------------------
// ROLE REDIRECTION
// ------------------------------------------------------------------------------------------
function redirectByRole(role) {
  window.location.href = "dashboard.html";
}

// ------------------------------------------------------------------------------------------
// REGISTER USER
// ------------------------------------------------------------------------------------------
window.registerUser = async function (regNumber, phone, level) {
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) {
    alert("Please login first");
    return;
  }

  // Check banned list BEFORE registration
  const bannedRef = collection(db, "login_control", "access", "bannedReg");
  const q = query(bannedRef, where("regNo", "==", regNumber));
  const bannedSnap = await getDocs(q);

  if (!bannedSnap.empty) {
    alert("This registration number is banned.");
    return;
  }

  const userRef = doc(db, "users", user.uid);

  await setDoc(userRef, {
    name: user.name,
    email: user.email,
    registrationNumber: regNumber,
    phone: phone,
    level: level,
    createdAt: new Date(),
    role: "student"
  });

  alert("Registration Successful!");
  window.location.href = "dashboard.html";
};

export { app };
