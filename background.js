/**
 * Jira Data Downloader - Background Service Worker
 * Handles automatic downloads when navigating to a Jira issue.
 */

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    if (details.url && details.url.includes('atlassian.net/browse/')) {
        handleAutoDownload(details.url);
    }
}, { url: [{ hostSuffix: 'atlassian.net', pathContains: '/browse/' }] });

// Also handle initial load if not SPA navigation
chrome.webNavigation.onCompleted.addListener((details) => {
    if (details.url && details.url.includes('atlassian.net/browse/')) {
        handleAutoDownload(details.url);
    }
}, { url: [{ hostSuffix: 'atlassian.net', pathContains: '/browse/' }] });

async function handleAutoDownload(tabUrl) {
    try {
        const url = new URL(tabUrl);
        const domain = url.hostname;
        const keyMatch = url.pathname.match(/\/browse\/([A-Z0-9-]+)/);

        if (!keyMatch) return;

        const issueKey = keyMatch[1];

        // Check if we already downloaded this issue in the last few seconds to avoid loops
        const lastKey = await getFromStorage('lastDownloadedKey');
        const lastTime = await getFromStorage('lastDownloadedTime');
        const now = Date.now();

        if (lastKey === issueKey && (now - (lastTime || 0)) < 5000) {
            console.log(`Skipping autodownload for ${issueKey} (already done recently)`);
            return;
        }
        const issueUrl = `https://${domain}/browse/${issueKey}`;
        const apiUrl = `https://${domain}/rest/api/3/issue/${issueKey}?fields=summary,description,status,customfield_10014,reporter`;

        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`API status ${response.status}`);

        const rawData = await response.json();
        const processedData = processJiraData(rawData, issueUrl);

        await saveToStorage('lastDownloadedKey', issueKey);
        await saveToStorage('lastDownloadedTime', now);

        downloadJson(processedData);
    } catch (error) {
        console.error('Autodownload Error:', error);
    }
}

function processJiraData(json, issueUrl) {
    const fields = json.fields || {};
    return {
        key: json.key,
        summary: fields.summary || 'N/A',
        status: fields.status ? fields.status.name : 'N/A',
        reporter: fields.reporter ? fields.reporter.displayName : 'Anonymous',
        parentOrEpic: fields.customfield_10014 || 'N/A',
        issueUrl: issueUrl || 'N/A',
        description: adfToText(fields.description)
    };
}

function adfToText(adf) {
    if (!adf || !adf.content) return "No description provided.";
    let text = "";
    function traverse(node) {
        if (node.text) text += node.text;
        if (node.type === 'hardBreak') text += "\n";
        if (node.content) node.content.forEach(traverse);
        if (node.type === 'paragraph' || node.type === 'listItem') text += "\n";
    }
    adf.content.forEach(traverse);
    return text.trim();
}

function downloadJson(data) {
    const blobContent = JSON.stringify(data, null, 2);
    const base64 = btoa(unescape(encodeURIComponent(blobContent)));
    const url = `data:application/json;base64,${base64}`;
    const filename = `${data.key || 'issue'}.json`;

    // Try to disable the shelf (requires downloads.shelf permission)
    if (chrome.downloads.setShelfEnabled) {
        chrome.downloads.setShelfEnabled(false);
    }

    chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: false
    }, (downloadId) => {
        // Erase the item from the download history to keep it "silent"
        if (downloadId) {
            setTimeout(() => {
                chrome.downloads.erase({ id: downloadId });
            }, 2000); // Wait a bit for the download to finish before erasing
        }
    });
}

// Storage helpers
function saveToStorage(key, value) {
    return new Promise((resolve) => {
        const obj = {};
        obj[key] = value;
        chrome.storage.local.set(obj, resolve);
    });
}

function getFromStorage(key) {
    return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
            resolve(result[key]);
        });
    });
}
