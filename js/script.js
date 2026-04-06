
let token = null;
let allTracks = [];
let selectedGenre = null;
let codeVerifier = null;

// DOM элементы
const loginBtn = document.getElementById('loginButton');
const logoutBtn = document.getElementById('logoutButton');
const userArea = document.getElementById('userArea');
const userImg = document.getElementById('userImage');
const userNameSpan = document.getElementById('userNameText');
const searchBtn = document.getElementById('searchButton');
const trackListDiv = document.getElementById('trackList');
const genreContainer = document.getElementById('genreGroup');
const playerPanel = document.getElementById('playerPanel');
const audio = document.getElementById('playerAudio');
const playerTrack = document.getElementById('playerTrackTitle');
const playerArtist = document.getElementById('playerArtistTitle');
const playerCover = document.getElementById('playerCover');
const closePlayerBtn = document.getElementById('closePlayerButton');

// Создаем поле поиска
const searchInput = document.createElement('input');
searchInput.type = 'text';
searchInput.placeholder = '🔍 Найти песню или исполнителя...';
searchInput.id = 'searchInput';
searchInput.className = 'search-input';

// Вставляем поле поиска
const searchControl = document.querySelector('.genre-group');
if (searchControl) {
    searchControl.after(searchInput);
}

// Список жанров
const GENRES = ['pop', 'rock', 'hip-hop', 'electronic', 'jazz', 'classical', 'r&b', 'country', 'reggae', 'blues', 'metal', 'punk'];

// ========== ФУНКЦИИ PKCE ==========
function generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let text = '';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function generateCodeChallenge(codeVerifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

// ========== АВТОРИЗАЦИЯ ==========
async function authorize() {
    console.log('Авторизация запущена...');
    
    codeVerifier = generateRandomString(128);
    localStorage.setItem('code_verifier', codeVerifier);
    
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    
    const params = new URLSearchParams();
    params.append('client_id', SPOTIFY_CONFIG.clientId);
    params.append('response_type', 'code');
    params.append('redirect_uri', SPOTIFY_CONFIG.redirectUri);
    params.append('code_challenge_method', 'S256');
    params.append('code_challenge', codeChallenge);
    params.append('scope', 'user-read-private user-read-email');
    
    const authUrl = `${SPOTIFY_CONFIG.authUrl}?${params.toString()}`;
    console.log('Переход на URL:', authUrl);
    window.location.href = authUrl;
}

// ========== ОБМЕН КОДА НА ТОКЕН ==========
async function exchangeCodeForToken(code) {
    const verifier = localStorage.getItem('code_verifier');
    
    const params = new URLSearchParams();
    params.append('client_id', SPOTIFY_CONFIG.clientId);
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', SPOTIFY_CONFIG.redirectUri);
    params.append('code_verifier', verifier);
    
    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
        
        const data = await response.json();
        console.log('Ответ от токена:', data);
        
        if (data.access_token) {
            token = data.access_token;
            localStorage.setItem('spotify_token', token);
            localStorage.removeItem('code_verifier');
            await loadUser();
            searchBtn.disabled = false;
        } else if (data.error) {
            console.error('Ошибка:', data.error_description);
            alert('Ошибка авторизации: ' + data.error_description);
        }
    } catch (err) {
        console.error('Ошибка получения токена:', err);
        alert('Ошибка подключения к Spotify');
    }
}

// ========== ПРОВЕРКА КОДА ИЗ URL ==========
async function checkCodeFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    
    if (error) {
        console.error('Ошибка от Spotify:', error);
        alert('Ошибка: ' + error);
        return;
    }
    
    if (code) {
        console.log('Код получен, обмениваю на токен...');
        await exchangeCodeForToken(code);
        window.history.pushState({}, document.title, window.location.pathname);
    } else {
        const savedToken = localStorage.getItem('spotify_token');
        if (savedToken) {
            token = savedToken;
            await loadUser();
            searchBtn.disabled = false;
        }
    }
}

