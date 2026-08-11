import axios from 'axios'
async function run() {
    const response = await axios.post('https://graphql.anilist.co', {
        query: `query { Page(page: 1, perPage: 1) { media(search: "Kimi ga Shinu made Koi wo Shitai", type: ANIME, sort: SEARCH_MATCH) { idMal title { romaji } } } }`
    }, { headers: { 'Content-Type': 'application/json' } })
    console.log(JSON.stringify(response.data, null, 2))
}
run()
