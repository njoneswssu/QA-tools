// API base URL
const API_BASE = '';

// State
let games = [];
let loading = false;
let currentSport = 'NBA'; // Default to NBA
let searchSuggestions = [];
let searchTimeout = null;

// Initialize - load all saved data first
document.addEventListener('DOMContentLoaded', async () => {
    // Set current sport from filter dropdown
    const sportFilter = document.getElementById('sportFilter');
    currentSport = sportFilter.value || 'NBA';
    
    // Load games and stats immediately on page load
    await loadGames();
    await loadStats();
    
    // Sport filter
    sportFilter.addEventListener('change', (e) => {
        currentSport = e.target.value || '';
        loadGames();
        loadStats();
    });
    
    // Player search with autocomplete
    const searchInput = document.getElementById('playerSearchInput');
    const searchBtn = document.getElementById('playerSearchBtn');
    
    searchBtn.addEventListener('click', () => {
        searchPlayer();
    });
    
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchPlayer();
        }
    });
    
    // Autocomplete on input
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (query.length >= 3) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadSearchSuggestions(query);
            }, 300);
        } else {
            hideSuggestions();
        }
    });
    
    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.player-search')) {
            hideSuggestions();
        }
    });
    
    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', () => {
        refreshData();
    });
    
    // Modal close
    document.getElementById('closeModal').addEventListener('click', () => {
        closePlayerModal();
    });
    
    // Close modal on outside click
    document.getElementById('playerModal').addEventListener('click', (e) => {
        if (e.target.id === 'playerModal') {
            closePlayerModal();
        }
    });
    
    // Auto-refresh every 5 minutes
    setInterval(() => {
        loadGames();
        loadStats();
    }, 300000);
});

async function loadGames() {
    showLoading();
    try {
        const url = currentSport 
            ? `${API_BASE}/api/games?sport=${encodeURIComponent(currentSport)}`
            : `${API_BASE}/api/games`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load games');
        
        games = await response.json();
        renderGames();
    } catch (error) {
        console.error('Error loading games:', error);
        showError('Failed to load games. Please try again.');
    } finally {
        hideLoading();
    }
}

