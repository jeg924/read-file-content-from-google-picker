# Google Drive File Reader

A React application that integrates with Google Picker and Google Drive API to allow users to select files from their Google Drive and read their contents. Per https://developers.google.com/workspace/drive/api/guides/api-specific-auth#benefits, we should be able to read these file contents, but we're not. We get a 404 error.

This repo is intended to demonstrate what you can't do with drive.file scope: Read the contents of the file that the user picked to share with your app.
