# Trello Integration Chrome Extension

This Chrome extension allows you to create Trello cards and add attachments directly from your browser.

## Setup Instructions

### For Developers
1. Clone this repository
2. Copy `config.sample.js` to `config.js`
3. Add your Trello API credentials to `config.js`:
   ```javascript
   const ENV = {
     TRELLO_KEY: 'your-trello-key',
     TRELLO_TOKEN: 'your-trello-token',
     TRELLO_LIST_ID: 'your-trello-list-id',
     TRELLO_BOARD_ID: 'your-trello-board-id'
   };
   ```
4. Load the extension in Chrome:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the extension directory

### Getting Trello Credentials
1. Get your API Key from [https://trello.com/app-key](https://trello.com/app-key)
2. Generate a Token from the same page
3. Get your List ID by adding `.json` to the end of your Trello board URL in the browser, then locate the desired list ID

## Security Notes
- The `config.js` file is excluded from version control to protect your credentials
- Never commit your API keys to the repository