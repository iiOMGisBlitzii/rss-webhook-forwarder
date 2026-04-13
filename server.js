import fs from "fs";
import http from "http";
import axios from "axios";
import Parser from "rss-parser";

const parser = new Parser();

// Railway environment variables
const PORT = process.env.PORT || 3000;
const CHECK_INTERVAL_MINUTES = Number(process.env.CHECK_INTERVAL || 5);
const CHECK_INTERVAL = CHECK_INTERVAL_MINUTES * 60 * 1000;

// Path to feeds.json
const feedsPath = new URL("./feeds.json", import.meta.url).pathname;

// Load feeds
let feeds = [];
try {
  feeds = JSON.parse(fs.readFileSync(feedsPath, "utf8"));
  console.log(`Loaded ${feeds.length} feeds.`);
} catch (err) {
  console.error("Error loading feeds.json:", err.message);
  feeds = [];
}

// Save feeds (updates lastItem)
function saveFeeds() {
  try {
    fs.writeFileSync(feedsPath, JSON.stringify(feeds, null, 2));
  } catch (err) {
    console.error("Error writing feeds.json:", err.message);
  }
}

async function sendToWebhook(feed, item) {
  const content = `**${feed.name} Update**\n${item.title}\n${item.link || ""}`;

  try {
    await axios.post(feed.webhook, { content });
    console.log(`Sent update for "${feed.name}": ${item.title}`);
  } catch (err) {
    console.error(`Webhook error for "${feed.name}":`, err.message);
  }
}

async function checkFeed(feed) {
  try {
    const data = await parser.parseURL(feed.rss);
    const latest = data.items[0];
    if (!latest) return;

    const id = latest.link || latest.guid || latest.title;
    if (!id) return;

    if (feed.lastItem === id) return;

    feed.lastItem = id;
    saveFeeds();
    await sendToWebhook(feed, latest);
  } catch (err) {
    console.error(`Feed error (${feed.name}):`, err.message);
  }
}

async function checkAllFeeds() {
  console.log("Checking feeds...");
  for (const feed of feeds) {
    await checkFeed(feed);
  }
  console.log("Done.");
}

setInterval(checkAllFeeds, CHECK_INTERVAL);
checkAllFeeds();

// Minimal HTTP server for Railway
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("RSS Webhook Forwarder is running.\n");
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