async function loadStats() {
    try {
        const url = currentSport 
            ? `${API_BASE}/api/stats?sport=${encodeURIComponent(currentSport)}`
            : `${API_BASE}/api/stats`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load stats');
        
        const stats = await response.json();
        document.getElementById('gameCount').textContent = stats.upcoming_games || 0;
        document.getElementById('lineCount').textContent = stats.total_lines || 0;
        document.getElementById('projectionCount').textContent = stats.total_projections || 0;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function searchPlayer() {
    const playerName = document.getElementById('playerSearchInput').value.trim();
    const sport = document.getElementById('sportFilter').value || 'NBA';
    
    if (!playerName) {
        alert('Please enter a player name');
        return;
    }
    
    showLoading();
    try {
        const response = await fetch(`${API_BASE}/api/players/search?name=${encodeURIComponent(playerName)}&sport=${encodeURIComponent(sport)}`);
        if (!response.ok) throw new Error('Failed to search player');
        
        const playerData = await response.json();
        playerData.sport = sport; // Add sport to player data for display
        showPlayerSearchResults(playerData);
    } catch (error) {
        console.error('Error searching player:', error);
        alert('Failed to search for player. Please try again.');
    } finally {
        hideLoading();
    }
}

function showPlayerSearchResults(playerData) {
    const modal = document.getElementById('playerModal');
    const modalName = document.getElementById('modalPlayerName');
    const modalContent = document.getElementById('modalContent');
    
    modalName.textContent = playerData.name || 'Player Not Found';
    modalContent.innerHTML = '';
    
    if (playerData.error) {
        modalContent.innerHTML = `<p style="color: red;">Error: ${escapeHtml(playerData.error)}</p>`;
        modal.classList.add('active');
        return;
    }
    
    let html = '';
    
    if (playerData.position || playerData.team) {
        html += `<div class="player-info">
            ${playerData.position ? `<span><strong>Position:</strong> ${escapeHtml(playerData.position)}</span>` : ''}
            ${playerData.team ? `<span><strong>Team:</strong> ${escapeHtml(playerData.team)}</span>` : ''}
            ${playerData.sport ? `<span><strong>Sport:</strong> ${escapeHtml(playerData.sport)}</span>` : ''}
        </div>`;
    }
    
    if (Object.keys(playerData.seasonStats || {}).length > 0) {
        html += `<h3>Season Statistics</h3>
        <div class="season-stats">`;
        for (const [stat, value] of Object.entries(playerData.seasonStats)) {
            html += `<div class="stat-item">
                <div class="stat-label">${escapeHtml(stat)}</div>
                <div class="stat-value">${value}</div>
            </div>`;
        }
        html += `</div>`;
    }
    
    if (playerData.recentGames && playerData.recentGames.length > 0) {
        html += `<h3>Recent Games</h3>
        <table class="recent-games-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Opponent</th>
                    ${playerData.sport === 'NFL' ? `
                        <th>Pass Yds</th>
                        <th>Rush Yds</th>
                        <th>TDs</th>
                    ` : `
                        <th>Points</th>
                        <th>Rebounds</th>
                        <th>Assists</th>
                        <th>Minutes</th>
                    `}
                </tr>
            </thead>
            <tbody>`;
        
        playerData.recentGames.forEach(game => {
            html += `<tr>`;
            html += `<td>${escapeHtml(game.date || 'N/A')}</td>`;
            html += `<td>${escapeHtml(game.opponent || 'N/A')}</td>`;
            
            if (playerData.sport === 'NFL') {
                html += `<td>${game.passingYards || 0}</td>`;
                html += `<td>${game.rushingYards || 0}</td>`;
                html += `<td>${game.touchdowns || 0}</td>`;
            } else {
                html += `<td>${game.points || 0}</td>`;
                html += `<td>${game.rebounds || 0}</td>`;
                html += `<td>${game.assists || 0}</td>`;
                html += `<td>${game.minutes || 'N/A'}</td>`;
            }
            
            html += `</tr>`;
        });
        
        html += `</tbody></table>`;
    } else {
        html += `<p>No recent game data available.</p>`;
    }
    
    modalContent.innerHTML = html;
    modal.classList.add('active');
}

async function refreshData() {
    showLoading();
    const btn = document.getElementById('refreshBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Scraping...';
    
    try {
        // Get selected sports from checkboxes
        const checkboxes = document.querySelectorAll('.sport-checkboxes input[type="checkbox"]:checked');
        const sportsToScrape = Array.from(checkboxes).map(cb => cb.value);
        
        if (sportsToScrape.length === 0) {
            alert('Please select at least one sport to scrape');
            btn.disabled = false;
            btn.textContent = '🔄 Refresh Data';
            hideLoading();
            return;
        }
        
        const response = await fetch(`${API_BASE}/api/scrape`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                source: 'all',
                sports: sportsToScrape
            })
        });
        
        if (!response.ok) throw new Error('Scrape failed');
        
        // Wait a bit for data to be processed
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        await loadGames();
        await loadStats();
        
        alert(`✅ Data refreshed successfully for ${sportsToScrape.join(', ')}!`);
    } catch (error) {
        console.error('Error refreshing data:', error);
        alert('❌ Failed to refresh data. Please try again.');
    } finally {
        btn.disabled = false;
        btn.textContent = '🔄 Refresh Data';
        hideLoading();
    }
}

