// Import the configuration (Chrome extensions support ES modules with proper setup)
// If you're using Manifest V3, make sure to declare config.js as an import in your manifest.json

// The TRELLO_CONFIG now references the values from config.js
const TRELLO_CONFIG = {
  key: ENV.TRELLO_KEY,
  token: ENV.TRELLO_TOKEN,
  listId: ENV.TRELLO_LIST_ID
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.type);
    
  if (request.type === 'CREATE_CARD') {
    createTrelloCard(request.data)
      .then(response => {
        console.log('Card created successfully');
        sendResponse({success: true, data: response});
      })
      .catch(error => {
        console.error('Error creating card:', error);
        sendResponse({success: false, error: error.message});
      });
    return true;
  }
    
  if (request.type === 'ADD_ATTACHMENT') {
    console.log('Adding attachment to card:', request.cardId);
    addAttachment(request.cardId, request.screenshot)
      .then(response => {
        console.log('Attachment added successfully');
        sendResponse({success: true, data: response});
      })
      .catch(error => {
        console.error('Error adding attachment:', error);
        sendResponse({success: false, error: error.message});
      });
    return true;
  }

  if (request.action === 'captureScreenshot') {
    chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 90 }, dataUrl => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
        
      // Send back the full screenshot
      sendResponse({
        success: true,
        dataUrl: dataUrl
      });
    });
    return true;
  }
});

async function createTrelloCard(data) {
  const url = `https://api.trello.com/1/cards?key=${TRELLO_CONFIG.key}&token=${TRELLO_CONFIG.token}`;
    
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: data.name,
      desc: data.description,
      idList: TRELLO_CONFIG.listId
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Card creation error:', errorText);
    throw new Error(`Failed to create card: ${response.status}`);
  }
  
  return await response.json();
}

async function addAttachment(cardId, screenshot) {
  const url = `https://api.trello.com/1/cards/${cardId}/attachments?key=${TRELLO_CONFIG.key}&token=${TRELLO_CONFIG.token}`;
    
  // Remove the data URL prefix to get just the base64 data
  const base64Data = screenshot.split(',')[1];
    
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'screenshot.jpg',
      mimeType: 'image/jpeg',
      url: screenshot // Send the full data URL
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Attachment error:', errorText);
    throw new Error(`Failed to add attachment: ${response.status}`);
  }
  
  return await response.json();
}