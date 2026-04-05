// ============================================
// НАСТРОЙКИ ДЛЯ SPOTIFY API (GITHUB PAGES)
// ============================================

const SPOTIFY_CONFIG = {
    // 👇 ЗАМЕНИ НА СВОЙ CLIENT ID (получить: https://developer.spotify.com/dashboard)
    clientId: 'YOUR_CLIENT_ID_HERE',
    
    // 👇 АДРЕС ТВОЕГО GITHUB PAGES (пример: https://ivanov23.github.io/spotify-music-app/)
    // ВАЖНО: Этот же адрес добавь в Redirect URIs в настройках приложения Spotify!
    redirectUri: 'https://ТВОЙ_ЛОГИН.github.io/spotify-music-app/',
    
    // Разрешения (минимальные)
    scopes: ['user-read-private', 'user-read-email'],
    
    // URL (не менять)
    authUrl: 'https://accounts.spotify.com/authorize',
    apiUrl: 'https://api.spotify.com/v1'
};