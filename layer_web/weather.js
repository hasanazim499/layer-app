state.sky = state.sky || "clear";
state.windKmh = state.windKmh || 0;
state.code = state.code || 0;
function wmoSky(code, wind) {
  if ([95, 96, 99].includes(code)) return "thunder";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  if ([45, 48].includes(code)) return "fog";
  if (code === 3) return "cloudy";
  if (code === 1 || code === 2) return "partly";
  if (wind >= 30) return "windy";
  return "clear";
}
async function fetchWeather() {
  const pos = await new Promise((res) => {
    if (!navigator.geolocation) return res({ lat: 28.98, lon: 77.7 });
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => res({ lat: 28.98, lon: 77.7 }),
      { timeout: 4000 }
    );
  });
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${pos.lat}&longitude=${pos.lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation&timezone=auto`;
  const d = await fetch(url).then((r) => r.json());
  const c = d.current || {};
  state.tempC = Math.round(c.temperature_2m ?? state.tempC);
  state.humid = (c.relative_humidity_2m ?? 60) >= 60;
  state.windKmh = c.wind_speed_10m ?? 0;
  state.code = c.weather_code ?? 0;
  state.sky = wmoSky(state.code, state.windKmh);
  if (state.sky === "clear" && state.humid && state.tempC <= 22 && state.tempC >= 8) state.sky = "haze";
  state.weather = weatherBucket(state.tempC, state.humid);
}
const _familyOk = familyOkWeather;
familyOkWeather = function (p, w) {
  const base = _familyOk(p, w);
  const f = (p.family || "").toLowerCase();
  const sky = state.sky;
  if ((sky === "rain" || sky === "thunder") && /gourmand|vanilla/.test(f)) return false;
  if (sky === "snow" && /aquatic|ozonic/.test(f)) return false;
  return base;
};
const _fit = weatherFitScore;
weatherFitScore = function (p, w) {
  let s = _fit(p, w);
  const f = (p.family || "").toLowerCase();
  const sky = state.sky;
  if ((sky === "rain" || sky === "thunder") && /citrus|fresh|green|aquatic/.test(f)) s += 4;
  if (sky === "snow" && /oriental|oud|amber|vanilla|woody/.test(f)) s += 4;
  if (sky === "fog" && /woody|musk|oriental/.test(f)) s += 3;
  if (sky === "windy" && intensityOf(p) >= 2) s += 2;
  if (sky === "haze" && /citrus|fresh|green/.test(f)) s += 3;
  return s;
};
const _enter = enterApp;
enterApp = async function () {
  try { await fetchWeather(); } catch (_) {}
  _enter();
};
