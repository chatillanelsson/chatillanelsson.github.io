// scraper.js - Del 5: egen bransch (Reklambyrå), 125 företag i reklambyra.csv
//
// Kräver: npm install cheerio
// Kör med: node scraper.js

const cheerio = require("cheerio");
const fs = require("fs");

const BASE_URL = "https://www.allabolag.se/bransch-s%C3%B6k?q=Reklambyr%C3%A5";
const PAGE_URLS = [
  BASE_URL,
  `${BASE_URL}&page=2`,
  `${BASE_URL}&page=3`,
  `${BASE_URL}&page=4`,
  `${BASE_URL}&page=5`,
];

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function csvField(value) {
  const text = (value ?? "").toString();
  return `"${text.replace(/"/g, '""')}"`;
}

function parseCard($, card) {
  const $card = $(card);
  const name = $card.find("h2 a").first().text().trim();

  let orgNr = "";
  let phone = "";
  let address = "";

  $card.find(".CardHeader-propertyList").each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();

    if ($el.hasClass("CardHeader-phone")) {
      const value = text.replace(/^Telefon\s*/i, "").trim();
      phone = /\d/.test(value) ? value : "";
    } else if (/^Org\.?nr/i.test(text)) {
      orgNr = text.replace(/^Org\.?nr\s*/i, "").trim();
    } else if (text) {
      address = text;
    }
  });

  return { name, orgNr, phone, address };
}

async function scrapePage(url) {
  const response = await fetch(url, {
    headers: HEADERS,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Sidan svarade med status ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const results = [];
  $(".SearchResultCard-card").each((_, card) => {
    const data = parseCard($, card);
    if (data.name) results.push(data);
  });
  return results;
}

function saveToCsv(rows, filename = "reklambyra.csv") {
  const header = ["Foretagsnamn", "Organisationsnummer", "Telefon", "Adress"];
  const lines = [header.map(csvField).join(",")];

  for (const row of rows) {
    lines.push(
      [row.name, row.orgNr, row.phone, row.address].map(csvField).join(",")
    );
  }

  fs.writeFileSync(filename, lines.join("\n") + "\n", "utf-8");
}

async function main() {
  const allCompanies = [];
    for (let i = 0; i < PAGE_URLS.length; i++) {
    const url = PAGE_URLS[i];
    const pageNumber = i + 1;

    try {
      const companies = await scrapePage(url);
      console.log(`Sida ${pageNumber}: hittade ${companies.length} företag.`);
      allCompanies.push(...companies);
    } catch (err) {
      console.error(`Sida ${pageNumber} gav ett fel: ${err.message}`);
    }

    if (i < PAGE_URLS.length - 1) {
      await delay(500);
    }
  }

  saveToCsv(allCompanies);
  console.log(
    `Klart! Totalt ${allCompanies.length} företag sparade i reklambyra.csv`
  );
}

main().catch((err) => console.error("Något gick fel:", err.message));