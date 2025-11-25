// DOM Elements
const fileInput = document.getElementById('fileInput');
const folderBtn = document.getElementById('folderBtn');
const playlist = document.getElementById('playlist');
const audio = document.getElementById('audio');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const repeatBtn = document.getElementById('repeatBtn');
const clearListBtn = document.getElementById('clearList');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearch');
const trackCount = document.getElementById('trackCount');
const totalDuration = document.getElementById('totalDuration');
const progressBar = document.getElementById('progressBar');
const progressFilled = document.getElementById('progressFilled');
const progressHandle = document.getElementById('progressHandle');
const currentTimeEl = document.getElementById('currentTime');
const totalTimeEl = document.getElementById('totalTime');
const trackTitle = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');
const trackAlbum = document.getElementById('trackAlbum');
const albumArtInner = document.getElementById('albumArtInner');
const artworkGlow = document.getElementById('artworkGlow');
const volumeSlider = document.getElementById('volumeSlider');
const volumeBtn = document.getElementById('volumeBtn');
const volumeIcon = document.getElementById('volumeIcon');
const volumeFill = document.getElementById('volumeFill');
const volumePercentage = document.getElementById('volumePercentage');
const speedControl = document.getElementById('speedControl');
const equalizerBtn = document.getElementById('equalizerBtn');
const equalizerModal = document.getElementById('equalizerModal');
const closeEqualizer = document.getElementById('closeEqualizer');
const visualizerCanvas = document.getElementById('visualizerCanvas');
const queueList = document.getElementById('queueList');
const tracksPlayed = document.getElementById('tracksPlayed');
const listeningTime = document.getElementById('listeningTime');
const filterBtns = document.querySelectorAll('.filter-btn');

// State
let tracks = [];
let currentIndex = -1;
let isPlaying = false;
let isShuffle = false;
let isRepeat = false;
let currentSort = 'default';
let audioContext = null;
let analyser = null;
let dataArray = null;
let canvasCtx = null;
let animationId = null;
let sessionTracksPlayed = 0;
let sessionListeningTime = 0;
let listeningInterval = null;

// Equalizer State
let eqFilters = [];
let currentPreset = 'flat';



// Initialize
function init() {
  loadFromLocalStorage();
  setupEventListeners();
  resizeCanvas();
  
  // Wait a bit for async loadFromLocalStorage to complete
  setTimeout(() => {
    updateStats();
    renderPlaylist();
    updateQueueDisplay();
    
    // Load saved state from localStorage only if tracks exist
    if (tracks.length > 0) {
      const savedCurrentIndex = parseInt(localStorage.getItem('currentTrackIndex') || '-1');
      const savedCurrentTime = parseFloat(localStorage.getItem('currentTrackTime') || '0');
      
      if (savedCurrentIndex >= 0 && savedCurrentIndex < tracks.length) {
        loadTrack(savedCurrentIndex);
        if (savedCurrentTime && savedCurrentTime > 0) {
          audio.currentTime = savedCurrentTime;
        }
      }
    }
    
    // Update volume display
    updateVolumeDisplay();
  }, 100);
}


// Local Storage Functions
function saveToLocalStorage() {
  try {
    // Save track data with all metadata
    const trackData = tracks.map(t => ({
      name: t.name,
      duration: t.duration,
      artist: t.artist || 'Unknown Artist',
      album: t.album || 'Unknown Album',
      coverArt: t.coverArt || null,
      url: t.url
    }));
    
    localStorage.setItem('musicPlayerTracks', JSON.stringify(trackData));
    localStorage.setItem('musicPlayerSettings', JSON.stringify({
      volume: audio.volume,
      isShuffle,
      isRepeat,
      playbackRate: audio.playbackRate
    }));
    
    console.log('Saved to localStorage:', trackData.length, 'tracks');
  } catch (e) {
    console.error('Error saving to localStorage:', e);
  }
}

