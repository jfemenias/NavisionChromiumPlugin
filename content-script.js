/**
 * Jira Data Downloader - Content Script
 * Extracts data from the Jira issue page.
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractData") {
    const data = extractJiraData();
    sendResponse({ data: data });
  }
  return true;
});

function extractJiraData() {
  const issueData = {};

  // Selective selectors for Jira Cloud (common classes)
  // Summary
  const summaryElement = document.querySelector('h1[data-test-id="issue.views.issue-base.foundation.summary.heading"]');
  issueData.summary = summaryElement ? summaryElement.innerText.trim() : "N/A";

  // Issue Key
  const keyElement = document.querySelector('a[data-testid="issue.views.issue-base.foundation.breadcrumbs.current-issue.item"] span');
  issueData.key = keyElement ? keyElement.innerText.trim() : "N/A";

  // Status
  const statusElement = document.querySelector('div[data-testid="issue.views.issue-base.foundation.status.status-button-item"]');
  issueData.status = statusElement ? statusElement.innerText.trim() : "N/A";

  // Assignee
  const assigneeElement = document.querySelector('div[data-testid="issue.views.field.user.assignee--container"] div[role="img"]');
  issueData.assignee = assigneeElement ? assigneeElement.getAttribute("aria-label") : "Unassigned";

  // Description (simplified)
  const descriptionElement = document.querySelector('div[data-test-id="issue.views.field.rich-text.description"]');
  issueData.description = descriptionElement ? descriptionElement.innerText.trim() : "No description provided.";

  // Add more fields as needed (Priority, Type, Reporter, etc.)
  
  return issueData;
}
