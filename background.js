// Background script handles API calls to avoid CORS issues

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "searchPlayers") {
    searchPlayers(request.query).then(sendResponse);
    return true; // Keep message channel open for async response
  }

  if (request.action === "getPlayerStats") {
    getPlayerStats(request.name, request.id).then(sendResponse);
    return true;
  }
});

async function searchPlayers(query) {
  try {
    const response = await fetch(
      `https://baseballsavant.mlb.com/player/search-all?search=${query}`
    );
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error("Search failed:", error);
    return { success: false, error: error.message };
  }
}

async function getPlayerStats(name, id) {
  try {
    // Use simpler URL format with just player ID
    const url = `https://baseballsavant.mlb.com/savant-player/${id}`;

    const response = await fetch(url);
    const html = await response.text();

    // Parse embedded JavaScript for statcast data
    // Look for the statcast array in the serverVals object
    const scriptMatch = html.match(/statcast:\s*(\[.*?\])/s);
    if (scriptMatch) {
      const statcast = JSON.parse(scriptMatch[1]);
      return { success: true, data: statcast };
    } else {
      // Try alternative pattern - sometimes it's formatted differently
      const altMatch = html.match(
        /var\s+serverVals\s*=\s*\{[^}]*statcast:\s*(\[.*?\])/s
      );
      if (altMatch) {
        const statcast = JSON.parse(altMatch[1]);
        return { success: true, data: statcast };
      }
      throw new Error("Could not find statcast data in page");
    }
  } catch (error) {
    console.error("Failed to get player stats:", error);
    return { success: false, error: error.message };
  }
}

// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.action === "searchPlayers") {
//     searchPlayers(request.query).then(sendResponse);
//     return true; // Keep message channel open for async response
//   }

//   if (request.action === "getPlayerStats") {
//     getPlayerStats(request.name, request.id).then(sendResponse);
//     return true;
//   }
// });

// async function searchPlayers(query) {
//   try {
//     const response = await fetch(
//       `https://baseballsavant.mlb.com/player/search-all?search=${query}`
//     );
//     const data = await response.json();
//     return { success: true, data };
//   } catch (error) {
//     console.error("Search failed:", error);
//     return { success: false, error: error.message };
//   }
// }

// async function getPlayerStats(name, id) {
//   try {
//     // Convert name to URL slug format (e.g., "Aaron Judge" -> "aaron-judge")
//     const slug = name.toLowerCase().replace(" ", "-") + "-" + id;
//     const url = `https://baseballsavant.mlb.com/savant-player/${slug}`;

//     const response = await fetch(url);
//     const html = await response.text();

//     // Parse embedded JavaScript for statcast data
//     const scriptMatch = html.match(/statcast: (\[.*?\])/s);
//     if (scriptMatch) {
//       const statcast = JSON.parse(scriptMatch[1]);
//       return { success: true, data: statcast };
//     } else {
//       throw new Error("Could not find player data");
//     }
//   } catch (error) {
//     console.error("Failed to get player stats:", error);
//     return { success: false, error: error.message };
//   }
// }
