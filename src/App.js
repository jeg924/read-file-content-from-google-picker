import React, { useState, useEffect } from "react";
import "./App.css";

// Using test-drive-file-scope project in google. non-sensitive project created only for this test.
const GOOGLE_CLIENT_ID =
  "812086361428-dsn0mtap6in0783a658c2oth1q6td8mq.apps.googleusercontent.com";

const GOOGLE_API_KEY = "AIzaSyCOxOcX9-1LLGSxuDx2_LLRADJsH5IHAPA";
const GOOGLE_PROJECT_NUMBER = "812086361428";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState("");
  const [error, setError] = useState("");
  const [gapi, setGapi] = useState(null);
  const [tokenClient, setTokenClient] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Initialize Google APIs when component mounts
    const initializeGoogleAPIs = () => {
      if (window.gapi && window.google) {
        setGapi(window.gapi);

        // Load both client and picker APIs
        window.gapi.load("client:picker", async () => {
          try {
            console.log(
              "Initializing GAPI client with API key:",
              GOOGLE_API_KEY
            );

            // Initialize without discovery docs to avoid the error
            await window.gapi.client.init({
              apiKey: GOOGLE_API_KEY,
            });

            console.log("GAPI client initialized successfully");

            // Test the API key with a simple request
            try {
              const testResponse = await gapi.client.request({
                path: "https://www.googleapis.com/drive/v3/about",
                params: { fields: "user" },
              });
              console.log("API key test successful:", testResponse);
            } catch (testError) {
              console.error("API key test failed:", testError);
              setError(
                `API key test failed: ${testError.message}. Please check that your API key is correct and that Google Drive API is enabled.`
              );
            }

            // Initialize the Google Identity Services client
            try {
              console.log(
                "Initializing token client with Client ID:",
                GOOGLE_CLIENT_ID
              );
              console.log("Current domain:", window.location.origin);

              const tokenClient = window.google.accounts.oauth2.initTokenClient(
                {
                  client_id: GOOGLE_CLIENT_ID,
                  scope: "https://www.googleapis.com/auth/drive.file",
                  callback: (response) => {
                    console.log("OAuth callback response:", response);
                    if (response.access_token) {
                      window.gapi.client.setApiKey(GOOGLE_API_KEY);
                      window.gapi.client.setToken(response);
                      setIsAuthenticated(true);
                      setError("");
                      console.log("Successfully authenticated with Google");
                    } else if (response.error) {
                      console.error("OAuth error:", response.error);
                      setError(`Authentication failed: ${response.error}`);
                    }
                  },
                }
              );

              setTokenClient(tokenClient);
              console.log("Token client initialized successfully");
            } catch (tokenError) {
              console.error("Error initializing token client:", tokenError);
              setError(
                `Failed to initialize OAuth client: ${tokenError.message}. Please check that your Client ID is correct and that ${window.location.origin} is added to authorized origins.`
              );
            }

            setIsInitializing(false);
            console.log("Google APIs initialized successfully");
          } catch (error) {
            console.error("Error initializing Google APIs:", error);
            setError(
              "Failed to initialize Google APIs. Please check your credentials."
            );
            setIsInitializing(false);
          }
        });
      } else {
        // Retry after a short delay if Google APIs aren't loaded yet
        setTimeout(initializeGoogleAPIs, 100);
      }
    };

    initializeGoogleAPIs();
  }, []);

  const handleSignIn = () => {
    if (tokenClient) {
      console.log("Requesting access token...");
      tokenClient.requestAccessToken();
    } else {
      setError("Token client not initialized. Please refresh the page.");
    }
  };

  const handleSignOut = () => {
    if (gapi) {
      gapi.client.setToken(null);
      setIsAuthenticated(false);
      setSelectedFile(null);
      setFileContent("");
      setError("");
    }
  };

  const openPicker = () => {
    if (!gapi || !isAuthenticated) {
      setError("Please sign in first");
      return;
    }

    const picker = new window.google.picker.PickerBuilder()
      .addView(window.google.picker.ViewId.DOCS)
      .setOAuthToken(gapi.client.getToken().access_token)
      .setDeveloperKey(GOOGLE_API_KEY)
      .setAppId(GOOGLE_PROJECT_NUMBER)
      .setCallback(pickerCallback)
      .build();

    picker.setVisible(true);
  };

  const pickerCallback = (data) => {
    if (data.action === window.google.picker.Action.PICKED) {
      const file = data.docs[0];
      console.log("File selected from picker:", file);
      setSelectedFile(file);
      setError("");

      // Add a small delay to ensure permissions are propagated
      setTimeout(() => {
        readFileContent(file.id);
      }, 1000);
    }
  };

  const readFileContent = async (fileId, retryCount = 0) => {
    setIsLoading(true);
    setError("");

    try {
      console.log(
        `Attempting to read file ${fileId} (attempt ${retryCount + 1})`
      );

      // First, get file metadata to determine the file type
      const fileMetadata = await gapi.client.request({
        path: `https://www.googleapis.com/drive/v3/files/${fileId}`,
        params: { fields: "name, mimeType, size" },
      });

      const file = fileMetadata.result;
      console.log("File metadata:", file);

      // For text files, we can read the content directly
      if (
        file.mimeType.startsWith("text/") ||
        file.mimeType === "application/json" ||
        file.mimeType === "application/javascript" ||
        file.mimeType === "application/xml"
      ) {
        const response = await gapi.client.request({
          path: `https://www.googleapis.com/drive/v3/files/${fileId}`,
          params: { alt: "media" },
        });

        setFileContent(response.body);
      } else {
        // For other file types, show metadata instead
        setFileContent(
          `File: ${file.name}\nType: ${file.mimeType}\nSize: ${file.size} bytes\n\nThis file type cannot be displayed as text.`
        );
      }
    } catch (error) {
      console.error("Error reading file:", error);

      // If it's a "not found" error and we haven't retried too many times, try again
      if (error.status === 404 && retryCount < 2) {
        console.log(
          `File not found, retrying in 2 seconds... (attempt ${retryCount + 1})`
        );
        setTimeout(() => {
          readFileContent(fileId, retryCount + 1);
        }, 2000);
        return;
      }

      setError(
        `Failed to read file: ${error.message}. This might be due to the drive.file scope restrictions. Try selecting a file that you own or have edit access to.`
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="App">
      <div className="container">
        <header className="header">
          <h1>Google Drive File Reader</h1>
          <p>Select a file from your Google Drive to view its contents</p>
        </header>

        <div className="auth-section">
          {isInitializing ? (
            <div className="loading-message">
              <p>Initializing Google APIs...</p>
            </div>
          ) : !isAuthenticated ? (
            <button
              className="auth-button sign-in"
              onClick={handleSignIn}
              disabled={!tokenClient}
            >
              {!tokenClient ? "Initializing..." : "Sign in with Google"}
            </button>
          ) : (
            <div className="auth-controls">
              <button className="auth-button sign-out" onClick={handleSignOut}>
                Sign Out
              </button>
              <button
                className="auth-button picker"
                onClick={openPicker}
                disabled={isLoading}
              >
                {isLoading ? "Loading..." : "Select File from Drive"}
              </button>
            </div>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}

        {selectedFile && (
          <div className="file-info">
            <h3>Selected File:</h3>
            <p>
              <strong>Name:</strong> {selectedFile.name}
            </p>
            <p>
              <strong>Type:</strong> {selectedFile.mimeType}
            </p>
            <p>
              <strong>Size:</strong> {selectedFile.sizeBytes} bytes
            </p>
          </div>
        )}

        {fileContent && (
          <div className="file-content">
            <h3>File Content:</h3>
            <pre className="content-display">{fileContent}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
