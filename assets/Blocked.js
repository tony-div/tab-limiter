document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);

  const siteUrl = params.get("siteUrl");
  const timeUntilReset = params.get("timeUntilReset");
  const visitCount = params.get("visitCount");
  const visitLimit = params.get("visitLimit");
  const timeInterval = params.get("timeInterval");

  document.querySelector(".site-url").textContent = siteUrl;
  document.querySelector(".stat-row:nth-child(1) .stat-value").textContent = `${visitCount}/${visitLimit}`;
  document.querySelector(".stat-row:nth-child(2) .stat-value").textContent = `${timeUntilReset} minutes`;
  document.querySelector(".stat-row:nth-child(3) .stat-value").textContent = `Per ${timeInterval}`;
});
