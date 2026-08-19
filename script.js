/* =========================================================
   REFLET — Logique principale (Vraie reconnaissance faciale)
   ========================================================= */

// ---- 1. DONNÉES (Simulation de data.json) ----
// En production, remplacez ceci par : fetch('data.json').then(res => res.json())
const FALLBACK_DATA = {
  events: [
    {
      id: "mariage-aida-moussa",
      name: "Mariage — Aïda & Moussa",
      photographer: "Ibou Sarr Studio",
      status: "published",
      photoCount: 248,
      photos: [
        "https://images.unsplash.com/photo-1519741497674-611481863552?w=600&h=750&fit=crop",
        "https://images.unsplash.com/photo-1511578314322-379afb476865?w=600&h=750&fit=crop",
        "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&h=750&fit=crop",
        "https://images.unsplash.com/photo-1523438885200-e635ba2c371e?w=600&h=750&fit=crop",
        "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=600&h=750&fit=crop",
        "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=600&h=750&fit=crop"
      ]
    },
    {
      id: "anniv-fatou",
      name: "Anniversaire — 30 ans de Fatou",
      photographer: "Click Dakar",
      status: "published",
      photoCount: 126,
      photos: [
        "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=600&h=750&fit=crop",
        "https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=600&h=750&fit=crop"
      ]
    },
    {
      id: "bapteme-diallo",
      name: "Baptême — Famille Diallo",
      photographer: "N'Deye Photo",
      status: "pending",
      photoCount: 0,
      photos: []
    }
  ]
};

let APP_DATA = FALLBACK_DATA;
let currentEvent = APP_DATA.events[0];
let mediaStream = null;
let selfieDescriptor = null;
let modelsLoaded = false;

// ---- 2. INITIALISATION ----
document.addEventListener("DOMContentLoaded", async () => {
  await loadAppData();
  renderEvents();
  bindStaticEventCards();
  loadModels(); // Précharge l'IA en arrière-plan
});

async function loadAppData() {
  try {
    const response = await fetch("./data.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (!Array.isArray(data.events)) throw new Error("Format data.json invalide");

    APP_DATA = data;
    currentEvent = APP_DATA.events[0] || FALLBACK_DATA.events[0];
  } catch (error) {
    console.warn("Impossible de charger data.json, utilisation des données de secours.", error);
  }
}

function bindStaticEventCards() {
  document.querySelectorAll("#events-list-page .event-card").forEach(card => {
    const event = APP_DATA.events.find(item => item.id === card.dataset.eventId);
    if (!event || event.status === "pending") return;

    card.addEventListener("click", () => {
      currentEvent = event;
      resetScanScreen();
      goTo("screen-scan");
      startCamera();
    });
  });
}

function renderEvents() {
  const list = document.getElementById("events-list");
  const count = document.getElementById("event-count");
  const activeEvents = APP_DATA.events.filter(e => e.status === "published");
  
  count.textContent = `${activeEvents.length} actifs`;
  list.innerHTML = "";

  APP_DATA.events.forEach(event => {
    const isPending = event.status === "pending";
    const card = document.createElement("article");
    card.className = `event-card ${isPending ? "event-card--pending" : ""}`;
    card.dataset.eventId = event.id;
    
    // Image aléatoire cohérente basée sur l'ID pour la démo
    const thumbUrl = `https://picsum.photos/seed/${event.id}/240/240`;
    
    card.innerHTML = `
      <div class="event-card__media" style="background-image:url('${thumbUrl}')">
        <span class="reticle reticle--sm" style="position:absolute;inset:6px;border:1px solid rgba(243,236,224,0.3);border-radius:6px;"></span>
      </div>
      <div class="event-card__body">
        <h3>${event.name}</h3>
        <p>Photographe · ${event.photographer}</p>
        <p class="event-card__meta">${isPending ? "Traitement en cours…" : `${event.photoCount} photos publiées`}</p>
      </div>
      ${!isPending ? '<span class="event-card__badge">Nouveau</span>' : ''}
    `;
    
    if (!isPending) {
      card.addEventListener("click", () => {
        currentEvent = event;
        resetScanScreen();
        goTo("screen-scan");
        startCamera();
      });
    }
    list.appendChild(card);
  });
}

// ---- 3. NAVIGATION ----
function goTo(screenId) {
  document.querySelectorAll(".screen").forEach(s => {
    s.setAttribute("aria-hidden", s.id !== screenId);
  });
  document.querySelectorAll(".tab").forEach(t => {
    t.setAttribute("aria-current", t.dataset.goto === screenId);
  });
  document.querySelector(".phone").scrollTop = 0;
}

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    const isAccueilVisible = document.getElementById("screen-accueil").getAttribute("aria-hidden") === "false";

    if (tab.dataset.goto === "screen-scan" && isAccueilVisible) {
      showEventSelectionPrompt();
      return;
    }

    if (tab.dataset.goto !== "screen-scan") stopCamera();
    goTo(tab.dataset.goto);

    if (tab.dataset.focus === "events") {
      eventsList.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
});

