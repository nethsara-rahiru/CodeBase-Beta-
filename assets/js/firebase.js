// assets/js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
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
  where,
  serverTimestamp,
  addDoc
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
// Initialize Firestore with modern persistence settings
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const db = initializeFirestore(app, {
  cache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

const provider = new GoogleAuthProvider();

const ALLOWED_DOMAINS = ["@std.uwu.ac.lk", "@stu.vau.ac.lk"];

// ------------------------------------------------------------------------------------------
// GOOGLE LOGIN
// ------------------------------------------------------------------------------------------

let isAuthProcessing = false;

// Pick up result from redirect if any
getRedirectResult(auth)
  .then((result) => {
    if (result) {
      window.handleUserAuth(result.user);
    }
  })
  .catch((error) => {
    console.error("Redirect login failed:", error);
  });

window.googleLogin = async function () {
  try {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      // Use redirect mode for mobile to ensure compatibility with WebViews
      await signInWithRedirect(auth, provider);
    } else {
      // Stick to popup for desktop
      const result = await signInWithPopup(auth, provider);
      await window.handleUserAuth(result.user);
    }
  } catch (err) {
    console.error("Login failed:", err);
    throw err;
  }
};

window.handleUserAuth = async function (user) {
  if (!user || isAuthProcessing) return;
  isAuthProcessing = true;

  try {
    // 1. Quick Local Check for session persistence
    const userData = {
      uid: user.uid,
      name: user.displayName,
      email: user.email,
      photo: user.photoURL
    };
    localStorage.setItem("user", JSON.stringify(userData));

    // ---------------------------
    // FIRESTORE CHECK → targeted queries (Fast & Efficient)
    // ---------------------------
    const allowedRef = collection(db, "login_control", "access", "allowedEmails");
    const allowedQuery = query(allowedRef, where("email", "==", user.email));
    
    const bannedRef = collection(db, "login_control", "access", "bannedReg");
    const sysRef = doc(db, "system", "settings");
    const userRef = doc(db, "users", user.uid);

    // Run independent checks in parallel to save time
    const [allowedSnap, userSnap, sysSnap] = await Promise.all([
      getDocs(allowedQuery),
      getDoc(userRef),
      getDoc(sysRef)
    ]);

    const allowedUser = !allowedSnap.empty ? allowedSnap.docs[0].data() : null;
    const userDocData = userSnap.exists() ? userSnap.data() : null;
    const sysData = sysSnap.exists() ? sysSnap.data() : { maintenance: false };

    // Update local allowed info
    if (allowedUser) {
      localStorage.setItem("allowedUserDetails", JSON.stringify({
        email: allowedUser.email,
        regNo: allowedUser.regNo
      }));
    }

    const domainAllowed = ALLOWED_DOMAINS.some(d => user.email.endsWith(d));
    const emailAllowed = !!allowedUser;

    if (!domainAllowed && !emailAllowed) {
      alert("Access denied. Only approved university emails or whitelisted accounts allowed.");
      await signOut(auth);
      localStorage.clear();
      if (!window.location.pathname.includes("index.html") && !window.location.pathname.includes("login.html")) {
          window.location.href = "index.html"; 
      }
      isAuthProcessing = false;
      return;
    }

    if (userDocData) {
      const regNo = userDocData.registrationNumber;
      
      // Targeted check for ban
      const bannedQuery = query(bannedRef, where("regNo", "==", regNo));
      const bannedSnap = await getDocs(bannedQuery);

      if (!bannedSnap.empty) {
        alert("Your account is banned.");
        await signOut(auth);
        localStorage.clear();
        window.location.href = "index.html";
        isAuthProcessing = false;
        return;
      }

      // Check maintenance mode
      if (sysData.maintenance && (userDocData.role || "student") === "student") {
        alert("Site is under maintenance. Only staff allowed.");
        await signOut(auth);
        localStorage.clear();
        window.location.href = "index.html";
        isAuthProcessing = false;
        return;
      }

      // ---------------------------------------------------------
      // Log System Activity (Traffic Tracking)
      // ---------------------------------------------------------
      try {
        await addDoc(collection(db, "activity"), {
          uid: user.uid,
          regNo: userDocData.registrationNumber || "N/A",
          timestamp: serverTimestamp(),
          type: "login"
        });
      } catch (logErr) {
        console.warn("Failed to log activity:", logErr);
      }
      // ---------------------------------------------------------

      // Final redirect if we are on a login/landing page
      const isOnAuthPage = window.location.pathname.includes("index.html") || 
                           window.location.pathname.includes("login.html") || 
                           window.location.pathname === "/" || 
                           window.location.pathname.endsWith("/");
      
      if (isOnAuthPage) {
          redirectByRole(userDocData.role || "student");
      }
    } else {
      // First login → go to register page if not already there
      if (!window.location.pathname.includes("register.html")) {
          window.location.href = "register.html";
      }
    }
  } catch (error) {
    console.error("Auth process error:", error);
  } finally {
    isAuthProcessing = false;
  }
};

// ------------------------------------------------------------------------------------------
// ROLE REDIRECTION
// ------------------------------------------------------------------------------------------
function redirectByRole(role) {
  if (role === "admin" || role === "owner") {
     window.location.href = "dashboard.html"; // Admins also use dashboard but have extra links
  } else {
     window.location.href = "dashboard.html";
  }
}

// ------------------------------------------------------------------------------------------
// REGISTER USER
// ------------------------------------------------------------------------------------------
window.registerUser = async function (regNumber, phone, level, semester, stream) {
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

  // Check registration setting
  const sysSnap = await getDoc(doc(db, "system", "settings"));
  if (sysSnap.exists()) {
    const sysData = sysSnap.data();
    if (sysData.maintenance) {
      alert("System is currently under maintenance.");
      return;
    }
    if (sysData.registration === false) {
      alert("Public registration is currently disabled.");
      return;
    }
  }

  const userRef = doc(db, "users", user.uid);

  await setDoc(userRef, {
    name: user.name,
    email: user.email,
    registrationNumber: regNumber,
    phone: phone,
    level: level,
    semester: semester,
    stream: stream,
    createdAt: new Date(),
    role: "student"
  });

  alert("Registration Successful!");
  window.location.href = "dashboard.html";
};

import { getStorage } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js";
const storage = getStorage(app);

export { app, auth, db, storage };
