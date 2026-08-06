/**
 * Real-time Socket & Server-Sent Events (SSE) Fetcher
 * Establishes persistent real-time streaming with automatic reconnection
 * using https://musabaqa.kauzariyya.com as the live primary URL and fallback HTTP polling.
 */
export class LiveSocketFetcher {
    constructor(apiBaseUrl = 'https://musabaqa.kauzariyya.com') {
        this.apiBaseUrl = apiBaseUrl.replace(/\/+$/, '');
        this.localBaseUrl = (window.location.origin + '/kauzariyya-musabaqa').replace(/\/+$/, '');
        this.eventSource = null;
        this.pollingTimer = null;
        this.isConnected = false;
        this.listeners = {
            onStatusChange: [],
            onScoreUpdate: [],
            onActivityLog: []
        };
    }

    /**
     * Start socket stream listener
     */
    connect() {
        const streamUrl = `${this.apiBaseUrl}/api/live-stream.php`;

        try {
            if (this.eventSource) {
                this.eventSource.close();
            }

            this.eventSource = new EventSource(streamUrl);

            this.eventSource.addEventListener('connected', (e) => {
                const data = JSON.parse(e.data);
                this.isConnected = true;
                this.notifyStatus('live', 'Live Socket Connected');
            });

            this.eventSource.addEventListener('score_update', (e) => {
                const data = JSON.parse(e.data);
                this.isConnected = true;
                this.notifyStatus('live', 'Live Stream Active');
                this.notifyScoreUpdate(data);
            });

            this.eventSource.addEventListener('error', (err) => {
                this.isConnected = false;
                this.notifyStatus('polling', 'Reconnecting... (Fallback Polling)');
                this.startFallbackPolling();
            });

        } catch (error) {
            console.warn('SSE stream error, starting fallback polling', error);
            this.startFallbackPolling();
        }
    }

    /**
     * Fallback HTTP Polling mode if SSE stream drops
     */
    startFallbackPolling() {
        if (this.pollingTimer) return;
        this.pollingTimer = setInterval(async () => {
            try {
                let res = await fetch(`${this.apiBaseUrl}/api/admin-scoreboard.php?t=${Date.now()}`).catch(() => null);
                if (!res || !res.ok) {
                    res = await fetch(`${this.localBaseUrl}/api/admin-scoreboard.php?t=${Date.now()}`);
                }
                if (!res.ok) throw new Error('Polling failed');
                const data = await res.json();
                if (data.ok) {
                    this.notifyScoreUpdate({
                        leaderboard: data.leaderboard,
                        latest_update: data.latest_update,
                        metrics: data.metrics,
                        recent_activity: data.recent_activity
                    });
                }
            } catch (err) {
                this.notifyStatus('offline', 'Offline / Connection Retry');
            }
        }, 3000);
    }

    /**
     * Disconnect socket stream
     */
    disconnect() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        if (this.pollingTimer) {
            clearInterval(this.pollingTimer);
            this.pollingTimer = null;
        }
        this.isConnected = false;
        this.notifyStatus('offline', 'Disconnected');
    }

    /**
     * Event Subscriptions
     */
    onStatusChange(fn) {
        this.listeners.onStatusChange.push(fn);
    }

    onScoreUpdate(fn) {
        this.listeners.onScoreUpdate.push(fn);
    }

    notifyStatus(state, text) {
        this.listeners.onStatusChange.forEach(fn => fn(state, text));
    }

    notifyScoreUpdate(data) {
        this.listeners.onScoreUpdate.forEach(fn => fn(data));
    }
}
