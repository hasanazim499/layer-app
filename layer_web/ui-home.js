const VIBES=[{id:"warm",label:"Warm & Spicy"},{id:"romantic",label:"Floral & Soft"},{id:"slow",label:"Fresh & Clean"},{id:"adventure",label:"Woody & Deep"},{id:"elevated",label:"Oriental & Rich"}];
const PHOTOS=[
"https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=400&q=80",
"https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=400&q=80",
"https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=400&q=80",
"https://images.unsplash.com/photo-1615634260167-c8cdede054de?auto=format&fit=crop&w=400&q=80",
"https://images.unsplash.com/photo-1587017539504-67cfbddac569?auto=format&fit=crop&w=400&q=80",
"https://images.unsplash.com/photo-1547887538-e3a2f32cb1cc?auto=format&fit=crop&w=400&q=80"
];
const KNOWN={
"chanel no 5":"https://upload.wikimedia.org/wikipedia/commons/9/9d/Chanel_No._5_Fragrance_Austin_Calhoon_Photograph.jpg",
"bleu de chanel":"https://upload.wikimedia.org/wikipedia/en/4/4f/Bleu_de_Chanel%2C_eau_de_toilette.jpg",
"dior sauvage":"https://upload.wikimedia.org/wikipedia/commons/4/4f/Eau_Sauvage_Christian_Dior.jpg"
};
function keyOf(p){return ((p.brand||"")+" "+(p.name||"")).toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}
hash=function(s){let n=0;for(const c of s)n=(n*31+c.charCodeAt(0))>>>0;return n}
function fallbackPhoto(p){return PHOTOS[hash(keyOf(p))%PHOTOS.length]}
function bottleSrc(p){const k=keyOf(p);for(const [name,url] of Object.entries(KNOWN)){if(k.includes(name))return url}return fallbackPhoto(p)}
function firstName(){const e=(state.email||"").split("@")[0].replace(/[^a-zA-Z].*/,"")||"there";return e.charAt(0).toUpperCase()+e.slice(1)}
function partOfDay(){const h=new Date().getHours();return h<12?"morning":h<17?"afternoon":"evening"}
function weatherLine(){const w=state.weather;if(w==="hot")return "It's humid and sunny. Try something fresh.";if(w==="cold")return "It's cold out. Reach for something rich.";if(w==="cool")return "Cool air today. Something woody will sit well.";return "Mild day. A balanced layer will do."}
function matchPct(p){const s=typeof weatherFitScore==="function"?weatherFitScore(p,state.weather):8;return Math.max(18,Math.min(96,40+s*6))}
function notesShort(p){const n=[...(p.top||[]),...(p.heart||[])].slice(0,2);return n.length?n.join(" & "):(p.family||"")}
function journeyCard(p,when){const pct=matchPct(p);const src=bottleSrc(p);return `<button class="journey" onclick="openDetail('${p.id}')"><div class="journey-thumb"><img alt="${p.name}" src="${src}" onerror="this.src='${PHOTOS[0]}'"></div><div class="journey-body"><h4>${p.name}</h4><div class="journey-meta">${when} · ${state.weather} · ${notesShort(p)}</div><div class="bar"><i style="width:${pct}%"></i></div><div class="match">${pct}% match</div></div></button>`}
function renderVibes(){const row=document.getElementById("vibe-row");if(!row)return;row.innerHTML=VIBES.map(v=>`<button class="vibe ${state.mood===v.id?"on":""}" onclick="setMood('${v.id}')">${v.label}</button>`).join("")}
function setMood(id){state.mood=state.mood===id?null:id;renderHome()}
function hydrateWiki(p,img){const title=encodeURIComponent((p.brand+" "+p.name).replace(/ /g,"_"));fetch("https://en.wikipedia.org/api/rest_v1/page/summary/"+title).then(r=>r.ok?r.json():null).then(d=>{if(!d||!d.thumbnail||!d.thumbnail.source)return;const t=(d.title||"").toLowerCase();if(t.includes((p.name||"").toLowerCase().split(" ")[0])||t.includes((p.brand||"").toLowerCase().split(" ")[0]))img.src=d.thumbnail.source}).catch(()=>{})}
function renderHome(){document.body.classList.remove("wx-hot","wx-mild","wx-cool","wx-cold");document.body.classList.add("wx-"+(state.weather||"mild"));const n=new Date();const clock=document.getElementById("clock");if(clock)clock.textContent=String(n.getHours()).padStart(2,"0")+":"+String(n.getMinutes()).padStart(2,"0");const greet=document.getElementById("home-greet");if(greet)greet.textContent=`Good ${partOfDay()}, ${firstName()}`;const wl=document.getElementById("weather-line");if(wl)wl.textContent=weatherLine();renderVibes();const layer=suggestLayer();const cards=document.getElementById("layer-cards");if(!cards)return;if(!layer||!layer.primary){cards.innerHTML=`<div class="glass" style="padding:16px"><p class="muted">${state.owned.size===0?"Add bottles in My Collection to get a layer.":"None of your bottles fit this weather."}</p></div>`;return}const html=[];html.push(journeyCard(layer.primary,"Morning Layer"));if(layer.support)html.push(journeyCard(layer.support,"Evening Layer"));cards.innerHTML=html.join("");cards.querySelectorAll(".journey").forEach((el,i)=>{const p=i===0?layer.primary:layer.support;const img=el.querySelector("img");if(p&&img)hydrateWiki(p,img)})}
if(document.getElementById("page-home")) renderHome();
