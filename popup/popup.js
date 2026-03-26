document.getElementById('downloadJson').addEventListener('click', () => {
    triggerDownload('json');
});

document.getElementById('downloadCsv').addEventListener('click', () => {
    triggerDownload('csv');
});

function triggerDownload(format) {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const activeTab = tabs[0];
        if (!activeTab || !activeTab.url.includes('atlassian.net')) {
            alert('Please navigate to a Jira issue page first.');
            return;
        }

        try {
            const url = new URL(activeTab.url);
            const domain = url.hostname;
            const keyMatch = url.pathname.match(/\/browse\/([A-Z0-9-]+)/);

            if (!keyMatch) {
                alert('Could not find an issue key in the URL. Please open a Jira issue.');
                return;
            }

            const issueKey = keyMatch[1];
            const issueUrl = `https://${domain}/browse/${issueKey}`;
            const apiUrl = `https://${domain}/rest/api/3/issue/${issueKey}?fields=summary,description,status,customfield_10014,reporter`;

            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`API Request failed with status ${response.status}`);
            }

            const rawData = await response.json();
            const processedData = processJiraData(rawData, issueUrl);

            if (format === 'json') {
                downloadJson(processedData);
            } else {
                downloadCsv(processedData);
            }
        } catch (error) {
            console.error('Extraction Error:', error);
            alert('Failed to extract data via Jira API. Make sure you are logged in and on a Jira issue page.\n\nError: ' + error.message);
        }
    });
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

/**
 * Very basic converter for Atlassian Document Format (ADF) to Plain Text
 */
function adfToText(adf) {
    if (!adf || !adf.content) return "No description provided.";

    let text = "";

    function traverse(node) {
        if (node.text) {
            text += node.text;
        }
        if (node.type === 'hardBreak') {
            text += "\n";
        }
        if (node.content) {
            node.content.forEach(traverse);
        }
        if (node.type === 'paragraph' || node.type === 'listItem') {
            text += "\n";
        }
    }

    adf.content.forEach(traverse);
    return text.trim();
}

function downloadJson(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const filename = `${data.key || 'issue'}.json`;

    chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: true
    });
}

function downloadCsv(data) {
    const headers = Object.keys(data).join(',');
    const row = Object.values(data).map(val => {
        const stringVal = (val || "").toString();
        return `"${stringVal.replace(/"/g, '""')}"`;
    }).join(',');
    const csvContent = `${headers}\n${row}`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const filename = `${data.key || 'issue'}.csv`;

    chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: true
    });
}