function loadFromLocalStorage() {
  try {
    // Load tracks
    const trackData = JSON.parse(localStorage.getItem('musicPlayerTracks') || '[]');
    
    if (trackData.length > 0) {
      console.log('Attempting to load from localStorage:', trackData.length, 'tracks');
      
      // Check if blob URLs are still valid
      if (trackData[0] && trackData[0].url && trackData[0].url.startsWith('blob:')) {
        // Test if blob URL is still valid
        const testAudio = new Audio();
        testAudio.preload = 'metadata';
        
        testAudio.addEventListener('error', () => {
          // Blob URLs are no longer valid
          console.warn('⚠️ Audio files expired after page refresh.');
          console.info('ℹ️ Please re-add your music files using the Folder or Add buttons.');
          
          // Clear expired data
          localStorage.removeItem('musicPlayerTracks');
          localStorage.removeItem('currentTrackIndex');
          localStorage.removeItem('currentTrackTime');
          tracks = [];
          
          updateStats();
          renderPlaylist();
          updateQueueDisplay();
          
          // Optional: Show user notification
          showNotification('Audio files need to be re-added after page refresh', 'info');
        });
        
        testAudio.addEventListener('loadedmetadata', () => {
          // URLs are still valid (unlikely but possible in same session)
          tracks = trackData.map(t => ({
            ...t,
            file: null
          }));
          updateStats();
          renderPlaylist();
          updateQueueDisplay();
          console.log('✓ Successfully loaded tracks from localStorage');
        });
        
        testAudio.src = trackData[0].url;
        
      } else {
        // No valid URLs
        console.warn('No valid track URLs found.');
        localStorage.removeItem('musicPlayerTracks');
        localStorage.removeItem('currentTrackIndex');
        localStorage.removeItem('currentTrackTime');
        tracks = [];
      }
    }
    
    // Load settings (these persist correctly)
    const settings = JSON.parse(localStorage.getItem('musicPlayerSettings') || '{}');
    if (settings.volume !== undefined) {
      audio.volume = settings.volume;
      volumeSlider.value = settings.volume * 100;
      updateVolumeIcon();
    }
    if (settings.isShuffle) {
      isShuffle = true;
      shuffleBtn.classList.add('active');
    }
    if (settings.isRepeat) {
      isRepeat = true;
      repeatBtn.classList.add('active');
    }
    if (settings.playbackRate) {
      audio.playbackRate = settings.playbackRate;
      speedControl.value = settings.playbackRate;
    }
  } catch (e) {
    console.error('Error loading from localStorage:', e);
    // Clear potentially corrupted data
    localStorage.removeItem('musicPlayerTracks');
    localStorage.removeItem('currentTrackIndex');
    localStorage.removeItem('currentTrackTime');
    tracks = [];
  }
}



// Utility Functions
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ADD THIS NEW FUNCTION:
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    background: ${type === 'info' ? 'rgba(0, 217, 255, 0.95)' : 'rgba(255, 46, 99, 0.95)'};
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    font-family: 'Poppins', sans-serif;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
    max-width: 300px;
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Remove after 5 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 5000);
}

// ADD THESE ANIMATIONS TO YOUR CSS:
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);



function savePlayerState() {
  try {
    localStorage.setItem('currentTrackIndex', currentIndex.toString());
    localStorage.setItem('currentTrackTime', audio.currentTime.toString());
  } catch (e) {
    console.error('Error saving player state:', e);
  }
}

