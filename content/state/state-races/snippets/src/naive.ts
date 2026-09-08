async function search(query) {
  const res = await fetch(`/api/search?q=${query}`)
  const json = await res.json()
  setResults(json.results)
}