function renderGames() {
    const container = document.getElementById('gamesContainer');
    
    if (games.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h2>No games scheduled</h2>
                <p>Click "Refresh Data" to scrape current games from ESPN</p>
            </div>
        `;
        return;
    }
    
    // Render games - collapsible cards that start collapsed
    container.innerHTML = games.map(game => `
        <div class="game-card collapsed" data-game-id="${game.id}">
            <div class="game-header">
                <div class="game-header-main clickable" onclick="viewGameDetails(${game.id})">
                    <div>
                        <div class="game-teams">
                            <span>${escapeHtml(game.away_team)}</span>
                            <span class="vs">vs</span>
                            <span>${escapeHtml(game.home_team)}</span>
                        </div>
                        <div class="game-date">
                            ${formatDate(game.game_date)} ${game.game_time ? `• ${game.game_time}` : ''}
                        </div>
                    </div>
                    <div class="game-time">${game.status || 'Scheduled'}</div>
                </div>
                <button class="btn-toggle-players" onclick="event.stopPropagation(); toggleGameCard(${game.id})" data-game-id="${game.id}">
                    <span class="toggle-text">Show Players</span>
                    <span class="collapse-icon">▼</span>
                </button>
            </div>
            
            <div class="game-content" style="display: none;">
                <div class="game-summary">
                    ${game.player_count > 0 ? `
                        <div class="player-count">${game.player_count} players</div>
                    ` : '<div class="empty-state"><p>No players found. Click "Refresh Data" to scrape.</p></div>'}
                </div>
                
                <div class="players-container-${game.id}">
                    ${renderPlayersSync(game)}
                </div>
            </div>
        </div>
    `).join('');
    
    // Load players for all games immediately (even if collapsed)
    games.forEach(game => {
        loadGamePlayers(game);
    });
}

async function renderPlayersSync(game) {
    // Synchronous version that shows what we have immediately
    // Just show loading state - actual data will be loaded by loadGamePlayers
    return '<div class="empty-state"><p>Loading players...</p></div>';
}

async function loadGamePlayers(game) {
    try {
        console.log(`Loading players for game ${game.id}: ${game.away_team} @ ${game.home_team}`);
        const container = document.querySelector(`.players-container-${game.id}`);
        if (!container) {
            console.warn(`Container not found for game ${game.id}`);
            return;
        }
        
        // Show loading state
        if (container.innerHTML.includes('Loading') || container.innerHTML.trim() === '' || container.innerHTML.includes('empty-state')) {
            container.innerHTML = '<div class="empty-state"><p>Loading players...</p></div>';
        }
        
        const response = await fetch(`${API_BASE}/api/games/${game.id}/players`);
        if (!response.ok) {
            throw new Error(`Failed to load players: ${response.statusText}`);
        }
        
        const players = await response.json();
        console.log(`Found ${players.length} players for game ${game.id}`);
        
        if (players.length > 0) {
            const playerMap = new Map();
            
            // Add players from database first
            players.forEach(player => {
                if (!playerMap.has(player.player_name)) {
                    playerMap.set(player.player_name, {
                        projections: [],
                        lines: [],
                        seasonStats: {
                            points: player.season_points !== null && player.season_points !== undefined ? parseFloat(player.season_points) : 0,
                            rebounds: player.season_rebounds !== null && player.season_rebounds !== undefined ? parseFloat(player.season_rebounds) : 0,
                            assists: player.season_assists !== null && player.season_assists !== undefined ? parseFloat(player.season_assists) : 0
                        },
                        team: player.team
                    });
                } else {
                    // Update existing player with season stats
                    const existing = playerMap.get(player.player_name);
                    if (player.season_points !== null && player.season_points !== undefined) {
                        existing.seasonStats.points = parseFloat(player.season_points);
                    }
                    if (player.season_rebounds !== null && player.season_rebounds !== undefined) {
                        existing.seasonStats.rebounds = parseFloat(player.season_rebounds);
                    }
                    if (player.season_assists !== null && player.season_assists !== undefined) {
                        existing.seasonStats.assists = parseFloat(player.season_assists);
                    }
                    existing.team = player.team || existing.team;
                }
            });
            
            // Only add projections for players that are actually in this game
            const playerNames = new Set(players.map(p => p.player_name));
            (game.projections || []).forEach(proj => {
                if (playerNames.has(proj.player)) {
                    if (!playerMap.has(proj.player)) {
                        playerMap.set(proj.player, { projections: [], lines: [], seasonStats: {}, team: '' });
                    }
                    const existing = playerMap.get(proj.player);
                    // Only add if we don't already have this stat_type
                    const hasStatType = existing.projections.some(p => p.stat_type === proj.stat_type);
                    if (!hasStatType) {
                        existing.projections.push(proj);
                    }
                }
            });
            
            container.innerHTML = renderPlayersHTML(playerMap);
            console.log(`Rendered ${playerMap.size} players for game ${game.id}`);
            
            // Attach player name click handlers
            container.querySelectorAll('.player-name').forEach(el => {
                el.style.cursor = 'pointer';
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const playerName = el.textContent.trim();
                    showPlayerModal(playerName);
                });
            });
        } else {
            console.log(`No players found for game ${game.id}`);
            container.innerHTML = '<div class="empty-state"><p>No players found. Click "Refresh Data" to scrape player rosters.</p></div>';
        }
    } catch (error) {
        console.error(`Error loading players for game ${game.id}:`, error);
        const container = document.querySelector(`.players-container-${game.id}`);
        if (container) {
            container.innerHTML = `<div class="empty-state"><p>Error loading players: ${error.message}</p></div>`;
        }
    }
}

function renderPlayersHTML(playerMap) {
    if (playerMap.size === 0) {
        return '<div class="empty-state"><p>No player data available. Click "Refresh Data" to scrape.</p></div>';
    }
    
    return `
        <div class="players-section">
            ${Array.from(playerMap.entries()).map(([playerName, data]) => `
                <div class="player-card">
                    <div class="player-header">
                        <span class="player-name">${escapeHtml(playerName)}</span>
                        ${data.team ? `<span class="player-team">${escapeHtml(data.team)}</span>` : ''}
                    </div>
                    <div class="season-stats-preview">
                        <span class="stat-badge">PTS: ${(data.seasonStats?.points ?? 0).toFixed(1)}</span>
                        <span class="stat-badge">REB: ${(data.seasonStats?.rebounds ?? 0).toFixed(1)}</span>
                        <span class="stat-badge">AST: ${(data.seasonStats?.assists ?? 0).toFixed(1)}</span>
                    </div>
                    ${data.projections && data.projections.length > 0 ? `
                        <div class="stats-grid">
                            ${renderPlayerProjections(data.projections)}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `;
}


function renderPlayerProjections(projections) {
    if (projections.length === 0) {
        return '<div class="empty-state"><p>No projections available</p></div>';
    }
    
    // Deduplicate by stat_type (only show one projection per stat type)
    const uniqueProjections = [];
    const seenStats = new Set();
    
    projections.forEach(proj => {
        if (!seenStats.has(proj.stat_type)) {
            seenStats.add(proj.stat_type);
            uniqueProjections.push(proj);
        }
    });
    
    // Show in compact inline format
    return `
        <div class="projections-compact">
            ${uniqueProjections.map(proj => {
                const conf = proj.confidence || 0.5;
                const confClass = conf >= 0.7 ? 'confidence-high' : conf >= 0.5 ? 'confidence-medium' : 'confidence-low';
                const statLabel = proj.stat_type.charAt(0).toUpperCase() + proj.stat_type.slice(1);
                
                return `
                    <div class="projection-compact-item">
                        <span class="projection-stat">${statLabel}</span>
                        <span class="projection-value">${parseFloat(proj.projection).toFixed(1)}</span>
                        <span class="confidence-badge-small ${confClass}">${(conf * 100).toFixed(0)}%</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

async function showPlayerModal(playerName) {
    const modal = document.getElementById('playerModal');
    const modalContent = document.getElementById('modalContent');
    const modalPlayerName = document.getElementById('modalPlayerName');
    
    modalPlayerName.textContent = playerName;
    modalContent.innerHTML = '<div class="spinner"></div><p>Loading player data...</p>';
    modal.classList.add('active');
    
    try {
        const response = await fetch(`${API_BASE}/api/players/${encodeURIComponent(playerName)}/details`);
        if (!response.ok) throw new Error('Failed to fetch player details');
        
        const playerData = await response.json();
        
        // Render player details
        modalContent.innerHTML = renderPlayerDetails(playerData);
        
        // Create chart for averages (wait a bit for DOM to update)
        setTimeout(() => createPlayerChart(playerData), 100);
    } catch (error) {
        console.error('Error loading player details:', error);
        modalContent.innerHTML = `<p class="error">Error loading player data: ${error.message}</p>`;
    }
}

function renderPlayerDetails(playerData) {
    const { seasonAverages, recentGames, averages, projections } = playerData;
    
    return `
        <div class="player-details">
            <div class="player-stats-grid">
                <div class="stat-card">
                    <div class="stat-label">Season Average</div>
                    <div class="stat-value">${(seasonAverages.points || 0).toFixed(1)} PTS</div>
                    <div class="stat-value">${(seasonAverages.rebounds || 0).toFixed(1)} REB</div>
                    <div class="stat-value">${(seasonAverages.assists || 0).toFixed(1)} AST</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Recent Average (${averages.games} games)</div>
                    <div class="stat-value">${averages.points.toFixed(1)} PTS</div>
                    <div class="stat-value">${averages.rebounds.toFixed(1)} REB</div>
                    <div class="stat-value">${averages.assists.toFixed(1)} AST</div>
                </div>
            </div>
            
            <div class="chart-container">
                <canvas id="playerChart"></canvas>
            </div>
            
            <div class="recent-games-section">
                <h3>Recent Games</h3>
                <div class="games-list">
                    ${recentGames.length > 0 ? recentGames.map(game => `
                        <div class="game-result">
                            <div class="game-date">${formatDate(game.date)}</div>
                            <div class="game-opponent">vs ${escapeHtml(game.opponent || 'N/A')}</div>
                            <div class="game-stats">
                                <span>${game.points} PTS</span>
                                <span>${game.rebounds} REB</span>
                                <span>${game.assists} AST</span>
                            </div>
                        </div>
                    `).join('') : '<p>No recent games found</p>'}
                </div>
            </div>
            
            ${projections.length > 0 ? `
                <div class="upcoming-projections">
                    <h3>Upcoming Projections</h3>
                    ${projections.map(proj => `
                        <div class="projection-item">
                            <div class="projection-game">${escapeHtml(proj.away_team)} @ ${escapeHtml(proj.home_team)}</div>
                            <div class="projection-stats">
                                <span>${proj.stat_type}: ${parseFloat(proj.projection).toFixed(1)}</span>
                                <span class="confidence-badge ${proj.confidence >= 0.7 ? 'confidence-high' : proj.confidence >= 0.5 ? 'confidence-medium' : 'confidence-low'}">
                                    ${(proj.confidence * 100).toFixed(0)}% confidence
                                </span>
                            </div>
                            ${proj.reasoning ? `<div class="projection-reasoning">${escapeHtml(proj.reasoning)}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

function createPlayerChart(playerData) {
    const { recentGames, averages } = playerData;
    
    // Prepare data for chart (last 10 games)
    const gameLabels = recentGames.slice(0, 10).reverse().map(g => {
        const date = new Date(g.date);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    });
    
    const pointsData = recentGames.slice(0, 10).reverse().map(g => g.points);
    const reboundsData = recentGames.slice(0, 10).reverse().map(g => g.rebounds);
    const assistsData = recentGames.slice(0, 10).reverse().map(g => g.assists);
    
    const ctx = document.getElementById('playerChart');
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (window.playerChartInstance) {
        window.playerChartInstance.destroy();
    }
    
    window.playerChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: gameLabels.length > 0 ? gameLabels : ['Average'],
            datasets: [
                {
                    label: 'Points',
                    data: pointsData.length > 0 ? pointsData : [averages.points],
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.1
                },
                {
                    label: 'Rebounds',
                    data: reboundsData.length > 0 ? reboundsData : [averages.rebounds],
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    tension: 0.1
                },
                {
                    label: 'Assists',
                    data: assistsData.length > 0 ? assistsData : [averages.assists],
                    borderColor: 'rgb(54, 162, 235)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Performance Over Last 10 Games'
                },
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

async function showPlayerModalOld(playerName) {
    const modal = document.getElementById('playerModal');
    const modalName = document.getElementById('modalPlayerName');
    const modalContent = document.getElementById('modalContent');
    
    modalName.textContent = playerName;
    modalContent.innerHTML = '<div class="loading active"><div class="spinner"></div><p>Loading recent games...</p></div>';
    modal.classList.add('active');
    
    try {
        const response = await fetch(`${API_BASE}/api/players/${encodeURIComponent(playerName)}/recent-games?limit=10`);
        if (!response.ok) throw new Error('Failed to load recent games');
        
        const recentGames = await response.json();
        
        if (recentGames.length === 0) {
            modalContent.innerHTML = '<p>No recent game data available for this player.</p>';
            return;
        }
        
        modalContent.innerHTML = `
            <h3>Recent Games</h3>
            <table class="recent-games-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Opponent</th>
                        <th>Points</th>
                        <th>Rebounds</th>
                        <th>Assists</th>
                        <th>Minutes</th>
                    </tr>
                </thead>
                <tbody>
                    ${recentGames.map(game => `
                        <tr>
                            <td>${escapeHtml(game.date || 'N/A')}</td>
                            <td>${escapeHtml(game.opponent || 'N/A')}</td>
                            <td>${game.points || 0}</td>
                            <td>${game.rebounds || 0}</td>
                            <td>${game.assists || 0}</td>
                            <td>${game.minutes || 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error loading recent games:', error);
        modalContent.innerHTML = '<p>Failed to load recent games. Please try again.</p>';
    }
}

function closePlayerModal() {
    const modal = document.getElementById('playerModal');
    modal.classList.remove('active');
    
    // Destroy chart if it exists
    if (window.playerChartInstance) {
        window.playerChartInstance.destroy();
        window.playerChartInstance = null;
    }
}

// Make closePlayerModal available globally
window.closePlayerModal = closePlayerModal;

function showLoading() {
    document.getElementById('loading').classList.add('active');
    loading = true;
}

function hideLoading() {
    document.getElementById('loading').classList.remove('active');
    loading = false;
}

function showError(message) {
    const container = document.getElementById('gamesContainer');
    container.innerHTML = `
        <div class="empty-state">
            <h2>❌ Error</h2>
            <p>${escapeHtml(message)}</p>
        </div>
    `;
}

function formatDate(dateString) {
    if (!dateString) return 'TBD';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Navigate to game details page
function viewGameDetails(gameId) {
    window.location.href = `game.html?id=${gameId}`;
}

// Make viewGameDetails available globally
window.viewGameDetails = viewGameDetails;

// Toggle game card collapse
function toggleGameCard(gameId) {
    const card = document.querySelector(`.game-card[data-game-id="${gameId}"]`);
    if (!card) {
        console.error(`Game card not found for game ${gameId}`);
        return;
    }
    
    const content = card.querySelector('.game-content');
    const icon = card.querySelector('.collapse-icon');
    const toggleText = card.querySelector('.toggle-text');
    
    if (!content || !icon) {
        console.error(`Game card elements not found for game ${gameId}`);
        return;
    }
    
    if (card.classList.contains('collapsed')) {
        card.classList.remove('collapsed');
        content.style.display = 'block';
        icon.textContent = '▲';
        if (toggleText) toggleText.textContent = 'Hide Players';
        
        // Ensure players are loaded when expanding
        const game = games.find(g => g.id === gameId);
        if (game) {
            // Check if players container is empty or still loading
            const playersContainer = card.querySelector(`.players-container-${gameId}`);
            if (playersContainer && (playersContainer.innerHTML.includes('Loading') || playersContainer.innerHTML.trim() === '' || playersContainer.innerHTML.includes('empty-state'))) {
                console.log(`Loading players for game ${gameId}`);
                loadGamePlayers(game);
            }
        }
    } else {
        card.classList.add('collapsed');
        content.style.display = 'none';
        icon.textContent = '▼';
        if (toggleText) toggleText.textContent = 'Show Players';
    }
}

// Make toggleGameCard available globally
window.toggleGameCard = toggleGameCard;

