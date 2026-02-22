// ui.js - shared helpers for pages

function setStatus(id, msg, type = "") {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = type;
  el.textContent = msg;
}

function money(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

// Simple "login" for mock mode
// We'll use userId u1001 by default
function getCurrentUserId() {
  return localStorage.getItem("currentUserId") || "u1001";
}

function setCurrentUserId(userId) {
  localStorage.setItem("currentUserId", userId);
}

function isAdmin() {
  return (localStorage.getItem("role") || "customer") === "admin";
}

function setRole(role) {
  localStorage.setItem("role", role);
}