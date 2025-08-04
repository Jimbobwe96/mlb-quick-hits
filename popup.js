let searchTimeout;

// View management
function showSearchView() {
  document.getElementById("searchView").style.display = "block";
  document.getElementById("playerView").style.display = "none";
}

function showPlayerView() {
  document.getElementById("searchView").style.display = "none";
  document.getElementById("playerView").style.display = "block";
}

// Search functionality
function performSearch(query) {
  const resultsDiv = document.getElementById("searchResults");

  if (query.length < 3) {
    resultsDiv.style.display = "none";
    return;
  }

  // Show loading state
  resultsDiv.innerHTML = '<div class="loading">Searching...</div>';
  resultsDiv.style.display = "block";

  // Send message to background script
  chrome.runtime.sendMessage(
    { action: "searchPlayers", query: query },
    (response) => {
      if (response.success) {
        displaySearchResults(response.data);
      } else {
        resultsDiv.innerHTML =
          '<div class="loading">Search failed. Try again.</div>';
      }
    }
  );
}

function displaySearchResults(players) {
  const resultsDiv = document.getElementById("searchResults");

  if (players.length === 0) {
    resultsDiv.innerHTML = '<div class="loading">No players found</div>';
    return;
  }

  // Filter to only MLB players and take first 8 results
  const mlbPlayers = players.filter((p) => p.mlb === 1).slice(0, 8);

  resultsDiv.innerHTML = mlbPlayers
    .map(
      (player) => `
    <div class="search-result" data-player='${JSON.stringify(player)}'>
      <div class="player-info-search">
        <div class="player-name-search">${player.name}</div>
        <div class="player-meta">${player.pos} • ${
        player.name_display_club
      }</div>
      </div>
    </div>
  `
    )
    .join("");

  // Add click handlers to results
  document.querySelectorAll(".search-result").forEach((result) => {
    result.addEventListener("click", () => {
      const player = JSON.parse(result.dataset.player);
      loadPlayerStats(player);
    });
  });
}

function loadPlayerStats(player) {
  // Set player info immediately
  document.getElementById("playerName").textContent = player.name;
  document.getElementById(
    "playerDetails"
  ).textContent = `${player.pos} • ${player.name_display_club}`;
  document.getElementById(
    "playerPhoto"
  ).src = `https://img.mlbstatic.com/mlb-photos/image/upload/v1/people/${player.id}/headshot/silo/current`;

  // Show player view
  showPlayerView();

  // TODO: Load actual stats from background script
  // For now, show placeholder values
  document.getElementById("battingValue").textContent = "--";
  document.getElementById("battingPercentile").textContent = "(--%)";
  document.getElementById("baserunningValue").textContent = "--";
  document.getElementById("baserunningPercentile").textContent = "(--%)";
  document.getElementById("fieldingValue").textContent = "--";
  document.getElementById("fieldingPercentile").textContent = "(--%)";
}

// Initialize when popup loads
document.addEventListener("DOMContentLoaded", function () {
  // Start with search view
  showSearchView();

  // Back button functionality
  document.getElementById("backButton").addEventListener("click", () => {
    showSearchView();
    // Clear search when going back
    document.getElementById("playerSearch").value = "";
    document.getElementById("searchResults").style.display = "none";
  });

  // Search input handling with debouncing
  document.getElementById("playerSearch").addEventListener("input", (e) => {
    const query = e.target.value.trim();

    // Clear previous timeout
    clearTimeout(searchTimeout);

    // Set new timeout
    searchTimeout = setTimeout(() => {
      performSearch(query);
    }, 300); // Wait 300ms after user stops typing
  });

  console.log("Extension popup loaded");
});
