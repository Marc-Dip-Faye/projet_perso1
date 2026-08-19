/* =========================================================
   REFLET — Logique principale (Vraie reconnaissance faciale)
   ========================================================= */

const APP_DATA = {
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

let currentEvent = APP_DATA.events[0];
let mediaStream = null;
let selfieDescriptor = null;
let modelsLoaded = false;

// ---- 2. INITIALISATION ----
document.addEventListener("DOMContentLoaded", () => {
  renderEvents();
  loadModels();
});

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
    if (s.id === screenId) {
      s.setAttribute("aria-hidden", "false");
      s.scrollTop = 0; // 🛡️ Scroll en haut de l'écran actif
    } else {
      s.setAttribute("aria-hidden", "true");
    }
  });
  
  document.querySelectorAll(".tab").forEach(t => {
    t.setAttribute("aria-current", t.dataset.goto === screenId);
  });
}

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    const isAccueilVisible = document.getElementById("screen-accueil").getAttribute("aria-hidden") === "false";

    if (tab.dataset.goto === "screen-scan" && isAccueilVisible) {
      document.getElementById("event-prompt").hidden = false;
      document.getElementById("events-list").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (tab.dataset.goto !== "screen-scan") stopCamera();
    goTo(tab.dataset.goto);
  });
});

document.getElementById("event-prompt-link").addEventListener("click", () => {
  document.getElementById("event-prompt").hidden = true;
});

document.getElementById("event-prompt-close").addEventListener("click", () => {
  document.getElementById("event-prompt").hidden = true;
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

document.getElementById("btn-retry").addEventListener("click", () => {
  resetScanScreen();
  goTo("screen-scan");
  startCamera();
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

  if (!modelsLoaded) {
    document.getElementById("viewfinder-status").textContent = "Chargement des modèles IA...";
    await loadModels();
  }

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
          const distance = faceapi.euclideanDistance(selfieDescriptor, det.descriptor);
          if (distance < 0.55) {
            const score = Math.round((1 - distance) * 100);
            matches.push({ url: photoUrl, score: Math.min(score, 99) });
            break;
          }
        }
      } catch (e) {
        console.warn("Erreur analyse photo", e);
      }
      
      const progress = 50 + ((i + 1) / totalPhotos) * 50;
      document.getElementById("progress-bar").style.width = `${progress}%`;
      await new Promise(r => setTimeout(r, 50));
    }

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

// ---- 6. RÉSULTATS & LIGHTBOX (CORRIGÉ) ----
function buildResults(matches) {
  document.getElementById("results-event").textContent = currentEvent.name.toUpperCase();
  document.getElementById("results-number").textContent = matches.length;
  
  const grid = document.getElementById("results-grid");
  const emptyState = document.getElementById("empty-state");
  const downloadBtn = document.getElementById("btn-download-all");
  
  grid.innerHTML = "";

  if (matches.length === 0) {
    // 🛡️ Affichage propre de l'état vide sans casser la grille
    grid.style.display = "none";
    emptyState.hidden = false;
    downloadBtn.style.display = "none";
    return;
  }

  // Affichage de la grille
  grid.style.display = "grid";
  emptyState.hidden = true;
  downloadBtn.style.display = "flex";

  matches.sort((a, b) => b.score - a.score);

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