import browser from "webextension-polyfill";

console.log("Humane Job Extension - Background script loaded");

// Message handling
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message);

  switch (message.type) {
    case "EXTRACT_CANDIDATE_DATA":
      handleExtractCandidateData(message.data, sender);
      break;
    case "GENERATE_LETTER":
      handleGenerateLetter(message.data, sender);
      break;
    case "GET_AUTH_STATUS":
      handleGetAuthStatus(sendResponse);
      return true; // Will respond asynchronously
    default:
      console.warn("Unknown message type:", message.type);
  }
});

async function handleExtractCandidateData(data: any, sender: browser.Runtime.MessageSender) {
  try {
    // Get API URL from storage
    const config = await browser.storage.sync.get(["apiUrl", "authToken"]);

    if (!config.authToken) {
      console.error("Not authenticated");
      return;
    }

    // Send to API
    const response = await fetch(`${config.apiUrl}/api/ext/candidate/extract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.authToken}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    console.log("Candidate data sent to API");
  } catch (error) {
    console.error("Error sending candidate data:", error);
  }
}

async function handleGenerateLetter(data: any, sender: browser.Runtime.MessageSender) {
  try {
    const config = await browser.storage.sync.get(["apiUrl", "authToken"]);

    if (!config.authToken) {
      console.error("Not authenticated");
      return;
    }

    const response = await fetch(`${config.apiUrl}/api/letter/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.authToken}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();

    // Send result back to content script
    if (sender.tab?.id) {
      browser.tabs.sendMessage(sender.tab.id, {
        type: "LETTER_GENERATED",
        data: result,
      });
    }
  } catch (error) {
    console.error("Error generating letter:", error);
  }
}

async function handleGetAuthStatus(sendResponse: (response: any) => void) {
  const config = await browser.storage.sync.get(["authToken", "user"]);
  sendResponse({
    authenticated: !!config.authToken,
    user: config.user || null,
  });
}

// Installation handler
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("Extension installed");
    // Set default config
    browser.storage.sync.set({
      apiUrl: "http://localhost:3000",
    });
  }
});
