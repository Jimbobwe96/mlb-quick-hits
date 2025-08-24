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

  // Check if pitcher - send to different view later
  const isPitcher = ["RHP", "LHP", "P"].includes(player.pos);

  if (isPitcher) {
    // For now, just show player view with a message
    showPlayerView();
    document.getElementById("battingValue").textContent = "Pitcher";
    document.getElementById("battingPercentile").textContent =
      "Stats Coming Soon";
    document.getElementById("baserunningValue").textContent = "";
    document.getElementById("baserunningPercentile").textContent = "";
    document.getElementById("fieldingValue").textContent = "";
    document.getElementById("fieldingPercentile").textContent = "";
    return;
  }

  // Show player view with loading state
  showPlayerView();
  showLoadingState();

  // Get actual stats from background script
  chrome.runtime.sendMessage(
    { action: "getPlayerStats", name: player.name, id: player.id },
    (response) => {
      if (response.success) {
        displayPlayerStats(response.data);
      } else {
        showErrorState();
      }
    }
  );
}

function showLoadingState() {
  document.getElementById("battingValue").textContent = "...";
  document.getElementById("battingPercentile").textContent = "(loading)";
  document.getElementById("baserunningValue").textContent = "...";
  document.getElementById("baserunningPercentile").textContent = "(loading)";
  document.getElementById("fieldingValue").textContent = "...";
  document.getElementById("fieldingPercentile").textContent = "(loading)";
}

function showErrorState() {
  document.getElementById("battingValue").textContent = "--";
  document.getElementById("battingPercentile").textContent = "(error)";
  document.getElementById("baserunningValue").textContent = "--";
  document.getElementById("baserunningPercentile").textContent = "(error)";
  document.getElementById("fieldingValue").textContent = "--";
  document.getElementById("fieldingPercentile").textContent = "(error)";
}

function displayPlayerStats(statcastData) {
  // Get most recent season data
  const mostRecentSeason = statcastData.reduce((latest, season) => {
    return season.year > latest.year ? season : latest;
  }, statcastData[0]);

  // Extract run values and percentiles
  const batting = {
    value: mostRecentSeason.swing_take_run_value || 0,
    percentile: mostRecentSeason.percent_rank_swing_take_run_value || 0,
  };

  const baserunning = {
    value: mostRecentSeason.runner_run_value || 0,
    percentile: mostRecentSeason.percent_rank_runner_run_value || 0,
  };

  const fielding = {
    value: mostRecentSeason.fielding_run_value || 0,
    percentile: mostRecentSeason.percent_rank_fielding_run_value || 0,
  };

  // Update display
  document.getElementById("battingValue").textContent = batting.value;
  document.getElementById("battingPercentile").textContent = `(${Math.round(
    batting.percentile
  )}%)`;

  document.getElementById("baserunningValue").textContent = baserunning.value;
  document.getElementById("baserunningPercentile").textContent = `(${Math.round(
    baserunning.percentile
  )}%)`;

  document.getElementById("fieldingValue").textContent = fielding.value;
  document.getElementById("fieldingPercentile").textContent = `(${Math.round(
    fielding.percentile
  )}%)`;

  // Update circle colors based on percentiles
  updateCircleColors(
    batting.percentile,
    baserunning.percentile,
    fielding.percentile
  );
}

function updateCircleColors(
  battingPercentile,
  baserunningPercentile,
  fieldingPercentile
) {
  // Update circle border colors based on percentiles
  document.getElementById("battingCircle").style.borderColor =
    getPercentileColor(battingPercentile);
  document.getElementById("baserunningCircle").style.borderColor =
    getPercentileColor(baserunningPercentile);
  document.getElementById("fieldingCircle").style.borderColor =
    getPercentileColor(fieldingPercentile);
}

