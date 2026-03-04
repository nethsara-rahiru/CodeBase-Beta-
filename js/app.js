// js/app.js
// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-analytics.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Firebase configuration (your provided config)
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
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const regNumber = document.getElementById("regNumber");
const password = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const message = document.getElementById("message");

// Signup
signupBtn.addEventListener("click", async () => {
    if (regNumber.value === "" || password.value === "") {
        message.textContent = "Please fill all fields";
        return;
    }

    try {
        const email = regNumber.value + "@codebase.com"; // fake email for Firebase
        const userCredential = await createUserWithEmailAndPassword(auth, email, password.value);

        // Save user in Firestore
        await setDoc(doc(db, "users", regNumber.value), {
            regNumber: regNumber.value,
            role: "student"
        });

        message.textContent = "Signup successful! Please login.";
    } catch (error) {
        message.textContent = error.message;
    }
});

// Login
loginBtn.addEventListener("click", async () => {
    if (regNumber.value === "" || password.value === "") {
        message.textContent = "Please fill all fields";
        return;
    }

    try {
        const email = regNumber.value + "@codebase.com";
        const userCredential = await signInWithEmailAndPassword(auth, email, password.value);

        // Redirect to dashboard
        window.location.href = "dashboard.html";
    } catch (error) {
        message.textContent = "Login failed: " + error.message;
    }
});
