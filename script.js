let sampleFn = null, downloadsCap = null;
(async () => {
  try { sampleFn = await claude.use("sample"); } catch(e){}
  try { downloadsCap = await claude.use("downloads"); } catch(e){}
})();

const THEMES = {
  forest:{sky:"#2f5d3a",ground:"#1e3d26",accent:"#8fbf6b"},
  space:{sky:"#0a0e2e",ground:"#1a1147",accent:"#7fd6ff"},
  school:{sky:"#e8c15a",ground:"#c98f3a",accent:"#fff3d0"},
  city:{sky:"#3a4258",ground:"#23283a",accent:"#f2a65a"}
};

function panelSVG(setting, tone, style, panelNum){
  const t = THEMES[setting] || THEMES.forest;
  const sat = tone === "funny" || tone === "light-hearted" ? 1.15 : 0.9;
  const outline = style === "anime" ? 3 : style === "pixel art" ? 0 : style === "comic book" ? 4 : 1.5;
  const rects = style === "pixel art";
  let shapes = "";
  const seed = panelNum * 37;
  for(let i=0;i<5;i++){
    const x = (seed*i*13)%360 + 20, y = 40 + ((seed*i*7)%140);
    const r = 14 + (i*9)%30;
    shapes += rects
      ? `<rect x="${x}" y="${y}" width="${r}" height="${r}" fill="${t.accent}" opacity="0.7"/>`
      : `<circle cx="${x}" cy="${y}" r="${r}" fill="${t.accent}" opacity="0.55"/>`;
  }
  const dots = style === "comic book" ? `<pattern id="dots${panelNum}" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.1" fill="#000" opacity="0.15"/></pattern><rect width="400" height="220" fill="url(#dots${panelNum})"/>` : "";
  return `<svg viewBox="0 0 400 220" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g${panelNum}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${t.sky}"/><stop offset="100%" stop-color="${t.ground}"/>
    </linearGradient></defs>
    <rect width="400" height="220" fill="url(#g${panelNum})"/>
    ${shapes}
    ${dots}
    <rect x="1" y="1" width="398" height="218" fill="none" stroke="#000" stroke-width="${outline}"/>
    <text x="14" y="204" font-family="Georgia,serif" font-size="15" fill="#fff" opacity="0.85">Panel ${panelNum}</text>
  </svg>`;
}

function setStatus(msg){ document.getElementById('status').textContent = msg; }

async function generateComic(){
  const prompt = document.getElementById('prompt').value.trim();
  const character = document.getElementById('character').value.trim() || "the hero";
  const setting = document.getElementById('setting').value;
  const tone = document.getElementById('tone').value;
  const artstyle = document.getElementById('artstyle').value;
  if(!prompt){ setStatus("Please enter a story prompt."); return; }

  const btn = document.getElementById('genBtn');
  btn.disabled = true;
  document.getElementById('preview').classList.add('hidden');
  document.getElementById('successCard').classList.add('hidden');

  let panels;
  if(sampleFn){
    setStatus("Generating outline and narration...");
    try {
      const req = `Write a 5-panel comic story. Story prompt: "${prompt}". Main character: ${character}. Setting: ${setting}. Tone: ${tone}. Art style: ${artstyle}.
Return ONLY JSON: {"panels":[{"number":1,"title":"","scene":"one sentence scene description","caption":"short ambient caption","narration":"1-2 sentences of narration or dialogue"}]} with exactly 5 panels, numbered 1-5.`;
      const result = await sampleFn.json(req, {modelTier:"quick"});
      panels = result.panels;
    } catch(e){ setStatus("Generation hit an error, showing a fallback story."); }
  }
  if(!panels || !panels.length){
    panels = [1,2,3,4,5].map(n => ({number:n, title:`Panel ${n}`,
      scene:`${character} continues the journey through the ${setting}.`,
      caption:`The ${setting} holds its breath.`,
      narration:`${character} presses onward, ${tone === "funny" ? "tripping over nothing in particular." : "heart pounding with purpose."}`}));
  }

  setStatus("");
  const preview = document.getElementById('preview');
  preview.innerHTML = panels.map(p => `
    <div class="panel">
      ${panelSVG(setting, tone, artstyle, p.number)}
      <div class="panel-body">
        <p class="panel-title">Panel ${p.number}: ${p.title || ""}</p>
        <p class="scene">${p.scene || ""}</p>
        <p class="narration">${p.narration || ""}</p>
        <p class="caption">${p.caption || ""}</p>
      </div>
    </div>`).join('') +
    `<div class="actions"><button onclick="exportPDF()">Download Your Comic as PDF</button>
     <button class="secondary" onclick="reset()">Start Over</button></div>`;
  preview.classList.remove('hidden');
  btn.disabled = false;
  preview.dataset.panels = JSON.stringify(panels);
}

function svgToPngDataUrl(svgEl, w, h){
  return new Promise((resolve) => {
    const xml = new XMLSerializer().serializeToString(svgEl);
    const svg64 = btoa(unescape(encodeURIComponent(xml)));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = 'data:image/svg+xml;base64,' + svg64;
  });
}

async function exportPDF(){
  const panels = JSON.parse(document.getElementById('preview').dataset.panels || "[]");
  const svgEls = document.querySelectorAll('#preview svg');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:"pt", format:"a4"});
  for(let i=0;i<panels.length;i++){
    if(i>0) doc.addPage();
    const png = await svgToPngDataUrl(svgEls[i], 400, 220);
    doc.setFont("times","bold"); doc.setFontSize(16);
    doc.text(`Panel ${panels[i].number}: ${panels[i].title||""}`, 40, 50);
    doc.addImage(png, "PNG", 40, 65, 500, 275);
    doc.setFont("times","italic"); doc.setFontSize(11);
    doc.text(doc.splitTextToSize(panels[i].scene||"", 500), 40, 360);
    doc.setFont("times","normal"); doc.setFontSize(12);
    doc.text(doc.splitTextToSize(panels[i].narration||"", 500), 40, 400);
  }
  const filename = `comiccraft_${Date.now()}.pdf`;
  const blob = doc.output('blob');
  if(downloadsCap){
    try{ await downloadsCap.save({filename, data: blob}); }
    catch(e){ doc.save(filename); }
  } else {
    doc.save(filename);
  }
  document.getElementById('preview').classList.add('hidden');
  document.getElementById('successCard').classList.remove('hidden');
}

function reset(){
  document.getElementById('preview').classList.add('hidden');
  document.getElementById('successCard').classList.add('hidden');
  document.getElementById('formCard').scrollIntoView({behavior:"smooth"});
}
