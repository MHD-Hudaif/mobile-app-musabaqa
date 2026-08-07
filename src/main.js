import './style.css';
import { LiveSocketFetcher } from './socketFetcher.js';
import { fetchAdminScoreboard, startLogin, registerUser, verifyLogin } from './api.js';

// Application State
const state = {
    event: null,
    metrics: { total_programs: 0, scheduled_programs: 0, completed_programs: 0 },
    leaderboard: [],
    recentActivity: [],
    latestUpdate: null,
    activeTab: 'standings', // 'standings' | 'activity'
    socketStatus: { state: 'connecting', label: 'Connecting...' },
    auth: {
        loggedIn: localStorage.getItem('user_logged_in') === 'true',
        phone: localStorage.getItem('user_phone') || '',
        name: localStorage.getItem('user_name') || '',
        step: 'phone', // 'phone' | 'register' | 'pending' | 'verify'
        error: '',
        info: '',
        maskedEmail: '',
        loading: false
    }
};

// Initialize Live Socket Fetcher
const socketFetcher = new LiveSocketFetcher();

// App Root
const appEl = document.getElementById('app');

/**
 * Render Header & Socket Status
 */
function renderHeader() {
    return `
        <header class="mobile-header">
            <div class="header-brand">
                <div class="brand-icon">
                    <i class="fa-solid fa-trophy"></i>
                </div>
                <div>
                    <div class="brand-title">Musabaqa Admin</div>
                    <div class="brand-subtitle">${state.event ? escapeHtml(state.event.title) : 'Live Scoreboard'}</div>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <div class="socket-badge ${state.socketStatus.state}">
                    <span class="pulse-dot"></span>
                    <span>${state.socketStatus.label}</span>
                </div>
                <button id="logoutBtn" class="logout-btn" title="Log Out">
                    <i class="fa-solid fa-right-from-bracket"></i>
                </button>
            </div>
        </header>
    `;
}

/**
 * Render Overview Metrics Bar
 */
function renderMetrics() {
    const leader = state.leaderboard.length > 0 ? state.leaderboard[0] : null;
    return `
        <div class="metrics-row">
            <div class="metric-card">
                <div class="metric-val">${state.metrics.completed_programs} / ${state.metrics.total_programs}</div>
                <div class="metric-lbl">Completed</div>
            </div>
            <div class="metric-card">
                <div class="metric-val" style="color: var(--accent-amber);">
                    ${leader ? escapeHtml(leader.team_name) : '—'}
                </div>
                <div class="metric-lbl">Leading Team</div>
            </div>
            <div class="metric-card">
                <div class="metric-val" style="color: var(--accent-cyan);">
                    ${leader ? round(leader.total_score) : '0'}
                </div>
                <div class="metric-lbl">Top Score</div>
            </div>
        </div>
    `;
}

/**
 * Render Team Leaderboard Cards
 */
function renderLeaderboard() {
    if (!state.leaderboard || state.leaderboard.length === 0) {
        return `<div class="empty-state"><i class="fa-solid fa-medal mr-2"></i> No leaderboard data recorded yet.</div>`;
    }

    return state.leaderboard.map((team, index) => {
        const rank = team.rank || index + 1;
        const color = team.color_code || 'var(--accent-indigo)';
        const divisions = team.divisions || {};

        const divisionPills = Object.entries(divisions).map(([divName, divData]) => `
            <span class="div-pill">
                ${escapeHtml(divName)}: <strong>${round(divData.score)}</strong>
            </span>
        `).join('');

        return `
            <div class="team-card" style="--team-color: ${escapeHtml(color)};">
                <div class="team-top">
                    <div class="team-left">
                        <div class="rank-badge rank-${rank}">#${rank}</div>
                        <div class="team-name">${escapeHtml(team.team_name)}</div>
                    </div>
                    <div class="score-badge">
                        ${round(team.total_score)}
                        <span class="score-unit">pts</span>
                    </div>
                </div>
                ${divisionPills ? `<div class="division-pills">${divisionPills}</div>` : ''}
            </div>
        `;
    }).join('');
}

/**
 * Render Live Activity Feed
 */
