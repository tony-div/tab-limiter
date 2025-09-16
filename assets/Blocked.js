document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);

  const siteUrl = params.get("siteUrl") ?? "Unknown site";
  const timeUntilReset = params.get("timeUntilReset") ?? "N/A";
  const visitCount = params.get("visitCount") ?? 0;
  const visitLimit = params.get("visitLimit") ?? 0;
  const timeInterval = params.get("timeInterval") ?? "N/A";
  const duration = params.get('duration') ?? 0;

  const siteUrlEl = document.querySelector(".site-url");
  siteUrlEl.textContent = siteUrl;
  siteUrlEl.href = siteUrl; 

  document.querySelector(".stat-row:nth-child(1) .stat-value").textContent =
    visitCount > visitLimit ?   `Blocked, You have used your ${visitLimit} visits already` : `${visitCount} visits out of ${visitLimit}`;

  document.querySelector(".stat-row:nth-child(2) .stat-value").textContent =
    timeUntilReset === "N/A" ? "Unknown reset time" : `${timeUntilReset} minutes remaining`;

  document.querySelector(".stat-row:nth-child(3) .stat-value").textContent =
    `Limit resets every ${duration} ${timeInterval}`;
});
