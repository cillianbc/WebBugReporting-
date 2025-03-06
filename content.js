// content.js
const TRELLO_CONFIG = {
    key: process.env.TRELLO_KEY || '',
    token: process.env.TRELLO_TOKEN || '',
    listId: process.env.TRELLO_LIST_ID || '',
    boardId: process.env.TRELLO_BOARD_ID || ''
};

// Listen for the message from popup.js
window.addEventListener('message', (event) => {
    if (event.data.type === 'START_BUG_CAPTURE') {
        enableBugCapture();
    }
});

let isCapturing = false;
let selectedElement = null;

function enableBugCapture() {
    isCapturing = true;
    document.body.style.cursor = 'crosshair';
    
    document.addEventListener('mouseover', highlightElement);
    document.addEventListener('click', captureElement);
}

function highlightElement(e) {
    if (!isCapturing) return;
    
    if (selectedElement) {
        selectedElement.classList.remove('bug-reporter-highlight');
    }
    
    selectedElement = e.target;
    selectedElement.classList.add('bug-reporter-highlight');
    e.preventDefault();
    e.stopPropagation();
}

async function captureElement(e) {
    if (!isCapturing) return;
    
    e.preventDefault();
    e.stopPropagation();

    try {
        // Capture screenshot before showing modal
        const screenshot = await captureScreenshot(selectedElement.getBoundingClientRect());
        
        // After screenshot is captured, show modal
        const modal = showBugReportModal(null, selectedElement);
        modal.screenshot = screenshot;
        
        // Enable submit button
        const submitButton = modal.querySelector('#submitBug');
        submitButton.disabled = false;
        submitButton.classList.remove('disabled');
        submitButton.removeAttribute('title');
    } catch (error) {
        console.error('Screenshot capture failed:', error);
        showNotification('Screenshot capture failed, but you can still submit the report', 'error');
        // Show modal even if screenshot fails
        showBugReportModal(null, selectedElement);
    }
    
    isCapturing = false;
    document.body.style.cursor = 'default';
    document.removeEventListener('mouseover', highlightElement);
    document.removeEventListener('click', captureElement);
}

function showBugReportModal(screenshot, element) {
    const modal = document.createElement('div');
    modal.className = 'bug-reporter-modal';
    modal.screenshot = screenshot;
    modal.innerHTML = `
        <h3>Describe the Bug</h3>
        <select id="bugReporter" class="reporter-select">
            <option value="">Select Reporter</option>
            <option value="Ben Finnan">Ben Finnan</option>
            <option value="Tristan Worden">Tristan Worden</option>
            <option value="Lisa Wright">Lisa Wright</option>
            <option value="Cillian Bracken Conway">Cillian Bracken Conway</option>
            <option value="Art Gehrig">Art Gehrig</option>
        </select>
        <textarea id="bugDescription" placeholder="Please describe what's wrong with this element..."></textarea>
        <div class="file-upload">
            <label for="additionalScreenshots">Add More Screenshots:</label>
            <input type="file" id="additionalScreenshots" accept="image/*" multiple>
        </div>
        <div class="buttons">
            <button class="submit disabled" id="submitBug" disabled title="Please wait while screenshot is being processed...">Submit Bug Report</button>
            <button class="cancel" id="cancelBug">Cancel</button>
        </div>
        <div class="keyboard-hint">Press ESC to close and reselect element</div>
    `;
    
    document.body.appendChild(modal);
    
    // Handle escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', handleEscape);
            // Restart element selection
            enableBugCapture();
        }
    };
    
    document.addEventListener('keydown', handleEscape);
    
    document.getElementById('submitBug').addEventListener('click', async () => {
        const description = document.getElementById('bugDescription').value;
        const reporter = document.getElementById('bugReporter').value;
        const additionalScreenshots = document.getElementById('additionalScreenshots').files;
        
        if (!reporter) {
            showNotification('Please select a reporter', 'error');
            return;
        }
        
        document.removeEventListener('keydown', handleEscape);
        await submitToTrello(modal.screenshot, description, element, reporter, additionalScreenshots);
        modal.remove();
    });
    
    document.getElementById('cancelBug').addEventListener('click', () => {
        document.removeEventListener('keydown', handleEscape);
        modal.remove();
    });

    return modal;
}

