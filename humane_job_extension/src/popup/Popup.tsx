import React, { useState, useEffect } from "react";
import browser from "webextension-polyfill";
import "./popup.css";

interface AuthStatus {
  authenticated: boolean;
  user: {
    name: string;
    email: string;
    role: string;
  } | null;
}

const Popup: React.FC = () => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    authenticated: false,
    user: null,
  });
  const [apiUrl, setApiUrl] = useState("http://localhost:3000");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const config = await browser.storage.sync.get(["apiUrl", "authToken", "user"]);

      if (config.apiUrl) {
        setApiUrl(config.apiUrl);
      }

      setAuthStatus({
        authenticated: !!config.authToken,
        user: config.user || null,
      });
    } catch (error) {
      console.error("Error loading config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    // Open the web app login page
    await browser.tabs.create({
      url: `${apiUrl}/extension-auth`,
    });
  };

  const handleLogout = async () => {
    await browser.storage.sync.remove(["authToken", "user"]);
    setAuthStatus({
      authenticated: false,
      user: null,
    });
  };

  const handleSaveApiUrl = async () => {
    await browser.storage.sync.set({ apiUrl });
    alert("API URL saved!");
  };

  if (loading) {
    return (
      <div className="popup-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="popup-container">
      <header className="popup-header">
        <h1>Humane Job Application</h1>
      </header>

      <main className="popup-content">
        {authStatus.authenticated ? (
          <div className="auth-section">
            <div className="user-info">
              <div className="user-avatar">
                {authStatus.user?.name?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="user-details">
                <div className="user-name">{authStatus.user?.name || "User"}</div>
                <div className="user-email">{authStatus.user?.email || ""}</div>
                <div className="user-role">{authStatus.user?.role || ""}</div>
              </div>
            </div>
            <button className="btn btn-secondary" onClick={handleLogout}>
              Logout
            </button>
          </div>
        ) : (
          <div className="auth-section">
            <p className="auth-message">
              Sign in to start generating humane candidate rejections
            </p>
            <button className="btn btn-primary" onClick={handleLogin}>
              Sign In
            </button>
          </div>
        )}

        <div className="settings-section">
          <h2>Settings</h2>
          <div className="form-group">
            <label htmlFor="apiUrl">API URL</label>
            <input
              type="text"
              id="apiUrl"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://localhost:3000"
            />
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleSaveApiUrl}>
            Save
          </button>
        </div>

        {authStatus.authenticated && (
          <div className="status-section">
            <h2>Status</h2>
            <div className="status-item">
              <span className="status-dot status-dot-active"></span>
              <span>Extension Active</span>
            </div>
            <p className="status-description">
              Navigate to your ATS platform to generate rejection letters
            </p>
          </div>
        )}
      </main>

      <footer className="popup-footer">
        <a href={`${apiUrl}/docs`} target="_blank" rel="noopener noreferrer">
          Documentation
        </a>
        <span>v0.1.0</span>
      </footer>
    </div>
  );
};

export default Popup;
