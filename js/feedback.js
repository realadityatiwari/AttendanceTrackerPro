import { auth, db } from './firebase.js';
import { AppState } from './storage.js';
import { APP_VERSION } from './utils.js';

let feedbackCooldownTimer = null;
let currentCooldown = 0;

/**
 * Initializes DOM bindings for the feedback system.
 */
export function initFeedbackSystem() {
    const form = document.getElementById('feedbackForm');
    const msgInput = document.getElementById('feedbackMessage');
    const charCount = document.getElementById('feedbackCharCount');
    
    if (!form || !msgInput) return;

    // Live character counter
    msgInput.addEventListener('input', () => {
        const len = msgInput.value.length;
        charCount.textContent = `${len} / 1000`;
        if (len >= 1000) {
            charCount.style.color = 'var(--red)';
        } else {
            charCount.style.color = 'var(--text2)';
        }
    });

    form.addEventListener('submit', handleFeedbackSubmit);
}

/**
 * Displays a lightweight toast notification.
 */
function showToast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' ? '✓' : '✕';
    toast.innerHTML = `<span style="font-size:16px;">${icon}</span><span>${msg}</span>`;
    
    container.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => {
        toast.classList.add('toast-show');
    });
    
    // Remove after 4 seconds
    setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/**
 * Parses a concise structured platform object.
 */
function getShortPlatform() {
    const ua = navigator.userAgent;
    let browser = "Unknown";
    if (ua.includes("Firefox")) browser = "Firefox";
    else if (ua.includes("Edg")) browser = "Edge";
    else if (ua.includes("Chrome")) browser = "Chrome";
    else if (ua.includes("Safari")) browser = "Safari";
    
    let os = "Unknown";
    if (ua.includes("Win")) os = "Windows";
    else if (ua.includes("Mac")) os = "MacOS";
    else if (ua.includes("Android")) os = "Android";
    else if (ua.includes("like Mac")) os = "iOS";
    else if (ua.includes("Linux")) os = "Linux";
    
    return {
        browser: browser,
        os: os,
        mobile: /Mobi|Android/i.test(ua)
    };
}

/**
 * Determines the current active view in the application.
 */
function getCurrentScreen() {
    const views = ['dashboardView', 'historyView', 'profileView'];
    for (const v of views) {
        const el = document.getElementById(v);
        if (el && el.style.display !== 'none') {
            return v.replace('View', '');
        }
    }
    return 'unknown';
}

/**
 * Handles the feedback form submission and writes to Firestore.
 */
async function handleFeedbackSubmit(e) {
    e.preventDefault();
    
    if (!auth.currentUser || !AppState.profile) {
        showToast("You must be logged in to send feedback.", "error");
        return;
    }
    
    if (currentCooldown > 0) return;
    
    const btn = document.getElementById('btnFeedbackSubmit');
    const msgInput = document.getElementById('feedbackMessage');
    const catInput = document.getElementById('feedbackCategory');
    const form = document.getElementById('feedbackForm');
    
    const message = msgInput.value.trim();
    if (!message) return;
    
    // Disable inputs
    msgInput.disabled = true;
    catInput.disabled = true;
    btn.disabled = true;
    
    const origBtnText = btn.textContent;
    btn.textContent = "Sending...";
    
    const payload = {
        uid: auth.currentUser.uid,
        name: AppState.profile.name || "Unknown",
        rollNumber: AppState.profile.rollNumber || "Unknown",
        category: catInput.value,
        message: message,
        version: APP_VERSION,
        platform: getShortPlatform(),
        screen: getCurrentScreen(),
        createdAt: new Date().toISOString(),
        status: "open"
    };
    
    try {
        await db.collection('feedback').add(payload);
        showToast("Feedback sent successfully! Thank you.", "success");
        
        // Reset form
        form.reset();
        document.getElementById('feedbackCharCount').textContent = "0 / 1000";
        document.getElementById('feedbackCharCount').style.color = "var(--text2)";
        
        // Start 15 second cooldown
        startCooldown(15, btn);
        
    } catch (err) {
        console.error("Feedback error:", err);
        showToast("Failed to send feedback. Please try again.", "error");
        btn.textContent = origBtnText;
        
        // Restore controls on failure
        msgInput.disabled = false;
        catInput.disabled = false;
        btn.disabled = false;
    }
}

/**
 * Starts a client-side cooldown timer to prevent spam.
 */
function startCooldown(seconds, btn) {
    currentCooldown = seconds;
    btn.disabled = true;
    btn.textContent = `Wait ${currentCooldown}s...`;
    
    feedbackCooldownTimer = setInterval(() => {
        currentCooldown--;
        if (currentCooldown <= 0) {
            clearInterval(feedbackCooldownTimer);
            
            const msgInput = document.getElementById('feedbackMessage');
            const catInput = document.getElementById('feedbackCategory');
            
            btn.disabled = false;
            msgInput.disabled = false;
            catInput.disabled = false;
            
            btn.textContent = "Send Feedback";
        } else {
            btn.textContent = `Wait ${currentCooldown}s...`;
        }
    }, 1000);
}
