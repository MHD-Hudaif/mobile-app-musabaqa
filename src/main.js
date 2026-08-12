import './style.css';
import { LiveSocketFetcher } from './socketFetcher.js';
import { fetchAdminScoreboard } from './api.js';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { App } from '@capacitor/app';

// Application State
const state = {
    view: 'home', // 'home' | 'scoreboard' | 'slideshow'
    event: null,
    metrics: { total_programs: 0, scheduled_programs: 0, completed_programs: 0 },
    leaderboard: [],
    recentActivity: [],
    latestUpdate: null,
    activeTab: 'standings', // 'standings' | 'activity'
    socketStatus: { state: 'connecting', label: 'Connecting...' },
    auth: {
        loggedIn: true, // Temporarily bypassed/disabled login
        phone: '',
        name: '',
        step: 'phone',
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
                <button id="backToHomeBtn" class="back-btn" style="background: transparent; border: none; color: var(--text-main); font-size: 18px; cursor: pointer; padding-right: 8px; display: flex; align-items: center;" title="Back to Home">
                    <i class="fa-solid fa-arrow-left"></i>
                </button>
                <div class="brand-icon">
                    <i class="fa-solid fa-trophy"></i>
                </div>
                <div>
                    <div class="brand-title">Kauzariyya Musabaqa</div>
                    <div class="brand-subtitle">${state.event ? escapeHtml(state.event.title) : 'Live Scoreboard'}</div>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <div class="socket-badge ${state.socketStatus.state}">
                    <span class="pulse-dot"></span>
                    <span>${state.socketStatus.label}</span>
                </div>
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
 * Landscape Lock & Unlock helpers
 */
async function lockLandscape() {
    try {
        await ScreenOrientation.lock({ orientation: 'landscape' });
    } catch (e) {
        console.warn('Native ScreenOrientation lock failed, trying standard API:', e);
        try {
            if (screen.orientation && screen.orientation.lock) {
                await screen.orientation.lock('landscape');
            }
        } catch (wErr) {
            console.warn('Standard ScreenOrientation lock failed:', wErr);
        }
    }
}

async function unlockOrientation() {
    try {
        await ScreenOrientation.unlock();
    } catch (e) {
        console.warn('Native ScreenOrientation unlock failed, trying standard API:', e);
        try {
            if (screen.orientation && screen.orientation.unlock) {
                screen.orientation.unlock();
            }
        } catch (wErr) {
            console.warn('Standard ScreenOrientation unlock failed:', wErr);
        }
    }
}

/**
 * Screen state switch handlers
 */
function showSlideshow() {
    state.view = 'slideshow';
    lockLandscape();
    renderApp();
}

function exitSlideshow() {
    state.view = 'home';
    unlockOrientation();
    renderApp();
}

function showScoreboard() {
    state.view = 'scoreboard';
    renderApp();
}

function goHome() {
    state.view = 'home';
    renderApp();
}

/**
 * Render home dashboard
 */
function renderHomeView() {
    appEl.innerHTML = `
        <div class="home-container">
            <div class="home-card">
                <div class="home-brand">
                    <div class="brand-logo">
                        <i class="fa-solid fa-trophy"></i>
                    </div>
                    <h1>Kauzariyya Musabaqa</h1>
                    <p>Live Event Hub</p>
                </div>
                
                <div class="home-menu">
                    <button id="launchSlideshowBtn" class="menu-item-btn">
                        <div class="menu-item-icon">
                            <i class="fa-solid fa-tv"></i>
                        </div>
                        <div class="menu-item-content">
                            <span class="menu-item-title">Launch Slideshow</span>
                            <span class="menu-item-desc">Fullscreen presentation view (Auto-Landscape)</span>
                        </div>
                    </button>
                    
                    <button id="viewScoreboardBtn" class="menu-item-btn">
                        <div class="menu-item-icon">
                            <i class="fa-solid fa-chart-line"></i>
                        </div>
                        <div class="menu-item-content">
                            <span class="menu-item-title">Standings & Feed</span>
                            <span class="menu-item-desc">Check overall standings and real-time updates</span>
                        </div>
                    </button>
                </div>
                
                <div class="home-footer-status">
                    <div class="socket-badge ${state.socketStatus.state}">
                        <span class="pulse-dot"></span>
                        <span>${state.socketStatus.label}</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Attach menu click event listeners
    document.getElementById('launchSlideshowBtn').addEventListener('click', showSlideshow);
    document.getElementById('viewScoreboardBtn').addEventListener('click', showScoreboard);
}

/**
 * Render fullscreen iframe slideshow
 */
function renderSlideshowView() {
    appEl.innerHTML = `
        <div class="slideshow-view">
            <button id="closeSlideshowBtn" class="slideshow-back-btn">
                <i class="fa-solid fa-arrow-left"></i>
                <span>Back to Home</span>
            </button>
            <iframe class="slideshow-iframe" src="https://musabaqa.kauzariyya.com/live-display/"></iframe>
        </div>
    `;

    document.getElementById('closeSlideshowBtn').addEventListener('click', exitSlideshow);
}

/**
 * Render scoreboard view (Original standings + recent activities)
 */
function renderScoreboardView() {
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

    // Attach navigation Tab listeners
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.activeTab = btn.dataset.tab;
            renderScoreboardView();
        });
    });

    // Attach Back to Home button listener
    const backToHomeBtn = document.getElementById('backToHomeBtn');
    if (backToHomeBtn) {
        backToHomeBtn.addEventListener('click', goHome);
    }
}

/**
 * Main App Render Loop
 */
function renderApp() {
    if (state.view === 'home') {
        renderHomeView();
    } else if (state.view === 'slideshow') {
        renderSlideshowView();
    } else if (state.view === 'scoreboard') {
        renderScoreboardView();
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
async function init() {
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

    // 3. Hardware back button listener for Android
    try {
        App.addListener('backButton', () => {
            if (state.view === 'slideshow') {
                exitSlideshow();
            } else if (state.view === 'scoreboard') {
                goHome();
            } else {
                App.exitApp();
            }
        });
    } catch (err) {
        console.warn('Native App back button listener not available:', err);
    }
}

init();

