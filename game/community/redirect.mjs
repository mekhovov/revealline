// Keep old directory bookmarks within the same local or frozen distribution.
const target = new URL('../communities/', location.href);
target.search = location.search;
target.hash = location.hash;
document.getElementById('communities-link').href = target.href;
location.replace(target.href);
