import './style.css';
import { LiveSocketFetcher } from './socketFetcher.js';
import { fetchAdminScoreboard } from './api.js';

// Application State
const state = {
    event: null,
    metrics: { total_programs: 0, scheduled_programs: 0, completed_programs: 0 },
    leaderboard: [],
    recentActivity: [],
    latestUpdate: null,
    activeTab: 'standings', // 'standings' | 'activity'
    socketStatus: { state: 'connecting', label: 'Connecting...' }
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
            <div class="socket-badge ${state.socketStatus.state}">
                <span class="pulse-dot"></span>
                <span>${state.socketStatus.label}</span>
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

    // 2. Connect Real-time Socket Fetcher
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

init();
