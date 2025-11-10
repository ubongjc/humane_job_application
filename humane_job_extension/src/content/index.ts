import browser from "webextension-polyfill";

console.log("Humane Job Extension - Content script loaded");

// Detect which ATS platform we're on
const detectPlatform = (): string | null => {
  const hostname = window.location.hostname;

  if (hostname.includes("greenhouse.io")) return "greenhouse";
  if (hostname.includes("lever.co")) return "lever";
  if (hostname.includes("workday.com")) return "workday";
  if (hostname.includes("jazz.co")) return "jazz";
  if (hostname.includes("breezy.hr")) return "breezy";

  return null;
};

// Extract candidate data based on platform
const extractCandidateData = (platform: string): any => {
  // Platform-specific extraction logic
  // This is a simplified version - real implementation would be more complex

  switch (platform) {
    case "greenhouse":
      return extractGreenhouseData();
    case "lever":
      return extractLeverData();
    default:
      return null;
  }
};

function extractGreenhouseData(): any {
  // Extract structured data from Greenhouse UI
  // This is a placeholder - actual implementation would parse DOM
  return {
    platform: "greenhouse",
    candidateName: document.querySelector(".candidate-name")?.textContent,
    email: document.querySelector(".candidate-email")?.textContent,
    jobTitle: document.querySelector(".job-title")?.textContent,
    // Extract rubric scores, not raw resume data
    scores: extractScores(),
  };
}

function extractLeverData(): any {
  // Extract structured data from Lever UI
  return {
    platform: "lever",
    candidateName: document.querySelector("[data-test='candidate-name']")?.textContent,
    email: document.querySelector("[data-test='candidate-email']")?.textContent,
    jobTitle: document.querySelector("[data-test='job-title']")?.textContent,
    scores: extractScores(),
  };
}

function extractScores(): any {
  // Extract evaluation scores from the ATS interface
  // Privacy-safe: only structured rubric items, not full notes
  const scoreElements = document.querySelectorAll("[data-score], .evaluation-score");
  const scores: Record<string, number> = {};

  scoreElements.forEach((el) => {
    const criterion = el.getAttribute("data-criterion") || el.textContent?.split(":")[0];
    const scoreText = el.getAttribute("data-score") || el.textContent?.split(":")[1];
    const score = parseInt(scoreText || "0");

    if (criterion && !isNaN(score)) {
      scores[criterion.trim()] = score;
    }
  });

  return scores;
}

// Add UI overlay for letter generation
function addGenerateLetterButton() {
  const platform = detectPlatform();
  if (!platform) return;

  // Find the decision area in the ATS UI
  const decisionArea = document.querySelector(".decision-actions, .candidate-actions");
  if (!decisionArea) return;

  // Check if button already exists
  if (document.getElementById("humane-job-generate-btn")) return;

  const button = document.createElement("button");
  button.id = "humane-job-generate-btn";
  button.textContent = "Generate Humane Rejection";
  button.style.cssText = `
    margin: 8px;
    padding: 8px 16px;
    background: #6366f1;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
  `;

  button.addEventListener("click", async () => {
    const candidateData = extractCandidateData(platform);

    if (!candidateData) {
      alert("Could not extract candidate data");
      return;
    }

    // Send to background script
    browser.runtime.sendMessage({
      type: "GENERATE_LETTER",
      data: candidateData,
    });

    button.textContent = "Generating...";
    button.disabled = true;
  });

  decisionArea.appendChild(button);
}

// Listen for messages from background script
browser.runtime.onMessage.addListener((message) => {
  if (message.type === "LETTER_GENERATED") {
    console.log("Letter generated:", message.data);

    // Display the generated letter in the ATS UI
    displayGeneratedLetter(message.data.letter);

    // Re-enable the button
    const button = document.getElementById("humane-job-generate-btn") as HTMLButtonElement;
    if (button) {
      button.textContent = "Generate Humane Rejection";
      button.disabled = false;
    }
  }
});

function displayGeneratedLetter(letter: string) {
  // Create an overlay to display the generated letter
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 24px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    max-width: 600px;
    z-index: 10000;
  `;

  overlay.innerHTML = `
    <h2 style="margin: 0 0 16px 0;">Generated Rejection Letter</h2>
    <div style="white-space: pre-wrap; margin-bottom: 16px;">${letter}</div>
    <div style="display: flex; gap: 8px;">
      <button id="copy-letter" style="padding: 8px 16px; background: #6366f1; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Copy
      </button>
      <button id="close-overlay" style="padding: 8px 16px; background: #e5e7eb; border: none; border-radius: 4px; cursor: pointer;">
        Close
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector("#copy-letter")?.addEventListener("click", () => {
    navigator.clipboard.writeText(letter);
    alert("Letter copied to clipboard!");
  });

  overlay.querySelector("#close-overlay")?.addEventListener("click", () => {
    overlay.remove();
  });
}

// Initialize
const platform = detectPlatform();
if (platform) {
  console.log("Detected ATS platform:", platform);

  // Wait for page to load, then add button
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addGenerateLetterButton);
  } else {
    addGenerateLetterButton();
  }

  // Re-add button if DOM changes (SPA navigation)
  const observer = new MutationObserver(() => {
    addGenerateLetterButton();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}