// Event Listeners
function setupEventListeners() {
  fileInput.addEventListener('change', e => {
    handleFiles(e.target.files);
    fileInput.value = '';
  });
  
  folderBtn.addEventListener('click', handleFolderSelect);
 
  
  playPauseBtn.addEventListener('click', togglePlayPause);
  prevBtn.addEventListener('click', playPrevious);
  nextBtn.addEventListener('click', playNext);
  shuffleBtn.addEventListener('click', toggleShuffle);
  repeatBtn.addEventListener('click', toggleRepeat);
  clearListBtn.addEventListener('click', clearPlaylist);
  
  progressBar.addEventListener('input', seek);
  
  volumeSlider.addEventListener('input', e => {
    audio.volume = e.target.value / 100;
    updateVolumeDisplay();
    updateVolumeIcon();
    saveToLocalStorage();
  });
  
  volumeBtn.addEventListener('click', toggleMute);
  
  speedControl.addEventListener('change', e => {
    audio.playbackRate = parseFloat(e.target.value);
    saveToLocalStorage();
  });
  
  equalizerBtn.addEventListener('click', () => {
    equalizerModal.classList.add('active');
  });
  
  closeEqualizer.addEventListener('click', () => {
    equalizerModal.classList.remove('active');
  });
  
  equalizerModal.addEventListener('click', e => {
    if (e.target === equalizerModal) {
      equalizerModal.classList.remove('active');
    }
  });
  
  searchInput.addEventListener('input', handleSearch);
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    handleSearch();
  });
  
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSort = btn.dataset.sort;
      renderPlaylist();
    });
  });
  
  audio.addEventListener('timeupdate', updateProgress);
  audio.addEventListener('loadedmetadata', onLoadedMetadata);
  audio.addEventListener('ended', onTrackEnded);
  audio.addEventListener('play', () => {
    isPlaying = true;
    updatePlayPauseButton();
    startVisualizer();
    startListeningTimer();
    
    // Register media session
    registerMediaSession();
  });
  audio.addEventListener('pause', () => {
    isPlaying = false;
    updatePlayPauseButton();
    stopVisualizer();
    stopListeningTimer();
  });
  
  document.addEventListener('keydown', handleKeyboard);
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('beforeunload', () => {
    savePlayerState();
    saveToLocalStorage();
  });
  
  // Auto-save every 10 seconds
  setInterval(() => {
    if (tracks.length > 0) {
      savePlayerState();
    }
  }, 10000);
}

// File Handling
async function handleFolderSelect() {
  try {
    const dirHandle = await window.showDirectoryPicker();
    const files = [];
    
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file') {
        const file = await entry.getFile();
        if (file.type.startsWith('audio/')) {
          files.push(file);
        }
      }
    }
    
    if (files.length > 0) {
      handleFiles(files);
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Folder access error:', err);
    }
  }
}

function handleFiles(fileList) {
  const audioFiles = Array.from(fileList).filter(f => f.type.startsWith('audio/'));
  if (audioFiles.length === 0) return;
  
  let processed = 0;
  const newTracks = [];
  
  audioFiles.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    const tempAudio = document.createElement('audio');
    tempAudio.preload = 'metadata';
    tempAudio.src = url;
    
    tempAudio.addEventListener('loadedmetadata', () => {
      const track = {
        file,
        url,
        name: file.name.replace(/\.[^/.]+$/, ''),
        duration: tempAudio.duration,
        artist: 'Unknown Artist',
        album: 'Unknown Album',
        coverArt: null
      };
      
      newTracks.push(track);
      processed++;
      
      // Try to read ID3 tags
      if (window.jsmediatags) {
        jsmediatags.read(file, {
          onSuccess: tag => {
            track.artist = tag.tags.artist || 'Unknown Artist';
            track.album = tag.tags.album || 'Unknown Album';
            
            const picture = tag.tags.picture;
            if (picture) {
              const base64 = btoa(
                picture.data.reduce((data, byte) => data + String.fromCharCode(byte), '')
              );
              track.coverArt = `data:${picture.format};base64,${base64}`;
            }
            
            if (processed === audioFiles.length) {
              finishLoadingFiles(newTracks);
            }
          },
          onError: () => {
            if (processed === audioFiles.length) {
              finishLoadingFiles(newTracks);
            }
          }
        });
      } else {
        if (processed === audioFiles.length) {
          finishLoadingFiles(newTracks);
        }
      }
    });
  });
}

function finishLoadingFiles(newTracks) {
  tracks = [...tracks, ...newTracks];
  saveToLocalStorage();
  updateStats();
  renderPlaylist();
  updateQueueDisplay();
  
  if (currentIndex === -1 && tracks.length > 0) {
    loadTrack(0);
  }
  
  lucide.createIcons();
}

