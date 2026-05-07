// assets/js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
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
  addDoc,
  updateDoc,
  deleteDoc,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

let db;
try {
  // Mobile browsers can be flaky with multi-tab persistence, so we use a simpler approach for mobile
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isMobile) {
    db = getFirestore(app);
    console.log("Firestore initialized in standard mode (Mobile optimization)");
  } else {
    db = initializeFirestore(app, {
      cache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
    console.log("Firestore initialized with multi-tab persistence (Desktop)");
  }
} catch (e) {
  console.warn("Firestore initialization fallback:", e);
  db = getFirestore(app);
}

const provider = new GoogleAuthProvider();

const ALLOWED_DOMAINS = ["@std.uwu.ac.lk", "@uwu.ac.lk", "@stu.vau.ac.lk", "@vau.ac.lk", "@univ.jfn.ac.lk"];

// ------------------------------------------------------------------------------------------
// GOOGLE LOGIN
// ------------------------------------------------------------------------------------------

let isAuthProcessing = false;

// Pick up result from redirect if any
getRedirectResult(auth)
  .then((result) => {
    if (result) {
      console.log(">>> Redirect result found for:", result.user.email);
      handleUserAuth(result.user);
    } else {
      console.log("getRedirectResult returned null (Normal load)");
    }
  })
  .catch((error) => {
    console.error("getRedirectResult error:", error);
  });

export const googleLogin = async function () {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isLocalDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname.startsWith("192.168.");
  
  console.log("Login clicked. Mobile:", isMobile, "LocalDev:", isLocalDev);

  try {
    // Force redirect on mobile to avoid popup issues entirely
    if (isMobile && !isLocalDev) {
      console.log("Forcing signInWithRedirect for mobile production...");
      await signInWithRedirect(auth, provider);
      return;
    }

    try {
      console.log("Attempting signInWithPopup...");
      const result = await signInWithPopup(auth, provider);
      await handleUserAuth(result.user);
    } catch (popupErr) {
      console.warn("signInWithPopup failed:", popupErr.code, popupErr.message);
      // Fallback to redirect for ANY error on mobile or if blocked
      if (isMobile || popupErr.code === 'auth/popup-blocked' || popupErr.code === 'auth/cancelled-popup-request') {
        console.log("Falling back to signInWithRedirect...");
        await signInWithRedirect(auth, provider);
      } else {
        throw popupErr;
      }
    }
  } catch (err) {
    console.error("Auth Initiation Error:", err);
    alert("Login failed to start: " + err.message);
  }
};
window.googleLogin = googleLogin;

let authPromise = null;

export const handleUserAuth = async function (user) {
  if (!user) {
    console.log("handleUserAuth called with null user");
    return;
  }
  
  if (authPromise) {
    console.log("Auth verification already in progress for:", user.email, " - awaiting existing process.");
    return authPromise;
  }
  
  authPromise = (async () => {
    isAuthProcessing = true;
    console.log(">>> Starting Auth Verification (New Process) for:", user.email);

    try {
      const userData = {
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        photo: user.photoURL
      };
      localStorage.setItem("user", JSON.stringify(userData));
      console.log("User data cached locally.");

      const userEmail = user.email.toLowerCase();
      const allowedRef = collection(db, "login_control", "access", "allowedEmails");
      const allowedQuery = query(allowedRef, where("email", "==", userEmail));
      
      const bannedRef = collection(db, "login_control", "access", "bannedReg");
      const sysRef = doc(db, "system", "settings");
      const userRef = doc(db, "users", user.uid);

      console.log("Fetching Firestore data (allowed, user, system)...");
      const [allowedSnap, userSnap, sysSnap] = await Promise.all([
        getDocs(allowedQuery),
        getDoc(userRef),
        getDoc(sysRef)
      ]);
      console.log("Firestore data fetched successfully.");

      const allowedUser = !allowedSnap.empty ? allowedSnap.docs[0].data() : null;
      const userDocData = userSnap.exists() ? userSnap.data() : null;
      const sysData = sysSnap.exists() ? sysSnap.data() : { maintenance: false };

      if (allowedUser) {
        console.log("User found in whitelist:", allowedUser.regNo);
        localStorage.setItem("allowedUserDetails", JSON.stringify({
          email: allowedUser.email,
          regNo: allowedUser.regNo
        }));
      }

      const domainAllowed = ALLOWED_DOMAINS.some(d => user.email.toLowerCase().endsWith(d.toLowerCase()));
      const emailAllowed = !!allowedUser;

      if (!domainAllowed && !emailAllowed) {
        console.warn("Access Denied: DomainAllowed:", domainAllowed, "EmailAllowed:", emailAllowed);
        alert(`Access Denied!\n\nEmail: ${user.email}\nReason: Not a university email AND not found in the whitelist.\n\nPlease register through the "Request Access" link if you haven't already.`);
        await signOut(auth);
        localStorage.clear();
        window.location.href = "login.html";
        return;
      }

      console.log("Verification Passed. UserDocExists:", !!userDocData);

      if (userDocData) {
        const regNo = userDocData.registrationNumber;
        console.log("User document found. RegNo:", regNo);
        
        const bannedQuery = query(bannedRef, where("regNo", "==", regNo));
        const bannedSnap = await getDocs(bannedQuery);

        if (!bannedSnap.empty) {
          console.warn("User is banned.");
          alert("Your account is banned.");
          await signOut(auth);
          localStorage.clear();
          window.location.href = "login.html";
          return;
        }

        if (sysData.maintenance && (userDocData.role || "student") === "student") {
          console.warn("System maintenance mode active.");
          alert("Site is under maintenance. Only staff allowed.");
          await signOut(auth);
          localStorage.clear();
          window.location.href = "login.html";
          return;
        }

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

        const path = window.location.pathname.toLowerCase();
        const isOnAuthPage = path.includes("login.html") || 
                             path.includes("login-access.html") || 
                             path === "/" || 
                             path.endsWith("/") ||
                             !path.includes(".html"); 
        
        console.log("Redirection check - Path:", path, "IsOnAuthPage:", isOnAuthPage);
        if (isOnAuthPage) {
            console.log("Redirecting to dashboard...");
            redirectByRole(userDocData.role || "student");
        }
      } else {
        console.log("New user detected. Redirecting to registration...");
        if (!window.location.pathname.includes("register.html")) {
            window.location.href = "register.html";
        }
      }
    } catch (error) {
      console.error("Critical Auth Verification Error:", error);
      alert("Verification Error: " + error.message + "\n\nThis might be a permission or connection issue. Please contact support.");
    } finally {
      isAuthProcessing = false;
      authPromise = null;
      console.log("<<< Auth Verification Finished.");
    }
  })();
  
  return authPromise;
};
window.handleUserAuth = handleUserAuth;

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
