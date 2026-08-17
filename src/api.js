/**
 * API Client for Kauzariyya Musabaqa Mobile App
 */
export function getBaseUrl() {
    if (window.location.pathname.includes('/mobile-app/')) {
        return window.location.origin + window.location.pathname.split('/mobile-app/')[0];
    }
    return 'https://musabaqa.kauzariyya.com';
}

const LIVE_API_BASE_URL = `${getBaseUrl()}/api`;

export async function fetchAdminScoreboard() {
    try {
        const response = await fetch(`${LIVE_API_BASE_URL}/admin-scoreboard.php?t=${Date.now()}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Failed to fetch admin scoreboard:', error);
        return { ok: false, error: error.message };
    }
}

export async function startLogin(phone) {
    try {
        const response = await fetch(`${LIVE_API_BASE_URL}/login-start.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        });
        return await response.json();
    } catch (error) {
        console.error('Login start failed:', error);
        return { status: 'error', message: 'Connection failed. Please check your internet.' };
    }
}

export async function registerUser(name, email, phone) {
    try {
        const response = await fetch(`${LIVE_API_BASE_URL}/login-register.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, phone })
        });
        return await response.json();
    } catch (error) {
        console.error('Registration failed:', error);
        return { status: 'error', message: 'Connection failed. Please check your internet.' };
    }
}

export async function verifyLogin(phone, otp) {
    try {
        const response = await fetch(`${LIVE_API_BASE_URL}/login-verify.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, otp })
        });
        return await response.json();
    } catch (error) {
        console.error('OTP verification failed:', error);
        return { status: 'error', message: 'Connection failed. Please check your internet.' };
    }
}
