import fs from "fs";
import axios from "axios";
import Parser from "rss-parser";

const parser = new Parser();
const PORT = process.env.PORT || 3000;
const CHECK_INTERVAL = (process.env.CHECK_INTERVAL || 5) * 60 * 1000;

let feeds = JSON.parse(fs.readFileSync("./feeds.json", "utf8"));

async function checkFeed(feed) {
  try {
    const data = await parser.parseURL(feed.rss);
    const latest = data.items[0];

    if (!latest) return;

    if (feed.lastItem === latest.link) return;

    feed.lastItem = latest.link;
    saveFeeds();

    await axios.post(feed.webhook, {
      content: `**${feed.name} Update**\n${latest.title}\n${latest.link}`
    });

    console.log(`Sent update for ${feed.name}`);
  } catch (err) {
    console.error(`Error checking ${feed.name}:`, err.message);
  }
}

function saveFeeds() {
  fs.writeFileSync("./feeds.json", JSON.stringify(feeds, null, 2));
}

async function loop() {
  for (const feed of feeds) {
    await checkFeed(feed);
  }
}

setInterval(loop, CHECK_INTERVAL);
loop();

console.log(`RSS Webhook Forwarder running on port ${PORT}`);