function getPercentileColor(percentile) {
  if (percentile >= 70) {
    return "#dc3545"; // Red - hot performance
  } else if (percentile >= 30) {
    return "#6c757d"; // Gray - average performance
  } else {
    return "#007bff"; // Blue - cold performance
  }
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

// let searchTimeout;

// // View management
// function showSearchView() {
//   document.getElementById("searchView").style.display = "block";
//   document.getElementById("playerView").style.display = "none";
// }

// function showPlayerView() {
//   document.getElementById("searchView").style.display = "none";
//   document.getElementById("playerView").style.display = "block";
// }

// // Search functionality
// function performSearch(query) {
//   const resultsDiv = document.getElementById("searchResults");

//   if (query.length < 3) {
//     resultsDiv.style.display = "none";
//     return;
//   }

//   // Show loading state
//   resultsDiv.innerHTML = '<div class="loading">Searching...</div>';
//   resultsDiv.style.display = "block";

//   // Send message to background script
//   chrome.runtime.sendMessage(
//     { action: "searchPlayers", query: query },
//     (response) => {
//       if (response.success) {
//         displaySearchResults(response.data);
//       } else {
//         resultsDiv.innerHTML =
//           '<div class="loading">Search failed. Try again.</div>';
//       }
//     }
//   );
// }

// function displaySearchResults(players) {
//   const resultsDiv = document.getElementById("searchResults");

//   if (players.length === 0) {
//     resultsDiv.innerHTML = '<div class="loading">No players found</div>';
//     return;
//   }

//   // Filter to only MLB players and take first 8 results
//   const mlbPlayers = players.filter((p) => p.mlb === 1).slice(0, 8);

//   resultsDiv.innerHTML = mlbPlayers
//     .map(
//       (player) => `
//     <div class="search-result" data-player='${JSON.stringify(player)}'>
//       <div class="player-info-search">
//         <div class="player-name-search">${player.name}</div>
//         <div class="player-meta">${player.pos} • ${
//         player.name_display_club
//       }</div>
//       </div>
//     </div>
//   `
//     )
//     .join("");

//   // Add click handlers to results
//   document.querySelectorAll(".search-result").forEach((result) => {
//     result.addEventListener("click", () => {
//       const player = JSON.parse(result.dataset.player);
//       loadPlayerStats(player);
//     });
//   });
// }

// function loadPlayerStats(player) {
//   // Set player info immediately
//   document.getElementById("playerName").textContent = player.name;
//   document.getElementById(
//     "playerDetails"
//   ).textContent = `${player.pos} • ${player.name_display_club}`;
//   document.getElementById(
//     "playerPhoto"
//   ).src = `https://img.mlbstatic.com/mlb-photos/image/upload/v1/people/${player.id}/headshot/silo/current`;

//   // Show player view
//   showPlayerView();

//   // TODO: Load actual stats from background script
//   // For now, show placeholder values
//   document.getElementById("battingValue").textContent = "--";
//   document.getElementById("battingPercentile").textContent = "(--%)";
//   document.getElementById("baserunningValue").textContent = "--";
//   document.getElementById("baserunningPercentile").textContent = "(--%)";
//   document.getElementById("fieldingValue").textContent = "--";
//   document.getElementById("fieldingPercentile").textContent = "(--%)";
// }

// // Initialize when popup loads
// document.addEventListener("DOMContentLoaded", function () {
//   // Start with search view
//   showSearchView();

//   // Back button functionality
//   document.getElementById("backButton").addEventListener("click", () => {
//     showSearchView();
//     // Clear search when going back
//     document.getElementById("playerSearch").value = "";
//     document.getElementById("searchResults").style.display = "none";
//   });

//   // Search input handling with debouncing
//   document.getElementById("playerSearch").addEventListener("input", (e) => {
//     const query = e.target.value.trim();

//     // Clear previous timeout
//     clearTimeout(searchTimeout);

//     // Set new timeout
//     searchTimeout = setTimeout(() => {
//       performSearch(query);
//     }, 300); // Wait 300ms after user stops typing
//   });

//   console.log("Extension popup loaded");
// });