function captureScreenshot(rect) {
    return new Promise((resolve, reject) => {
        const padding = 20;
        const captureArea = {
            x: Math.max(0, Math.round(rect.left + window.scrollX)),
            y: Math.max(0, Math.round(rect.top + window.scrollY)),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
        };

        chrome.runtime.sendMessage({ 
            action: 'captureScreenshot',
            area: captureArea 
        }, response => {
            if (!response || !response.success) {
                reject(new Error(response?.error || 'Screenshot capture failed'));
                return;
            }

            fetch(response.dataUrl)
                .then(res => res.blob())
                .then(resolve)
                .catch(reject);
        });
    });
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `bug-reporter-notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="message">${message}</span>
            <button class="close-notification">✕</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Add click handler for close button
    notification.querySelector('.close-notification').addEventListener('click', () => {
        notification.remove();
    });
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

function showLoadingSpinner(message = 'Submitting bug report...') {
    const spinner = document.createElement('div');
    spinner.className = 'bug-reporter-spinner-overlay';
    spinner.innerHTML = `
        <div class="spinner-container">
            <div class="spinner"></div>
            <div class="spinner-text">${message}</div>
        </div>
    `;
    document.body.appendChild(spinner);
}

function removeLoadingSpinner() {
    const spinner = document.querySelector('.bug-reporter-spinner-overlay');
    if (spinner) {
        spinner.remove();
    }
}

async function submitToTrello(screenshot, description, element, reporter, additionalScreenshots) {
    showLoadingSpinner();
    try {
        console.log('Preparing card data...');
        
        const currentDate = new Date();
        const formattedDate = currentDate.toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Get URL path without query parameters
        const url = new URL(window.location.href);
        const cleanPath = url.pathname;
        
        // Get or create label for this path
        const labelId = await getOrCreateLabel(cleanPath);
        
        const cardData = {
            name: `Bug Report by ${reporter} on ${cleanPath}`,
            desc: `
Reporter: ${reporter}
Description: ${description}
URL: ${window.location.href}
Element: ${element.tagName} ${element.className}
Date: ${formattedDate}
            `,
            idList: TRELLO_CONFIG.listId,
            idLabels: labelId ? [labelId] : [],
            key: TRELLO_CONFIG.key,
            token: TRELLO_CONFIG.token
        };

        const cardResponse = await fetch('https://api.trello.com/1/cards', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(cardData)
        });

        if (!cardResponse.ok) {
            throw new Error(`Failed to create card: ${cardResponse.status}`);
        }

        const card = await cardResponse.json();
        console.log('Card created:', card.id);

        // Upload the automatic screenshot
        await attachFileToCard(card.id, screenshot, 'automatic-screenshot.jpg');

        // Upload additional screenshots if any
        for (let i = 0; i < additionalScreenshots.length; i++) {
            await attachFileToCard(card.id, additionalScreenshots[i], additionalScreenshots[i].name);
        }

        showNotification('Bug report submitted successfully!', 'success');
    } catch (error) {
        console.error('Submission error:', error);
        showNotification('Error submitting bug report. Check console for details.', 'error');
    } finally {
        removeLoadingSpinner();
    }
}

async function attachFileToCard(cardId, file, filename) {
    const formData = new FormData();
    formData.append('key', TRELLO_CONFIG.key);
    formData.append('token', TRELLO_CONFIG.token);
    formData.append('name', filename);
    formData.append('file', file);

    const attachmentResponse = await fetch(`https://api.trello.com/1/cards/${cardId}/attachments`, {
        method: 'POST',
        body: formData
    });

    if (!attachmentResponse.ok) {
        console.error('Attachment failed:', await attachmentResponse.text());
        throw new Error(`Failed to attach ${filename}`);
    }

    return attachmentResponse.json();
}

async function getOrCreateLabel(path) {
    try {
        // First, get all labels on the board
        const boardId = TRELLO_CONFIG.boardId;
        const labelsResponse = await fetch(
            `https://api.trello.com/1/boards/${boardId}/labels?key=${TRELLO_CONFIG.key}&token=${TRELLO_CONFIG.token}`
        );
        
        if (!labelsResponse.ok) {
            throw new Error('Failed to fetch labels');
        }

        const labels = await labelsResponse.json();
        
        // Check if label already exists
        const existingLabel = labels.find(label => label.name === path);
        if (existingLabel) {
            return existingLabel.id;
        }

        // Available Trello colors
        const colors = [
            'yellow', 'purple', 'blue', 
            'red', 'green', 'orange',
            'black', 'sky', 'pink', 
            'lime'
        ];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        // Create new label if it doesn't exist
        const createLabelResponse = await fetch(
            `https://api.trello.com/1/labels?key=${TRELLO_CONFIG.key}&token=${TRELLO_CONFIG.token}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: path,
                color: randomColor,
                idBoard: boardId
            })
        });

        if (!createLabelResponse.ok) {
            throw new Error('Failed to create label');
        }

        const newLabel = await createLabelResponse.json();
        return newLabel.id;
    } catch (error) {
        console.error('Error handling label:', error);
        return null; // Return null if label creation fails, card will be created without label
    }
}