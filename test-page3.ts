import { scrapeOngoing } from './src/scrapers/otakudesu'

async function run() {
    console.log("Scraping page 3...")
    const data = await scrapeOngoing(3)
    const nulls = data.filter(d => !d.mal).map(d => d.title)
    console.log("Nulls:", nulls.length, "Total:", data.length)
}
run()