function renderActivityFeed() {
    if (!state.recentActivity || state.recentActivity.length === 0) {
        return `<div class="empty-state"><i class="fa-solid fa-bolt mr-2"></i> No recent score updates logged.</div>`;
    }

    return `
        <div class="activity-feed">
            ${state.recentActivity.map(act => `
                <div class="activity-item">
                    <div class="activity-left">
                        <div class="activity-title">${escapeHtml(act.program_title)}</div>
                        <div class="activity-sub">
                            <span style="color: ${escapeHtml(act.color_code || '#6366f1')}; font-weight: 700;">
                                ${escapeHtml(act.team_name)}
                            </span>
                            · <span>${escapeHtml(act.time_formatted || 'Recently')}</span>
                        </div>
                    </div>
                    <div class="activity-score">+${round(act.score)} pts</div>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Render Bottom Navigation Bar
 */
function renderNavigation() {
    return `
        <nav class="bottom-nav">
            <button class="nav-btn ${state.activeTab === 'standings' ? 'active' : ''}" data-tab="standings">
                <i class="fa-solid fa-chart-simple nav-icon"></i>
                <span>Standings</span>
            </button>
            <button class="nav-btn ${state.activeTab === 'activity' ? 'active' : ''}" data-tab="activity">
                <i class="fa-solid fa-list-check nav-icon"></i>
                <span>Activity Feed</span>
            </button>
        </nav>
    `;
}

/**
 * Main App Render Loop
 */
function renderApp() {
    if (!state.auth.loggedIn) {
        renderLoginFlow();
        return;
    }

    appEl.innerHTML = `
        ${renderHeader()}
        ${renderMetrics()}
        
        <div class="section-header">
            <div class="section-title">
                <i class="fa-solid ${state.activeTab === 'standings' ? 'fa-award' : 'fa-clock-rotate-left'}" style="color: var(--accent-indigo);"></i>
                <span>${state.activeTab === 'standings' ? 'Overall Team Standings' : 'Live Score Activity'}</span>
            </div>
        </div>

        <main style="display: flex; flex-direction: column; gap: 10px;">
            ${state.activeTab === 'standings' ? renderLeaderboard() : renderActivityFeed()}
        </main>

        ${renderNavigation()}
    `;

    // Attach Tab Event Listeners
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.activeTab = btn.dataset.tab;
            renderApp();
        });
    });

    // Attach Logout Event Listener
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('user_logged_in');
            localStorage.removeItem('user_phone');
            localStorage.removeItem('user_name');
            state.auth.loggedIn = false;
            state.auth.phone = '';
            state.auth.name = '';
            state.auth.step = 'phone';
            state.auth.error = '';
            state.auth.info = '';
            
            // Disconnect socket fetcher
            socketFetcher.disconnect();
            
            renderApp();
        });
    }
}

