document.getElementById('openConverter').addEventListener('click', () => {
    // Open the converter in a new tab
    chrome.tabs.create({
        url: chrome.runtime.getURL('converter.html')
    });
});