// ========== ЗАГРУЗКА ПРОФИЛЯ ==========
async function loadUser() {
    if (!token) return;
    
    try {
        const res = await fetch(`${SPOTIFY_CONFIG.apiUrl}/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            const data = await res.json();
            userNameSpan.textContent = data.display_name || data.email || 'Пользователь';
            if (data.images && data.images[0]) userImg.src = data.images[0].url;
            loginBtn.style.display = 'none';
            userArea.style.display = 'flex';
            console.log('Пользователь загружен:', data.display_name);
        } else if (res.status === 401) {
            logout();
        }
    } catch (err) {
        console.error('Ошибка:', err);
    }
}

// ========== СОЗДАНИЕ КНОПОК ЖАНРОВ ==========
function createGenreButtons() {
    GENRES.forEach(genre => {
        const btn = document.createElement('button');
        btn.textContent = genre.charAt(0).toUpperCase() + genre.slice(1);
        btn.className = 'genre-chip';
        btn.dataset.genre = genre;
        btn.onclick = () => {
            document.querySelectorAll('.genre-chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedGenre = genre;
            searchInput.value = '';
        };
        genreContainer.appendChild(btn);
    });
}

// ========== ПОИСК ТРЕКОВ ==========
async function searchTracks() {
    // Проверяем токен
    if (!token) {
        const savedToken = localStorage.getItem('spotify_token');
        if (savedToken) {
            token = savedToken;
        } else {
            alert('Сначала авторизуйтесь через Spotify!');
            authorize();
            return;
        }
    }
    
    // Получаем поисковый запрос
    let query = searchInput.value.trim();
    
    if (!query && selectedGenre) {
        query = selectedGenre;
    }
    
    if (!query) {
        alert('Введи название песни/исполнителя или выбери жанр!');
        return;
    }
    
    trackListDiv.innerHTML = '<div class="empty-message">⏳ Загрузка...</div>';
    
    try {
        const encodedQuery = encodeURIComponent(query);
        const url = `${SPOTIFY_CONFIG.apiUrl}/search?q=${encodedQuery}&type=track&limit=24&market=RU`;
        
        console.log('Запрос:', url);
        
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log('Статус:', res.status);
        
        if (res.status === 401) {
            localStorage.removeItem('spotify_token');
            token = null;
            alert('Сессия истекла, войдите заново');
            authorize();
            return;
        }
        
        if (!res.ok) {
            throw new Error(`Ошибка ${res.status}`);
        }
        
        const data = await res.json();
        allTracks = data.tracks?.items || [];
        
        if (allTracks.length === 0) {
            trackListDiv.innerHTML = '<div class="empty-message">😔 Ничего не найдено. Попробуй другой запрос.</div>';
        } else {
            renderTracks();
        }
    } catch (err) {
        console.error('Ошибка:', err);
        trackListDiv.innerHTML = '<div class="empty-message">❌ Ошибка загрузки. Попробуй позже.</div>';
    }
}

// ========== ОТОБРАЖЕНИЕ ТРЕКОВ ==========
function renderTracks() {
    trackListDiv.innerHTML = allTracks.map(track => {
        const artist = track.artists.map(a => a.name).join(', ');
        const imgUrl = track.album.images?.[2]?.url || track.album.images?.[1]?.url || null;
        const hasPreview = track.preview_url ? true : false;
        
        return `
            <div class="track-card" data-id="${track.id}">
                <div class="track-cover-small">
                    ${imgUrl ? `<img src="${imgUrl}" alt="">` : '<i class="fas fa-music"></i>'}
                </div>
                <div class="track-details">
                    <div class="track-title">${escapeHtml(track.name)}</div>
                    <div class="track-artist-name">${escapeHtml(artist)}</div>
                    ${!hasPreview ? '<div style="font-size: 10px; color: #888;">⛔ нет превью</div>' : ''}
                </div>
                ${hasPreview ? `<button class="play-track-btn" onclick="playTrack('${track.id}')"><i class="fas fa-play"></i></button>` : '<button class="play-track-btn" disabled style="opacity:0.3"><i class="fas fa-play"></i></button>'}
            </div>
        `;
    }).join('');
}

// ========== ВОСПРОИЗВЕДЕНИЕ ==========
window.playTrack = function(trackId) {
    const track = allTracks.find(t => t.id === trackId);
    if (!track || !track.preview_url) {
        alert('Превью недоступно');
        return;
    }
    
    playerTrack.textContent = track.name;
    playerArtist.textContent = track.artists.map(a => a.name).join(', ');
    
    const img = track.album.images?.[1]?.url;
    if (img) {
        playerCover.innerHTML = `<img src="${img}" style="width:55px;height:55px;border-radius:8px;object-fit:cover">`;
    } else {
        playerCover.innerHTML = '🎵';
    }
    
    audio.src = track.preview_url;
    playerPanel.style.display = 'flex';
    audio.play().catch(e => console.log('Ошибка воспроизведения'));
};

// ========== ВЫХОД ==========
function logout() {
    token = null;
    localStorage.removeItem('spotify_token');
    localStorage.removeItem('code_verifier');
    loginBtn.style.display = 'block';
    userArea.style.display = 'none';
    searchBtn.disabled = true;
    trackListDiv.innerHTML = '<div class="empty-message">🎵 Авторизуйся и найди музыку</div>';
    playerPanel.style.display = 'none';
    audio.pause();
    selectedGenre = null;
    searchInput.value = '';
    document.querySelectorAll('.genre-chip').forEach(b => b.classList.remove('active'));
}

// ========== НАСТРОЙКА СОБЫТИЙ ==========
function setupEvents() {
    loginBtn.onclick = () => authorize();
    logoutBtn.onclick = logout;
    searchBtn.onclick = searchTracks;
    closePlayerBtn.onclick = () => {
        playerPanel.style.display = 'none';
        audio.pause();
    };
    
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchTracks();
        }
    });
}

// ========== ЗАЩИТА ОТ XSS ==========
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ========== ЗАПУСК ПРИЛОЖЕНИЯ ==========
window.addEventListener('load', () => {
    console.log('Spotify Music Player загружен');
    console.log('Redirect URI:', SPOTIFY_CONFIG.redirectUri);
    
    createGenreButtons();
    checkCodeFromUrl();
    setupEvents();
});