// Helper Utilities
function round(val) {
    return Math.round(Number(val) || 0);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Initial Load & Real-time Socket Setup
 */
function renderLoginFlow() {
    let cardContent = '';

    if (state.auth.step === 'phone') {
        cardContent = `
            <form id="phoneForm" class="login-form">
                <div class="input-group">
                    <label for="loginPhone">Phone Number</label>
                    <input type="tel" id="loginPhone" placeholder="Enter mobile number" value="${escapeHtml(state.auth.phone)}" required ${state.auth.loading ? 'disabled' : ''}>
                </div>
                <button type="submit" class="btn-primary" ${state.auth.loading ? 'disabled' : ''}>
                    ${state.auth.loading ? '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Processing...' : 'Continue'}
                </button>
            </form>
        `;
    } else if (state.auth.step === 'register') {
        cardContent = `
            <div class="login-info-msg">This phone number is not registered. Please enter your name and email to request admin approval.</div>
            <form id="registerForm" class="login-form">
                <div class="input-group">
                    <label for="registerName">Full Name</label>
                    <input type="text" id="registerName" placeholder="Enter your name" required ${state.auth.loading ? 'disabled' : ''}>
                </div>
                <div class="input-group">
                    <label for="registerEmail">Email Address</label>
                    <input type="email" id="registerEmail" placeholder="Enter your email" required ${state.auth.loading ? 'disabled' : ''}>
                </div>
                <button type="submit" class="btn-primary" ${state.auth.loading ? 'disabled' : ''}>
                    ${state.auth.loading ? '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Requesting...' : 'Request Approval'}
                </button>
                <button type="button" class="btn-link back-to-login">Back to Login</button>
            </form>
        `;
    } else if (state.auth.step === 'pending') {
        cardContent = `
            <div class="login-pending-state">
                <i class="fa-solid fa-user-clock pending-icon"></i>
                <h3>Approval Pending</h3>
                <p>Your registration request has been submitted and is currently queued for admin approval.</p>
                <p style="font-size: 13px; color: var(--text-muted); margin-top: 10px;">Please contact the administrator to speed up approval.</p>
                <button type="button" class="btn-primary back-to-login" style="margin-top: 20px;">Back to Login</button>
            </div>
        `;
    } else if (state.auth.step === 'verify') {
        cardContent = `
            <div class="login-info-msg">We've sent a 6-digit OTP code to your registered email:<br><strong>${escapeHtml(state.auth.maskedEmail)}</strong></div>
            <form id="verifyForm" class="login-form">
                <div class="input-group">
                    <label for="otpCode">Enter 6-Digit OTP</label>
                    <input type="text" id="otpCode" placeholder="Enter OTP code" pattern="[0-9]{6}" maxlength="6" required ${state.auth.loading ? 'disabled' : ''}>
                </div>
                <button type="submit" class="btn-primary" ${state.auth.loading ? 'disabled' : ''}>
                    ${state.auth.loading ? '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Verifying...' : 'Verify & Login'}
                </button>
                <button type="button" class="btn-link back-to-login">Back to Login</button>
            </form>
        `;
    }

    appEl.innerHTML = `
        <div class="login-container">
            <div class="login-card">
                <div class="login-brand">
                    <div class="brand-icon">
                        <i class="fa-solid fa-trophy"></i>
                    </div>
                    <h2 class="brand-title">Kauzariyya Musabaqa</h2>
                    <p class="brand-subtitle">Participant Portal</p>
                </div>
                
                ${state.auth.error ? `<div class="login-alert alert-error"><i class="fa-solid fa-circle-exclamation mr-2"></i> ${escapeHtml(state.auth.error)}</div>` : ''}
                ${state.auth.info ? `<div class="login-alert alert-info"><i class="fa-solid fa-circle-info mr-2"></i> ${escapeHtml(state.auth.info)}</div>` : ''}
                
                ${cardContent}
            </div>
        </div>
    `;

    attachLoginListeners();
}

function attachLoginListeners() {
    document.querySelectorAll('.back-to-login').forEach(btn => {
        btn.addEventListener('click', () => {
            state.auth.step = 'phone';
            state.auth.error = '';
            state.auth.info = '';
            renderApp();
        });
    });

    const phoneForm = document.getElementById('phoneForm');
    if (phoneForm) {
        phoneForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const phoneInput = document.getElementById('loginPhone');
            const phoneVal = phoneInput.value.trim();
            if (!phoneVal) return;

            state.auth.loading = true;
            state.auth.error = '';
            state.auth.info = '';
            renderApp();

            const res = await startLogin(phoneVal);
            state.auth.loading = false;

            if (res.status === 'otp_sent') {
                state.auth.phone = phoneVal;
                state.auth.maskedEmail = res.email_masked;
                state.auth.step = 'verify';
            } else if (res.status === 'new_user') {
                state.auth.phone = phoneVal;
                state.auth.step = 'register';
            } else if (res.status === 'pending') {
                state.auth.phone = phoneVal;
                state.auth.step = 'pending';
            } else {
                state.auth.error = res.message || 'Login initiation failed.';
            }
            renderApp();
        });
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('registerName');
            const emailInput = document.getElementById('registerEmail');
            const nameVal = nameInput.value.trim();
            const emailVal = emailInput.value.trim();

            if (!nameVal || !emailVal) return;

            state.auth.loading = true;
            state.auth.error = '';
            state.auth.info = '';
            renderApp();

            const res = await registerUser(nameVal, emailVal, state.auth.phone);
            state.auth.loading = false;

            if (res.status === 'queued') {
                state.auth.step = 'pending';
            } else {
                state.auth.error = res.message || 'Registration request failed.';
            }
            renderApp();
        });
    }

    const verifyForm = document.getElementById('verifyForm');
    if (verifyForm) {
        verifyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const otpInput = document.getElementById('otpCode');
            const otpVal = otpInput.value.trim();
            if (!otpVal || otpVal.length !== 6) return;

            state.auth.loading = true;
            state.auth.error = '';
            state.auth.info = '';
            renderApp();

            const res = await verifyLogin(state.auth.phone, otpVal);
            state.auth.loading = false;

            if (res.status === 'success') {
                localStorage.setItem('user_logged_in', 'true');
                localStorage.setItem('user_phone', res.user.phone);
                localStorage.setItem('user_name', res.user.full_name);
                state.auth.loggedIn = true;
                state.auth.name = res.user.full_name;
                
                init();
            } else {
                state.auth.error = res.message || 'OTP verification failed.';
                renderApp();
            }
        });
    }
}

async function init() {
    if (!state.auth.loggedIn) {
        renderApp();
        return;
    }

    // 1. Initial REST API Fetch
    const initialData = await fetchAdminScoreboard();
    if (initialData && initialData.ok) {
        state.event = initialData.event;
        state.metrics = initialData.metrics;
        state.leaderboard = initialData.leaderboard || [];
        state.recentActivity = initialData.recent_activity || [];
        state.latestUpdate = initialData.latest_update;
        renderApp();
    } else {
        state.socketStatus = { state: 'offline', label: 'Backend Unavailable' };
        renderApp();
    }

    // 2. Connect Real-time Socket Setup
    if (!socketFetcher.isConnected) {
        socketFetcher.onStatusChange((statusState, statusText) => {
            state.socketStatus = { state: statusState, label: statusText };
            renderApp();
        });

        socketFetcher.onScoreUpdate((updateData) => {
            if (updateData.leaderboard) {
                state.leaderboard = updateData.leaderboard;
            }
            if (updateData.metrics) {
                state.metrics = updateData.metrics;
            }
            if (updateData.recent_activity) {
                state.recentActivity = updateData.recent_activity;
            }
            renderApp();
        });

        socketFetcher.connect();
    }
}

init();
