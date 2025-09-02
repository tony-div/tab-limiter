/// <reference types="chrome"/>
chrome.tabs.onCreated.addListener((tab: chrome.tabs.Tab) => {
  onNavigation(tab);
});
chrome.tabs.onUpdated.addListener((_id, _, tab: chrome.tabs.Tab) => {
  onNavigation(tab);
});

const onNavigation = (tab: chrome.tabs.Tab) => {
  console.log('current tab:', tab.url);
}