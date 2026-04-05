// ============================================
// ОСНОВНОЙ СКРИПТ (минимальный)
// ============================================

let token = null;
let allTracks = [];
let selectedGenre = null;

// Элементы DOM
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

// Список жанров
const GENRES = ['pop', 'rock', 'hip-hop', 'electronic', 'jazz', 'classical', 'r&b', 'country', 'reggae', 'blues', 'metal', 'punk'];

// ========== ЗАПУСК ==========
window.addEventListener('load', () => {
    createGenreButtons();
    checkTokenFromUrl();
    setupEvents();
});

// Создание кнопок жанров
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
            if (token) searchBtn.disabled = false;
        };
        genreContainer.appendChild(btn);
    });
}

// Проверка токена в URL (после редиректа от Spotify)
function checkTokenFromUrl() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    
    if (accessToken) {
        token = accessToken;
        localStorage.setItem('spotify_token', token);
        window.history.pushState({}, document.title, window.location.pathname);
        loadUser();
        enableSearch();
    } else {
        const savedToken = localStorage.getItem('spotify_token');
        if (savedToken) {
            token = savedToken;
            loadUser();
            enableSearch();
        }
    }
}

// Загрузка профиля пользователя
async function loadUser() {
    try {
        const res = await fetch(`${SPOTIFY_CONFIG.apiUrl}/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            userNameSpan.textContent = data.display_name || data.email || 'Пользователь';
            if (data.images && data.images[0]) userImg.src = data.images[0].url;
            document.getElementById('loginButton').style.display = 'none';
            userArea.style.display = 'flex';
        } else if (res.status === 401) {
            logout();
        }
    } catch (err) {
        console.log('Ошибка загрузки профиля');
    }
}

// Включение кнопки поиска
function enableSearch() {
    if (selectedGenre) searchBtn.disabled = false;
}

// Настройка событий
function setupEvents() {
    loginBtn.onclick = () => {
        const url = `${SPOTIFY_CONFIG.authUrl}?client_id=${SPOTIFY_CONFIG.clientId}&response_type=token&redirect_uri=${encodeURIComponent(SPOTIFY_CONFIG.redirectUri)}&scope=${SPOTIFY_CONFIG.scopes.join(' ')}&show_dialog=true`;
        window.location.href = url;
    };
    
    logoutBtn.onclick = logout;
    searchBtn.onclick = searchTracks;
    closePlayerBtn.onclick = () => {
        playerPanel.style.display = 'none';
        audio.pause();
    };
}

// Выход
function logout() {
    token = null;
    localStorage.removeItem('spotify_token');
    document.getElementById('loginButton').style.display = 'block';
    userArea.style.display = 'none';
    searchBtn.disabled = true;
    trackListDiv.innerHTML = '<div class="empty-message">🎵 Авторизуйся и выбери жанр</div>';
    playerPanel.style.display = 'none';
    audio.pause();
}

// Поиск треков
async function searchTracks() {
    if (!selectedGenre) {
        alert('Выбери жанр!');
        return;
    }
    
    trackListDiv.innerHTML = '<div class="empty-message">⏳ Загрузка...</div>';
    
    try {
        const url = `${SPOTIFY_CONFIG.apiUrl}/search?q=genre:${selectedGenre}&type=track&limit=24&market=RU`;
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.status === 401) {
            logout();
            alert('Сессия истекла, войди заново');
            return;
        }
        
        const data = await res.json();
        allTracks = data.tracks.items;
        
        if (!allTracks || allTracks.length === 0) {
            trackListDiv.innerHTML = '<div class="empty-message">😔 Нет треков в этом жанре</div>';
        } else {
            renderTracks();
        }
    } catch (err) {
        trackListDiv.innerHTML = '<div class="empty-message">❌ Ошибка загрузки</div>';
    }
}

// Отображение треков
function renderTracks() {
    trackListDiv.innerHTML = allTracks.map(track => {
        const artist = track.artists.map(a => a.name).join(', ');
        const imgUrl = track.album.images?.[2]?.url || null;
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

// Воспроизведение трека
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

// Защита от XSS
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}