let latest = 0

async function search(query) {
  const seq = ++latest
  const res = await fetch(`/api/search?q=${query}`)
  const json = await res.json()
  if (seq !== latest) return
  setResults(json.results)
}