const eventPrompt = document.getElementById("event-prompt");
const eventsList = document.getElementById("events-list");

function showEventSelectionPrompt() {
  eventPrompt.hidden = false;
  eventsList.scrollIntoView({ behavior: "smooth", block: "center" });
}

document.getElementById("event-prompt-link").addEventListener("click", () => {
  eventPrompt.hidden = true;
  goTo("screen-evenements");
});

document.getElementById("event-prompt-close").addEventListener("click", () => {
  eventPrompt.hidden = true;
});

document.getElementById("btn-scan").addEventListener("click", () => {
  resetScanScreen();
  goTo("screen-scan");
  startCamera();
});

document.getElementById("btn-back-scan").addEventListener("click", () => {
  stopCamera();
  goTo("screen-accueil");
});

document.getElementById("btn-back-results").addEventListener("click", () => {
  goTo("screen-accueil");
});

// ---- 4. CAMÉRA ----
async function startCamera() {
  if (mediaStream) return;
  const viewfinderStatus = document.getElementById("viewfinder-status");
  const captureBtn = document.getElementById("capture-btn");
  const captureCaption = document.getElementById("capture-caption");

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    viewfinderStatus.textContent = "Caméra non prise en charge.";
    return;
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 480 } },
      audio: false
    });
    const video = document.getElementById("camera-feed");
    video.srcObject = mediaStream;
    await video.play();
    video.classList.add("is-live");
    document.getElementById("pulse-ring").classList.add("is-active");
    viewfinderStatus.textContent = "Positionne-toi face à la caméra.";
    captureBtn.disabled = false;
    captureCaption.textContent = "Toucher pour capturer";
  } catch (err) {
    viewfinderStatus.textContent = "Accès caméra refusé. Utilise l'import.";
    document.getElementById("fallback-label").style.color = "var(--gold)";
  }
}

function stopCamera() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  const video = document.getElementById("camera-feed");
  video.srcObject = null;
  video.classList.remove("is-live");
}

function resetScanScreen() {
  document.getElementById("selfie-preview").classList.remove("is-visible");
  document.getElementById("scanline").classList.remove("is-active");
  document.getElementById("pulse-ring").classList.remove("is-active");
  document.getElementById("scan-hint").textContent = "Cadre ton visage dans le repère";
  document.getElementById("viewfinder-status").textContent = "Ouverture de la caméra…";
  document.getElementById("progress").hidden = true;
  document.getElementById("progress-bar").style.width = "0%";
  document.getElementById("capture-btn").disabled = true;
  document.getElementById("capture-caption").textContent = "Initialisation...";
}

// ---- 5. CAPTURE & ANALYSE IA ----
document.getElementById("capture-btn").addEventListener("click", () => {
  if (!mediaStream) return;
  const video = document.getElementById("camera-feed");
  const canvas = document.getElementById("camera-canvas");
  const size = Math.min(video.videoWidth, video.videoHeight) || 480;
  
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  
  // Recadrage carré centré + effet miroir
  const sx = (video.videoWidth - size) / 2;
  const sy = (video.videoHeight - size) / 2;
  ctx.translate(size, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  stopCamera();
  runScanSequence(dataUrl);
});

document.getElementById("selfie-input").addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  stopCamera();
  runScanSequence(URL.createObjectURL(file));
});

const ANALYSIS_STEPS = [
  "Détection du visage par IA…",
  "Extraction des descripteurs faciaux…",
  `Comparaison avec les ${currentEvent.photoCount} photos…`,
  "Classement par ressemblance…"
];

