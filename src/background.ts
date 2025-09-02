/// <reference types="chrome"/>
chrome.tabs.onCreated.addListener((tab: chrome.tabs.Tab) => {
  console.log("opened", tab.url);
});
chrome.tabs.onUpdated.addListener((_id, _, tab: chrome.tabs.Tab) => {
  console.log("navigated", tab.url);
});
