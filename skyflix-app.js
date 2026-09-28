/* SkyFlix live: hämtar vädret från Open-Meteo och föreslår filmer enligt prototypens matchningslogik */
(function () {
  var FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
  var GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
  var DEFAULT_PLACE = { name: 'Stockholm', region: 'Stockholms län', lat: 59.3293, lon: 18.0686 };

  /* Matchningslogiken från pappersprototypen */
  var MOODS = {
    sun: {
      icon: '☀️', label: 'Soligt och varmt', genre: 'Komedi / Äventyr',
      films: [
        { title: 'Mamma Mia!', year: 2008, text: 'Ett bröllop på en grekisk ö, tre möjliga pappor och ABBA-låtar.' },
        { title: 'Paddington 2', year: 2017, text: 'Björnen Paddington jagar en tjuv för att rentvå sitt namn.' },
        { title: 'Jurassic Park', year: 1993, text: 'En nöjespark med levande dinosaurier går helt fel.' },
        { title: 'The Grand Budapest Hotel', year: 2014, text: 'En hotellconcierge och hans piccolo jagas efter en stulen tavla.' },
        { title: 'Back to the Future', year: 1985, text: 'Marty hamnar i 1955 med en tidsmaskin byggd av en DeLorean.' },
        { title: 'Top Gun: Maverick', year: 2022, text: 'Maverick återvänder för att träna en ny generation stridspiloter.' }
      ]
    },
    cool: {
      icon: '☁️', label: 'Mulet och svalt', genre: 'Drama / Romantik',
      films: [
        { title: 'Before Sunrise', year: 1995, text: 'Två främlingar möts på ett tåg och tillbringar en natt i Wien.' },
        { title: 'Pride & Prejudice', year: 2005, text: 'Elizabeth Bennet och Mr Darcy i Jane Austens klassiker.' },
        { title: 'La La Land', year: 2016, text: 'En jazzpianist och en skådespelerska faller för varandra i Los Angeles.' },
        { title: 'Notting Hill', year: 1999, text: 'En bokhandlare i London blir kär i en världsberömd filmstjärna.' },
        { title: 'The Notebook', year: 2004, text: 'En kärlekshistoria som berättas ur en gammal anteckningsbok.' },
        { title: 'Past Lives', year: 2023, text: 'Två barndomsvänner från Seoul återses efter tjugo år.' }
      ]
    },
    rain: {
      icon: '🌧️', label: 'Regn', genre: 'Drama / Familj',
      films: [
        { title: 'Little Women', year: 2019, text: 'Fyra systrar March växer upp i 1860-talets Massachusetts.' },
        { title: 'The Shawshank Redemption', year: 1994, text: 'Vänskap och hopp bakom murarna på ett fängelse.' },
        { title: 'Wonder', year: 2017, text: 'Auggie börjar i vanlig skola för första gången.' },
        { title: 'Forrest Gump', year: 1994, text: 'En godhjärtad man råkar vara med om decennier av amerikansk historia.' },
        { title: 'Good Will Hunting', year: 1997, text: 'Ett matematiskt geni som arbetar som städare får hjälp av en terapeut.' },
        { title: 'Coco', year: 2017, text: 'Miguel hamnar i de dödas rike under Día de Muertos.' }
      ]
    },
    storm: {
      icon: '⛈️', label: 'Åska och storm', genre: 'Skräck / Thriller',
      films: [
        { title: 'The Silence of the Lambs', year: 1991, text: 'FBI-aspiranten Clarice Starling söker hjälp av Hannibal Lecter.' },
        { title: 'Get Out', year: 2017, text: 'Ett besök hos flickvännens föräldrar blir allt obehagligare.' },
        { title: 'A Quiet Place', year: 2018, text: 'En familj överlever genom att aldrig låta ett ljud höras.' },
        { title: 'Gone Girl', year: 2014, text: 'En kvinna försvinner och hennes man blir huvudmisstänkt.' },
        { title: 'The Shining', year: 1980, text: 'En vinter som vaktmästare på ett isolerat hotell i bergen.' },
        { title: 'Jaws', year: 1975, text: 'En vithaj skrämmer livet ur en amerikansk badort.' }
      ]
    },
    snow: {
      icon: '❄️', label: 'Snö', genre: 'Animerat / Familj',
      films: [
        { title: 'Frozen', year: 2013, text: 'Anna ger sig ut för att hitta sin syster Elsa i ett evigt vinterlandskap.' },
        { title: 'Spirited Away', year: 2001, text: 'Chihiro hamnar i en förtrollad värld full av andar.' },
        { title: 'Toy Story', year: 1995, text: 'Leksakerna lever sitt eget liv när ingen ser på.' },
        { title: 'Up', year: 2009, text: 'En äldre man flyger iväg med sitt hus med hjälp av tusentals ballonger.' },
        { title: 'Klaus', year: 2019, text: 'En brevbärare och en ensam leksaksmakare på en frusen ö.' },
        { title: 'Home Alone', year: 1990, text: 'Kevin blir ensam kvar hemma över julen och får försvara huset.' }
      ]
    }
  };

  /* WMO-väderkoder som Open-Meteo använder */
  var WEATHER_TEXT = {
    0: 'Klart', 1: 'Mestadels klart', 2: 'Halvklart', 3: 'Mulet',
    45: 'Dimma', 48: 'Rimfrostdimma',
    51: 'Lätt duggregn', 53: 'Duggregn', 55: 'Tätt duggregn', 56: 'Underkylt duggregn', 57: 'Underkylt duggregn',
    61: 'Lätt regn', 63: 'Regn', 65: 'Kraftigt regn', 66: 'Underkylt regn', 67: 'Underkylt regn',
    71: 'Lätt snöfall', 73: 'Snöfall', 75: 'Kraftigt snöfall', 77: 'Snökorn',
    80: 'Regnskurar', 81: 'Regnskurar', 82: 'Kraftiga regnskurar',
    85: 'Snöbyar', 86: 'Kraftiga snöbyar',
    95: 'Åska', 96: 'Åska med hagel', 99: 'Åska med hagel'
  };

  function pickMood(code, temp) {
    if (code >= 95) return 'storm';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
    if (code <= 2 && temp >= 15) return 'sun';
    return 'cool';
  }

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    form: $('sf-search'), input: $('sf-city'), geoBtn: $('sf-geo'), status: $('sf-status'),
    result: $('sf-result'), place: $('sf-place'), icon: $('sf-icon'), temp: $('sf-temp'),
    desc: $('sf-desc'), details: $('sf-details'), mood: $('sf-mood'), genre: $('sf-genre'),
    films: $('sf-films'), more: $('sf-more'), updated: $('sf-updated')
  };
  if (!els.form) return;

  var state = { mood: null, shown: [] };

  function setStatus(text, isError) {
    els.status.textContent = text || '';
    els.status.classList.toggle('is-error', !!isError);
  }

  function track(event, extra) {
    window.dataLayer = window.dataLayer || [];
    var data = { event: event };
    for (var k in extra) data[k] = extra[k];
    window.dataLayer.push(data);
  }

  function fetchJson(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  function loadWeather(place) {
    setStatus('Hämtar vädret för ' + place.name + '…');
    els.result.classList.add('is-loading');
    var url = FORECAST_URL + '?latitude=' + place.lat + '&longitude=' + place.lon +
      '&current=temperature_2m,apparent_temperature,weather_code,cloud_cover,precipitation,wind_speed_10m' +
      '&wind_speed_unit=ms&timezone=auto';
    return fetchJson(url).then(function (data) {
      render(place, data.current);
      setStatus('');
      track('skyflix_weather', { skyflix_place: place.name, skyflix_mood: state.mood });
    }).catch(function () {
      setStatus('Kunde inte hämta vädret just nu. Försök igen om en stund.', true);
    }).then(function () {
      els.result.classList.remove('is-loading');
    });
  }

  function render(place, c) {
    var code = c.weather_code;
    var temp = Math.round(c.temperature_2m);
    var moodKey = pickMood(code, c.temperature_2m);
    var mood = MOODS[moodKey];
    var fmt = function (n) { return String(n).replace('.', ','); };

    els.place.textContent = place.region ? place.name + ', ' + place.region : place.name;
    els.icon.textContent = mood.icon;
    els.temp.textContent = temp + '°';
    els.desc.textContent = WEATHER_TEXT[code] || 'Okänt väder';
    els.details.innerHTML =
      '<li><span>Känns som</span><b>' + Math.round(c.apparent_temperature) + '°</b></li>' +
      '<li><span>Moln</span><b>' + c.cloud_cover + ' %</b></li>' +
      '<li><span>Nederbörd</span><b>' + fmt(c.precipitation) + ' mm</b></li>' +
      '<li><span>Vind</span><b>' + fmt(Math.round(c.wind_speed_10m * 10) / 10) + ' m/s</b></li>';
    els.mood.textContent = mood.label;
    els.genre.textContent = mood.genre;
    els.updated.textContent = 'Uppdaterat ' + c.time.slice(11, 16) + ' lokal tid';

    if (state.mood !== moodKey) state.shown = [];
    state.mood = moodKey;
    showFilms();
    els.result.hidden = false;
  }

  function showFilms() {
    var films = MOODS[state.mood].films;
    var pool = films.filter(function (f) { return state.shown.indexOf(f.title) === -1; });
    if (pool.length < 3) {
      // alla har visats: börja om, men upprepa inte de tre som syns just nu
      state.shown = state.current || [];
      pool = films.filter(function (f) { return state.shown.indexOf(f.title) === -1; });
      state.shown = [];
    }
    var picks = [];
    while (picks.length < 3) {
      picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    picks.forEach(function (f) { state.shown.push(f.title); });
    state.current = picks.map(function (f) { return f.title; });

    els.films.innerHTML = picks.map(function (f, i) {
      return '<li class="sf-film" style="--i:' + i + '">' +
        '<span class="sf-film-num">0' + (i + 1) + '</span>' +
        '<h4>' + f.title + '</h4>' +
        '<p class="sf-film-year">' + f.year + '</p>' +
        '<p>' + f.text + '</p>' +
        '</li>';
    }).join('');
  }

  els.form.addEventListener('submit', function (e) {
    e.preventDefault();
    var q = els.input.value.trim();
    if (!q) return;
    setStatus('Söker efter ' + q + '…');
    fetchJson(GEOCODE_URL + '?name=' + encodeURIComponent(q) + '&count=1&language=sv&format=json')
      .then(function (data) {
        var r = data.results && data.results[0];
        if (!r) { setStatus('Hittade ingen ort som heter ”' + q + '”. Prova en annan stavning.', true); return; }
        loadWeather({ name: r.name, region: r.admin1 || r.country, lat: r.latitude, lon: r.longitude });
      })
      .catch(function () { setStatus('Sökningen fungerar inte just nu. Försök igen om en stund.', true); });
  });

  els.geoBtn.addEventListener('click', function () {
    if (!navigator.geolocation) { setStatus('Din webbläsare kan inte dela position. Sök på en ort i stället.', true); return; }
    setStatus('Väntar på din position…');
    track('skyflix_geo_click', {});
    navigator.geolocation.getCurrentPosition(function (pos) {
      loadWeather({
        name: 'Din position', region: '',
        lat: Math.round(pos.coords.latitude * 100) / 100,
        lon: Math.round(pos.coords.longitude * 100) / 100
      });
    }, function () {
      setStatus('Kunde inte hämta din position. Sök på en ort i stället.', true);
    }, { timeout: 10000, maximumAge: 600000 });
  });

  els.more.addEventListener('click', function () {
    showFilms();
    track('skyflix_more', { skyflix_mood: state.mood });
  });

  loadWeather(DEFAULT_PLACE);
})();