// Playlist Rendering
function renderPlaylist() {
  const searchTerm = searchInput.value.toLowerCase();
  let filtered = searchTerm 
    ? tracks.filter(t => 
        t.name.toLowerCase().includes(searchTerm) ||
        t.artist.toLowerCase().includes(searchTerm) ||
        t.album.toLowerCase().includes(searchTerm)
      )
    : [...tracks];
  
  // Sort - FIXED LOGIC
  if (currentSort === 'name') {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  } else if (currentSort === 'duration') {
    filtered.sort((a, b) => (b.duration || 0) - (a.duration || 0));
  }
  // If currentSort === 'default', keep original order (no sorting)
  
  playlist.innerHTML = '';
  
  if (filtered.length === 0) {
    playlist.innerHTML = `
      <li style="text-align:center;color:var(--text-muted);padding:40px 20px;border:none;background:transparent;cursor:default;">
        <i data-lucide="music-off" style="width:48px;height:48px;margin:0 auto 12px;opacity:0.5;"></i>
        <p style="font-size:14px;font-weight:500;">No tracks found</p>
      </li>
    `;
    lucide.createIcons();
    return;
  }
  
  filtered.forEach((track, idx) => {
    const li = document.createElement('li');
    
    // FIXED: Find actual index in original tracks array
    const actualIndex = tracks.findIndex(t => t.url === track.url);
    
    if (actualIndex === currentIndex) {
      li.classList.add('active');
    }
    
    li.innerHTML = `
      <div class="track-number">
        ${actualIndex === currentIndex ? '<i data-lucide="play"></i>' : (actualIndex + 1)}
      </div>
      <div class="track-info">
        <div class="track-name">${track.name}</div>
        <div class="track-time">${track.artist} • ${formatTime(track.duration)}</div>
      </div>
    `;
    
    li.addEventListener('click', () => {
      loadTrack(actualIndex);
      play();
    });
    
    playlist.appendChild(li);
  });
  
  lucide.createIcons();
  clearSearchBtn.classList.toggle('show', searchTerm.length > 0);
}


function updateStats() {
  const total = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
  trackCount.textContent = tracks.length.toString();
  totalDuration.textContent = formatTime(total);
}

// Track Loading
function loadTrack(index) {
  if (index < 0 || index >= tracks.length) return;
  
  currentIndex = index;
  const track = tracks[index];
  
  audio.src = track.url;
  trackTitle.textContent = track.name;
  trackArtist.textContent = track.artist;
  trackAlbum.textContent = track.album || '';
  
  // Update album art
  if (track.coverArt) {
    albumArtInner.innerHTML = `<img src="${track.coverArt}" alt="Album Art" />`;
    artworkGlow.style.background = `url(${track.coverArt}) center/cover`;
    artworkGlow.classList.add('active');
  } else {
    albumArtInner.innerHTML = `
      <div class="default-artwork">
        <i data-lucide="music" class="default-music-icon"></i>
      </div>
    `;
    artworkGlow.classList.remove('active');
  }
  
  renderPlaylist();
  updateQueueDisplay();
  savePlayerState();
  lucide.createIcons();
}

// Playback Controls
function togglePlayPause() {
  if (!audio.src && tracks.length > 0) {
    loadTrack(0);
    play();
  } else if (audio.src) {
    isPlaying ? pause() : play();
  }
}

function play() {
  if (!audioContext) {
    initAudioContext();
  }
  
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  
  audio.play();
  albumArtInner.classList.add('playing');
}

function pause() {
  audio.pause();
  albumArtInner.classList.remove('playing');
}

function playNext() {
  if (tracks.length === 0) return;
  
  let nextIndex;
  if (isShuffle) {
    nextIndex = Math.floor(Math.random() * tracks.length);
    while (nextIndex === currentIndex && tracks.length > 1) {
      nextIndex = Math.floor(Math.random() * tracks.length);
    }
  } else {
    nextIndex = currentIndex + 1;
    if (nextIndex >= tracks.length) {
      nextIndex = isRepeat ? 0 : currentIndex;
      if (!isRepeat) {
        pause();
        return;
      }
    }
  }
  
  loadTrack(nextIndex);
  play();
}

function playPrevious() {
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  
  let prevIndex = currentIndex - 1;
  if (prevIndex < 0) {
    prevIndex = tracks.length - 1;
  }
  
  loadTrack(prevIndex);
  play();
}

function toggleShuffle() {
  isShuffle = !isShuffle;
  shuffleBtn.classList.toggle('active', isShuffle);
  saveToLocalStorage();
}

function toggleRepeat() {
  isRepeat = !isRepeat;
  repeatBtn.classList.toggle('active', isRepeat);
  saveToLocalStorage();
}

