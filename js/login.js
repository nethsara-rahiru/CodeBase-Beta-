// js/login.js
// Handles Google login for login.html

// Import firebase.js to initialize the app and register window.googleLogin
import "../assets/js/firebase.js";

const btn = document.getElementById("googleLogin");
const msg = document.getElementById("message");

if (btn) {
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.style.opacity = "0.7";
    if (msg) {
      msg.textContent = "Connecting...";
      msg.style.color = "";
    }

    try {
      await window.googleLogin();
    } catch (error) {
      console.error("Login error:", error);
      if (msg) {
        msg.textContent = "Login failed: " + (error.message || "Please try again.");
        msg.style.color = "#e53e3e";
      }
      btn.disabled = false;
      btn.style.opacity = "1";
    }
  });
}