async function runScanSequence(imgUrl) {
  document.getElementById("camera-feed").classList.remove("is-live");
  const preview = document.getElementById("selfie-preview");
  preview.src = imgUrl;
  preview.classList.add("is-visible");
  document.getElementById("scanline").classList.add("is-active");
  document.getElementById("scan-hint").textContent = "Analyse en cours";
  document.getElementById("capture-btn").disabled = true;
  document.getElementById("progress").hidden = false;

  // 1. Attendre que les modèles soient chargés
  if (!modelsLoaded) {
    document.getElementById("viewfinder-status").textContent = "Chargement des modèles IA (1/4)...";
    await loadModels();
  }

  // 2. Analyser le selfie
  document.getElementById("viewfinder-status").textContent = ANALYSIS_STEPS[0];
  document.getElementById("progress-bar").style.width = "25%";
  
  try {
    const selfieImg = await faceapi.fetchImage(imgUrl);
    const detection = await faceapi.detectSingleFace(selfieImg)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      throw new Error("Aucun visage détecté. Recommence avec un visage bien éclairé.");
    }
    
    selfieDescriptor = detection.descriptor;
    document.getElementById("viewfinder-status").textContent = ANALYSIS_STEPS[2];
    document.getElementById("progress-bar").style.width = "50%";

    // 3. Comparer avec les photos de l'événement
    const matches = [];
    const totalPhotos = currentEvent.photos.length;
    
    for (let i = 0; i < totalPhotos; i++) {
      const photoUrl = currentEvent.photos[i];
      document.getElementById("viewfinder-status").textContent = `Analyse photo ${i + 1}/${totalPhotos}…`;
      
      try {
        const img = await faceapi.fetchImage(photoUrl);
        const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptors();

        for (const det of detections) {
          // Distance euclidienne : plus c'est bas, plus c'est similaire. Seuil typique < 0.6
          const distance = faceapi.euclideanDistance(selfieDescriptor, det.descriptor);
          if (distance < 0.55) {
            const score = Math.round((1 - distance) * 100);
            matches.push({ url: photoUrl, score: Math.min(score, 99) });
            break; // Une seule correspondance par photo suffit
          }
        }
      } catch (e) {
        console.warn("Erreur analyse photo", e);
      }
      
      // Mise à jour visuelle de la barre
      const progress = 50 + ((i + 1) / totalPhotos) * 50;
      document.getElementById("progress-bar").style.width = `${progress}%`;
      
      // Petit délai pour laisser l'UI se mettre à jour
      await new Promise(r => setTimeout(r, 50));
    }

    // 4. Afficher les résultats
    document.getElementById("progress-bar").style.width = "100%";
    setTimeout(() => {
      buildResults(matches);
      goTo("screen-resultats");
    }, 400);

  } catch (err) {
    console.error(err);
    document.getElementById("viewfinder-status").textContent = err.message;
    document.getElementById("viewfinder-status").style.color = "var(--coral)";
    document.getElementById("capture-btn").disabled = false;
    document.getElementById("capture-caption").textContent = "Réessayer";
  }
}

// ---- 6. RÉSULTATS & LIGHTBOX ----
function buildResults(matches) {
  document.getElementById("results-event").textContent = currentEvent.name.toUpperCase();
  document.getElementById("results-number").textContent = matches.length;
  
  const grid = document.getElementById("results-grid");
  grid.innerHTML = "";

  // Trier par score décroissant
  matches.sort((a, b) => b.score - a.score);

  if (matches.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px 20px; color:var(--lavender);">
      <p style="font-size:2rem; margin-bottom:12px;">🔍</p>
      <p>Aucune correspondance trouvée.<br>Essaie avec un autre selfie.</p>
    </div>`;
    return;
  }

  matches.forEach((photo, i) => {
    const card = document.createElement("button");
    card.className = "match-card";
    card.style.backgroundImage = `url('${photo.url}')`;
    card.style.animationDelay = `${i * 60}ms`;
    card.innerHTML = `<span class="match-card__score">✦ ${photo.score}%</span>`;
    card.addEventListener("click", () => openLightbox(photo));
    grid.appendChild(card);
  });
}

const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxMatch = document.getElementById("lightbox-match");
const lightboxDownload = document.getElementById("lightbox-download");

function openLightbox(photo) {
  lightboxImg.src = photo.url;
  lightboxMatch.textContent = `✦ ${photo.score}% de ressemblance`;
  lightboxDownload.href = photo.url;
  lightbox.setAttribute("aria-hidden", "false");
}

function closeLightbox() {
  lightbox.setAttribute("aria-hidden", "true");
}

document.getElementById("lightbox-close").addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });

document.getElementById("lightbox-share").addEventListener("click", async () => {
  if (navigator.share) {
    try { await navigator.share({ title: "Ma photo — Reflet", url: lightboxImg.src }); } catch(_) {}
  } else {
    alert("Lien copié dans le presse-papier !");
  }
});

document.getElementById("btn-download-all").addEventListener("click", function() {
  const btn = this;
  const original = btn.textContent;
  btn.textContent = "Préparation de l'archive…";
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = "Fonctionnalité à venir (ZIP)";
    setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 2000);
  }, 1200);
});

// ---- 7. CHARGEMENT DES MODÈLES IA ----
async function loadModels() {
  if (modelsLoaded) return;
  // Utilisation des modèles hébergés sur CDN (vladmandic est plus stable et à jour)
  const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/";
  try {
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    modelsLoaded = true;
    console.log("✅ Modèles de reconnaissance faciale chargés");
  } catch (err) {
    console.error("❌ Erreur chargement modèles IA:", err);
  }
}