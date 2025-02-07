const app = (() => {
  'use strict'

  let DB = []

  // Elements
  const youtube = document.getElementById('youtube')
  const fandango = document.getElementById('fandango')
  const tmdb = document.getElementById('tmdb')
  const search = document.getElementById('search')
  const lower = document.getElementById('lower')

  // Constants
  let posterResolution = 'low'
  let dbSort = 'initial'
  let sortOrder = 'asc'
  let excludeDisc = false

  // Event listeners
  search.addEventListener('input', () => filterDatabase())
  search.addEventListener('change', () => filterDatabase())

  const csvURI = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSWb4mFDqo7FZkh5ov5juVw8i06_BRmJ9RdSBn5NFSlAzj_QoMW9f_W-NBvOmOTSk2SMxKLugIvuk44/pub?gid=0&single=true&output=csv'
  const localStorageKey = 'db'

  const csvStrToJSON = (csvString) => {
    const arrayData = csvString.split('\r\n')
    const labels = arrayData[0].split(",")
    const regex = /"([^"]*)"|([^,]+)/
    return arrayData.slice(1).map(row => {
      const titleMatch = row.match(regex)
      const rowData = [titleMatch[1] || titleMatch[2], ...row.replace(titleMatch[0], "").split(",").slice(1)]
      return Object.fromEntries(labels.map((key, index) => [key, rowData[index]]))
    });
  }

  const filterDatabase = () => {
    const searchStr = search.value
    const regexString = RegExp(`.*(${searchStr.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')}).*`, "i")
    let filtered = DB.filter(movie => regexString.test(movie.title))
    filtered.length === 1 ? showButtons(filtered[0]) : clearButtons()
    populatePosters({db: filtered})
  }

  const clickPoster = (poster) => {
    search.value = poster.getAttribute('data-title')
    filterDatabase()
  }

  const showButtons = (movie) => {
    if (movie.YouTubeID) {
      youtube.href = `https://youtube.com/watch?v=${movie.YouTubeID}`
      youtube.classList.remove('disabled')
    }
    if (movie.FandangoID) {
      fandango.href = `https://athome.fandango.com/content/movies/play/${movie.FandangoID}/RESOLVE`
      fandango.classList.remove('disabled')
    }
    if (movie.tmdbID) {
      tmdb.href = `https://themoviedb.org/movie/${movie.tmdbID}`
      tmdb.classList.remove('disabled')
    }
  }

  const clearButtons = () => {
    youtube.removeAttribute('href')
    fandango.removeAttribute('href')
    youtube.classList.add('disabled')
    fandango.classList.add('disabled')
  }

  const makePoster = movie => `<div class="poster-div" data-title="${movie.title}" onclick="app.clickPoster(this)"><img loading="lazy" alt="movie poster" class="poster-img" src="https://image.tmdb.org/t/p/w${posterResolution === 'low' ? 2 : 5}00/${movie.img}.jpg"/></div>`
  const makeGallery = db => `<div class="gallery">${db.map(movie => makePoster(movie)).join('')}</div>`
  const groupLabel = text => `<div class="group-label"><div class="horizontal-bar"></div><div class="label-text">${text}</div><div class="horizontal-bar"></div></div>`

  const setPosterSizes = size => {
    const dimensions = {
      'xsmall': 100,
      'small': 150,
      'medium': 200,
      'large': 250,
      'xlarge': 300
    }
    const fontSizes = {
      'xsmall': 10,
      'small': 14,
      'medium': 18,
      'large': 22,
      'xlarge': 26
    }
    for (let sheet of document.styleSheets) {
      for (let rule of sheet.cssRules) {
        if (rule.selectorText === ".poster-div") {
          rule.style.width = dimensions[size] + "px"
          rule.style.height = dimensions[size] * 1.5 + "px"
          rule.style.fontSize = fontSizes[size] + "px"
        }
        if (rule.selectorText === ".poster-img") {
          rule.style.maxWidth = dimensions[size] + "px"
        }
      }
    }
  }

  const setPosterResolution = resolution => {
    posterResolution = resolution
    populatePosters({sort: dbSort})
  }

  const setExcludeDisc = exclude => {
    excludeDisc = exclude
    populatePosters({sort: dbSort})
  }

  const setSortOrder = order => {
    sortOrder = order
    populatePosters({sort: dbSort})
  }

  const populatePosters = ({db, sort}) => {
    if (!db) db = DB
    sort ? dbSort = sort : sort = dbSort  // assign or take the value of dbSort, depending on if sort was given
    if (excludeDisc) db = db.filter(movie => movie.FandangoID || movie.YouTubeID)
    if (sort === 'time') {
      const maxTimeStart = Math.floor(Math.max(...db.map(movie => movie.time)) / 10 * 10)
      const timeIntervals = Array.from({length: maxTimeStart / 10 + 1}, (_, i) => i * 10)
      if (sortOrder === 'desc') timeIntervals.reverse()
      lower.innerHTML = timeIntervals
        .map(time => {
          let filteredDb = db.filter(movie => movie.time >= time && movie.time < time + 10)
          return filteredDb.length === 0 ? '' : `${groupLabel(`${time} - ${time + 10} Minutes`)}${makeGallery(filteredDb)}`
        })
        .join('')
      return
    }
    if (sort === 'year') {
      db.sort((a, b) => a.Year - b.Year)
      const uniqueYears = [...new Set(db.map(movie => movie.Year))]
      if (sortOrder === 'desc') uniqueYears.reverse()
      lower.innerHTML = uniqueYears
        .map(year => {
          let filteredDb = db.filter(movie => movie.Year === year)
          return filteredDb.length === 0 ? '' : `${groupLabel(year)}${makeGallery(filteredDb)}`
        })
        .join('')
      return
    }
    if (sort === 'name') {
      db.sort((a, b) => a.title.localeCompare(b.title))
      if (sortOrder === 'desc') db.reverse()
    }
    if (sort === 'purchase') {
      db.sort((a, b) => new Date(a.PurchaseDate) - new Date(b.PurchaseDate))
      if (sortOrder === 'desc') db.reverse()
      db.sort((a, b) => a.PurchaseDate === '' ? 1 : b.PurchaseDate === '' ? -1 : 0)
    }
    lower.innerHTML = makeGallery(db)
  }

  const fetchDataBase = () => {
    if (localStorage.getItem(localStorageKey)) {
      const dbTimestamp = localStorage.getItem('dbTimestamp')
      if ((Date.now() - dbTimestamp < 5 * 24 * 60 * 60 * 1000)) {
        DB = JSON.parse(localStorage.getItem(localStorageKey))
        return Promise.resolve(DB)
      } else {
        localStorage.removeItem(localStorageKey)
        localStorage.removeItem('dbTimestamp')
      }
    }
    return fetch(csvURI)
      .then(res => res.text())
      .then(csvData => csvStrToJSON(csvData))
      .then(db => {
        localStorage.setItem(localStorageKey, JSON.stringify(db))
        localStorage.setItem('dbTimestamp', Date.now())
        DB = db
        return db
      })
      .catch(() => alert("Unable to retrieve Movie Database"))
  }

  if (window.innerWidth < 600) {
    setPosterSizes('xsmall');
    document.getElementById('xsmall').checked = true
  }
  fetchDataBase().then(db => populatePosters(db)).then(() => search.placeholder = `Search for a movie... (${DB.length})`)

  const clearCache = () => {
    lower.innerHTML = ''
    search.value = ''
    localStorage.removeItem(localStorageKey)
    localStorage.removeItem('dbTimestamp')
    fetchDataBase().then(db => populatePosters(db)).then(() => search.placeholder = `Search for a movie... (${DB.length})`)
  }

  const closeModal = referringElement => {
    const targetDiv = referringElement.closest('.modal-wrapper')
    targetDiv.classList.toggle('show')
    targetDiv.classList.toggle('hide')
  }

  const openModal = targetElement => {
    const targetDiv = document.getElementById(targetElement)
    targetDiv.classList.toggle('show')
    targetDiv.classList.toggle('hide')
  }

  const clearSearch = () => {
    search.value = ''
    filterDatabase()
  }

  return {
    clickPoster,
    populatePosters,
    setPosterSizes,
    setPosterResolution,
    setSortOrder,
    setExcludeDisc,
    clearCache,
    closeModal,
    openModal,
    clearSearch,
  }
})()
window.app = app