function clearPlaylist() {
  if (tracks.length === 0) return;
  
  if (!confirm('Clear all tracks from playlist? This action cannot be undone.')) return;
  
  tracks.forEach(t => {
    if (t.url) URL.revokeObjectURL(t.url);
  });
  tracks = [];
  currentIndex = -1;
  
  pause();
  audio.src = '';
  
  trackTitle.textContent = 'No Track Selected';
  trackArtist.textContent = 'Select a track to begin';
  trackAlbum.textContent = '';
  
  albumArtInner.innerHTML = `
    <div class="default-artwork">
      <i data-lucide="music" class="default-music-icon"></i>
    </div>
  `;
  artworkGlow.classList.remove('active');
  albumArtInner.classList.remove('playing');
  
  localStorage.removeItem('musicPlayerTracks');
  localStorage.removeItem('currentTrackIndex');
  localStorage.removeItem('currentTrackTime');
  
  updateStats();
  renderPlaylist();
  updateQueueDisplay();
  lucide.createIcons();
}

// Progress & Time
function updateProgress() {
  if (!audio.duration) return;
  
  const percent = (audio.currentTime / audio.duration) * 100;
  progressBar.value = percent;
  progressFilled.style.width = `${percent}%`;
  progressHandle.style.left = `${percent}%`;
  
  currentTimeEl.textContent = formatTime(audio.currentTime);
}

function seek() {
  if (!audio.duration) return;
  
  const seekTime = (progressBar.value / 100) * audio.duration;
  audio.currentTime = seekTime;
}

function onLoadedMetadata() {
  totalTimeEl.textContent = formatTime(audio.duration);
}

function onTrackEnded() {
  sessionTracksPlayed++;
  updateSessionStats();
  
  if (isRepeat) {
    audio.currentTime = 0;
    play();
  } else {
    playNext();
  }
}

function updatePlayPauseButton() {
  const icon = playPauseBtn.querySelector('i');
  if (icon) {
    icon.setAttribute('data-lucide', isPlaying ? 'pause' : 'play');
    lucide.createIcons();
  }
}

// Volume
function updateVolumeDisplay() {
  const vol = Math.round(audio.volume * 100);
  volumeFill.style.width = `${vol}%`;
  volumePercentage.textContent = `${vol}%`;
}

function updateVolumeIcon() {
  const vol = audio.volume;
  let iconName = 'volume-2';
  
  if (vol === 0) {
    iconName = 'volume-x';
  } else if (vol < 0.5) {
    iconName = 'volume-1';
  }
  
  volumeIcon.setAttribute('data-lucide', iconName);
  lucide.createIcons();
}

function toggleMute() {
  if (audio.volume > 0) {
    audio.dataset.prevVolume = audio.volume;
    audio.volume = 0;
    volumeSlider.value = 0;
  } else {
    const prevVol = parseFloat(audio.dataset.prevVolume || '0.8');
    audio.volume = prevVol;
    volumeSlider.value = prevVol * 100;
  }
  
  updateVolumeDisplay();
  updateVolumeIcon();
  saveToLocalStorage();
}

// Search
function handleSearch() {
  renderPlaylist();
}

