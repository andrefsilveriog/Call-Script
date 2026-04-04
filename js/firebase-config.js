export const firebaseConfig = {
  apiKey: "AIzaSyC_oR8R_iwsCOIz2y7dAjgS9VS_RmZ8tbo",
  authDomain: "call-script-5ac34.firebaseapp.com",
  projectId: "call-script-5ac34",
  storageBucket: "call-script-5ac34.firebasestorage.app",
  messagingSenderId: "888124309350",
  appId: "1:888124309350:web:dde48678f66748286b52a7",
};

export const isFirebaseConfigured = !Object.values(firebaseConfig).some(
  (value) => !value || value === "REPLACE_ME"
);
