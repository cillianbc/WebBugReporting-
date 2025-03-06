document.getElementById('startCapture').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        window.postMessage({ type: 'START_BUG_CAPTURE' }, '*');
      }
    });
    window.close();
  });