// Queue Display
function updateQueueDisplay() {
  if (currentIndex === -1 || tracks.length === 0) {
    queueList.innerHTML = `
      <div class="queue-empty-state">
        <i data-lucide="list-x" class="empty-icon"></i>
        <p>No upcoming tracks</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }
  
  const upNext = [];
  for (let i = 1; i <= 5; i++) {
    const nextIdx = (currentIndex + i) % tracks.length;
    if (tracks[nextIdx]) {
      upNext.push(tracks[nextIdx]);
    }
  }
  
  if (upNext.length === 0) {
    queueList.innerHTML = `
      <div class="queue-empty-state">
        <i data-lucide="list-x" class="empty-icon"></i>
        <p>No upcoming tracks</p>
      </div>
    `;
  } else {
    queueList.innerHTML = upNext.map((track, idx) => `
      <div class="stat-item" style="cursor:pointer;" onclick="playFromQueue(${tracks.indexOf(track)})">
        <i data-lucide="music"></i>
        <div class="stat-content">
          <span class="stat-label">${track.name.substring(0, 25)}${track.name.length > 25 ? '...' : ''}</span>
          <span class="stat-value">${formatTime(track.duration)}</span>
        </div>
      </div>
    `).join('');
  }
  
  lucide.createIcons();
}

window.playFromQueue = function(index) {
  loadTrack(index);
  play();
};

// Session Stats
function startListeningTimer() {
  if (listeningInterval) return;
  
  listeningInterval = setInterval(() => {
    sessionListeningTime++;
    updateSessionStats();
  }, 1000);
}

function stopListeningTimer() {
  if (listeningInterval) {
    clearInterval(listeningInterval);
    listeningInterval = null;
  }
}

function updateSessionStats() {
  tracksPlayed.textContent = sessionTracksPlayed.toString();
  
  const minutes = Math.floor(sessionListeningTime / 60);
  const seconds = sessionListeningTime % 60;
  listeningTime.textContent = `${minutes}m ${seconds}s`;
}

// Media Session API (for mobile notifications)
function registerMediaSession() {
  if ('mediaSession' in navigator && currentIndex >= 0) {
    const track = tracks[currentIndex];
    
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.name,
      artist: track.artist,
      album: track.album,
      artwork: track.coverArt ? [
        { src: track.coverArt, sizes: '512x512', type: 'image/jpeg' }
      ] : []
    });
    
    navigator.mediaSession.setActionHandler('play', () => play());
    navigator.mediaSession.setActionHandler('pause', () => pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => playPrevious());
    navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime) {
        audio.currentTime = details.seekTime;
      }
    });
  }
}

// Visualizer
function initAudioContext() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  const source = audioContext.createMediaElementSource(audio);
  
  // Create equalizer filters
  const frequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
  
  frequencies.forEach(freq => {
    const filter = audioContext.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.value = freq;
    filter.Q.value = 1;
    filter.gain.value = 0;
    eqFilters.push(filter);
  });
  
  // Connect audio chain: source -> filters -> analyser -> destination
  source.connect(eqFilters[0]);
  
  for (let i = 0; i < eqFilters.length - 1; i++) {
    eqFilters[i].connect(eqFilters[i + 1]);
  }
  
  eqFilters[eqFilters.length - 1].connect(analyser);
  analyser.connect(audioContext.destination);
  
  analyser.fftSize = 256;
  dataArray = new Uint8Array(analyser.frequencyBinCount);
  canvasCtx = visualizerCanvas.getContext('2d');
  
  // Initialize equalizer UI
  initEqualizerUI();
}



function setupEQPresets() {
  const presetButtons = document.querySelectorAll('.eq-preset-btn');
  
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      applyEQPreset(preset);
      
      // Update active button
      presetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      currentPreset = preset;
    });
  });
}


function applyEQPreset(preset) {
  const presets = {
    flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    pop: [1, 3, 5, 4, 2, 0, -1, -1, 1, 2],
    rock: [5, 3, 1, 0, -1, 1, 3, 4, 5, 5],
    jazz: [4, 3, 1, 2, -1, -1, 0, 2, 3, 4],
    classical: [5, 4, 3, 2, -1, -1, 0, 2, 3, 4]
  };
  
  const values = presets[preset] || presets.flat;
  
  values.forEach((value, index) => {
    if (eqFilters[index]) {
      eqFilters[index].gain.value = value;
    }
    
    // Update UI sliders
    const slider = document.querySelector(`.eq-slider[data-index="${index}"]`);
    const valueDisplay = slider?.parentElement.querySelector('.eq-value');
    
    if (slider) {
      slider.value = value;
      if (valueDisplay) {
        valueDisplay.textContent = `${value > 0 ? '+' : ''}${value.toFixed(1)}dB`;
      }
    }
  });
}


// Add touch support for better mobile experience
function enhanceEQMobileSupport() {
  const sliders = document.querySelectorAll('.eq-slider');
  
  sliders.forEach(slider => {
    // Prevent default touch behavior for better control
    slider.addEventListener('touchstart', (e) => {
      e.stopPropagation();
    }, { passive: true });
    
    slider.addEventListener('touchmove', (e) => {
      e.stopPropagation();
    }, { passive: true });
  });
}


function initEqualizerUI() {
  const eqSliders = document.getElementById('eqSliders');
  const frequencies = ['60Hz', '170Hz', '310Hz', '600Hz', '1kHz', '3kHz', '6kHz', '12kHz', '14kHz', '16kHz'];
  
  eqSliders.innerHTML = '';
  
  frequencies.forEach((freq, index) => {
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'eq-slider-container';
    sliderContainer.innerHTML = `
      <input 
        type="range" 
        class="eq-slider" 
        min="-12" 
        max="12" 
        value="0" 
        step="0.1" 
        data-index="${index}"
        orient="vertical"
      />
      <span class="eq-value">0dB</span>
      <span class="eq-label">${freq}</span>
    `;
    
    eqSliders.appendChild(sliderContainer);
    
    // Add event listener
    const slider = sliderContainer.querySelector('.eq-slider');
    const valueDisplay = sliderContainer.querySelector('.eq-value');
    
    slider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      valueDisplay.textContent = `${value > 0 ? '+' : ''}${value.toFixed(1)}dB`;
      
      if (eqFilters[index]) {
        eqFilters[index].gain.value = value;
      }
      
      // Update preset to custom if user adjusts manually
      if (currentPreset !== 'custom') {
        currentPreset = 'custom';
        document.querySelectorAll('.eq-preset-btn').forEach(btn => {
          btn.classList.remove('active');
        });
      }
    });
  });
  
// Setup preset buttons
  setupEQPresets();
  
  // Enhance mobile support
  enhanceEQMobileSupport();
}

function startVisualizer() {
  if (!analyser) return;
  drawVisualizer();
}

function stopVisualizer() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

function drawVisualizer() {
  animationId = requestAnimationFrame(drawVisualizer);
  
  if (!analyser || !canvasCtx) return;
  
  analyser.getByteFrequencyData(dataArray);
  
  const width = visualizerCanvas.width;
  const height = visualizerCanvas.height;
  
  canvasCtx.fillStyle = 'rgba(10, 14, 39, 0.2)';
  canvasCtx.fillRect(0, 0, width, height);
  
  const barWidth = (width / dataArray.length) * 2.5;
  let x = 0;
  
  for (let i = 0; i < dataArray.length; i++) {
    const barHeight = (dataArray[i] / 255) * height * 0.9;
    
    // Create gradient for each bar
    const gradient = canvasCtx.createLinearGradient(0, height - barHeight, 0, height);
    gradient.addColorStop(0, '#00d9ff');
    gradient.addColorStop(0.5, '#7b2ff7');
    gradient.addColorStop(1, '#ff2e63');
    
    canvasCtx.fillStyle = gradient;
    canvasCtx.fillRect(x, height - barHeight, barWidth - 2, barHeight);
    
    x += barWidth;
  }
}

function resizeCanvas() {
  visualizerCanvas.width = visualizerCanvas.offsetWidth;
  visualizerCanvas.height = visualizerCanvas.offsetHeight;
}

// Keyboard Shortcuts
function handleKeyboard(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  
  switch (e.code) {
    case 'Space':
      e.preventDefault();
      togglePlayPause();
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (e.shiftKey) {
        audio.currentTime = Math.min(audio.duration, audio.currentTime + 10);
      } else {
        playNext();
      }
      break;
    case 'ArrowLeft':
      e.preventDefault();
      if (e.shiftKey) {
        audio.currentTime = Math.max(0, audio.currentTime - 10);
      } else {
        playPrevious();
      }
      break;
    case 'ArrowUp':
      e.preventDefault();
      audio.volume = Math.min(1, audio.volume + 0.1);
      volumeSlider.value = audio.volume * 100;
      updateVolumeDisplay();
      updateVolumeIcon();
      saveToLocalStorage();
      break;
    case 'ArrowDown':
      e.preventDefault();
      audio.volume = Math.max(0, audio.volume - 0.1);
      volumeSlider.value = audio.volume * 100;
      updateVolumeDisplay();
      updateVolumeIcon();
      saveToLocalStorage();
      break;
    case 'KeyM':
      e.preventDefault();
      toggleMute();
      break;
    case 'KeyS':
      e.preventDefault();
      toggleShuffle();
      break;
    case 'KeyR':
      e.preventDefault();
      toggleRepeat();
      break;
  }
}

// Utility Functions
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Initialize on load
window.addEventListener('load', init);