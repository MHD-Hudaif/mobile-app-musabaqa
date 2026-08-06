/**
 * API Client for Kauzariyya Musabaqa Mobile App
 */
const LIVE_API_BASE_URL = 'https://musabaqa.kauzariyya.com/api';
const LOCAL_API_BASE_URL = '/kauzariyya-musabaqa/api';

export async function fetchAdminScoreboard() {
    try {
        // Try live production API base URL first
        let response = await fetch(`${LIVE_API_BASE_URL}/admin-scoreboard.php?t=${Date.now()}`).catch(() => null);
        
        // Fallback to local server if live API request fails
        if (!response || !response.ok) {
            response = await fetch(`${LOCAL_API_BASE_URL}/admin-scoreboard.php?t=${Date.now()}`);
        }
        
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
