let db = null;
let deferredPrompt = null;
const DB_NAME = "quran_audio_cache";
const DB_VERSION = 1;
const BASE_URL =
  "https://raw.githubusercontent.com/brmhmh/yacineee/refs/heads/upup/";
// "https://raw.githubusercontent.com/brmhmh/ibraheem-aldosry/refs/heads/main/";

const elements = {
  surahSelect: document.getElementById("surahSelect"),
  startAyaSelect: document.getElementById("startAyaSelect"),
  endAyaSelect: document.getElementById("endAyaSelect"),
  downloadBtn: document.getElementById("downloadBtn"),
  statusAlert: document.getElementById("statusAlert"),
  infoBox: document.getElementById("infoBox"),
  previewAudio: document.getElementById("preview"),
  downloadOfflineBtn: document.getElementById("downloadOfflineBtn"),
  downloadProgress: document.getElementById("downloadProgress"),
  progressBar: document.getElementById("progressBar"),
  storedCount: document.getElementById("storedCount"),
  surahCheckboxes: document.getElementById("surahCheckboxes"),
  onlineIndicator: document.getElementById("onlineIndicator"),
  selectAllBtn: document.getElementById("selectAllBtn"),
  deselectAllBtn: document.getElementById("deselectAllBtn"),
  clearAllBtn: document.getElementById("clearAllBtn"),
};

// Online/Offline Detection
function updateOnlineStatus() {
  const isOnline = navigator.onLine;
  elements.onlineIndicator.className = `online-indicator ${
    isOnline ? "online" : "offline"
  }`;
  elements.onlineIndicator.innerHTML = isOnline
    ? '<i class="bi bi-wifi"></i> متصل بالإنترنت'
    : '<i class="bi bi-wifi-off"></i> غير متصل';
}

window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);
updateOnlineStatus();

// IndexedDB functions
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      const db = request.result;

      // Check if object store exists
      if (!db.objectStoreNames.contains("ayahs")) {
        // Close and reopen with higher version to trigger upgrade
        db.close();
        const newVersion = db.version + 1;
        const upgradeRequest = indexedDB.open(DB_NAME, newVersion);

        upgradeRequest.onupgradeneeded = (e) => {
          const upgradeDb = e.target.result;
          if (!upgradeDb.objectStoreNames.contains("ayahs")) {
            upgradeDb.createObjectStore("ayahs", { keyPath: "ayahId" });
          }
        };

        upgradeRequest.onsuccess = () => resolve(upgradeRequest.result);
        upgradeRequest.onerror = () => reject(upgradeRequest.error);
      } else {
        resolve(db);
      }
    };

    request.onupgradeneeded = (e) => {
      const db = e.target.result;

      // Delete old object stores if they exist
      if (db.objectStoreNames.contains("audio")) {
        db.deleteObjectStore("audio");
      }

      // Create new object store
      if (!db.objectStoreNames.contains("ayahs")) {
        db.createObjectStore("ayahs", { keyPath: "ayahId" });
      }
    };
  });
}

async function saveAyahToCache(surah, ayah, arrayBuffer) {
  const db = await openDB();
  const ayahId = `${String(surah).padStart(3, "0")}${String(ayah).padStart(
    3,
    "0"
  )}`;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["ayahs"], "readwrite");
    const store = transaction.objectStore("ayahs");
    const request = store.put({ ayahId, surah, ayah, data: arrayBuffer });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getAyahFromCache(surah, ayah) {
  const db = await openDB();
  const ayahId = `${String(surah).padStart(3, "0")}${String(ayah).padStart(
    3,
    "0"
  )}`;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["ayahs"], "readonly");
    const store = transaction.objectStore("ayahs");
    const request = store.get(ayahId);
    request.onsuccess = () => resolve(request.result?.data || null);
    request.onerror = () => reject(request.error);
  });
}

async function getStoredSurahs() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["ayahs"], "readonly");
    const store = transaction.objectStore("ayahs");
    const request = store.getAll();
    request.onsuccess = () => {
      const ayahs = request.result;
      const surahs = [...new Set(ayahs.map((a) => a.surah))];
      resolve(surahs);
    };
    request.onerror = () => reject(request.error);
  });
}

async function getSurahAyahsFromCache(surah) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["ayahs"], "readonly");
    const store = transaction.objectStore("ayahs");
    const request = store.getAll();
    request.onsuccess = () => {
      const ayahs = request.result.filter((a) => a.surah === surah);
      resolve(ayahs.map((a) => a.ayah));
    };
    request.onerror = () => reject(request.error);
  });
}

async function deleteSurahFromCache(surah) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["ayahs"], "readwrite");
    const store = transaction.objectStore("ayahs");
    const getAllRequest = store.getAll();

    getAllRequest.onsuccess = () => {
      const ayahs = getAllRequest.result.filter((a) => a.surah === surah);
      let deleteCount = 0;

      ayahs.forEach((ayah) => {
        const deleteRequest = store.delete(ayah.ayahId);
        deleteRequest.onsuccess = () => {
          deleteCount++;
          if (deleteCount === ayahs.length) {
            resolve();
          }
        };
      });

      if (ayahs.length === 0) resolve();
    };
    getAllRequest.onerror = () => reject(getAllRequest.error);
  });
}

async function clearAllCache() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["ayahs"], "readwrite");
    const store = transaction.objectStore("ayahs");
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function updateStoredSurahsList() {
  const stored = await getStoredSurahs();
  elements.storedCount.textContent = stored.length;

  const checkboxes = elements.surahCheckboxes.querySelectorAll(
    'input[type="checkbox"]'
  );
  checkboxes.forEach((cb) => {
    const surahNum = parseInt(cb.value);
    const container = cb.closest(".surah-checkbox");
    if (stored.includes(surahNum)) {
      cb.checked = true;
      container.classList.add("downloaded");
    } else {
      cb.checked = false;
      container.classList.remove("downloaded");
    }
  });
}

function showStatus(message, type = "info") {
  const alertClass = `alert-${type}`;
  elements.statusAlert.className = `alert ${alertClass} mt-3`;
  elements.statusAlert.innerHTML = `<i class="bi bi-${
    type === "success"
      ? "check-circle"
      : type === "danger"
      ? "x-circle"
      : "info-circle"
  }"></i> ${message}`;
  elements.statusAlert.classList.remove("d-none");
}

function showInfo(message) {
  elements.infoBox.innerHTML = `<i class="bi bi-info-circle"></i> ${message}`;
  elements.infoBox.classList.remove("d-none");
}

async function initDatabase() {
  try {
    showStatus("جاري تحميل قاعدة البيانات...", "info");
    const SQL = await initSqlJs({
      locateFile: (file) =>
        `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`,
    });

    const response = await fetch("./assets/quran.sqlite");
    const buffer = await response.arrayBuffer();
    db = new SQL.Database(new Uint8Array(buffer));

    loadSurahs();
    await updateStoredSurahsList();

    showStatus("تم تحميل قاعدة البيانات بنجاح!", "success");
  } catch (error) {
    showStatus(`خطأ في تحميل قاعدة البيانات: ${error.message}`, "danger");
  }
}

function loadSurahs() {
  const result = db.exec(
    "SELECT id_sura, sura, num_ayat FROM quran_index ORDER BY id_sura"
  );

  if (result.length > 0) {
    elements.surahSelect.innerHTML = "";
    elements.surahCheckboxes.innerHTML = "";
    const rows = result[0].values;

    rows.forEach((row) => {
      const [id_sura, sura, num_ayat] = row;

      const option = document.createElement("option");
      option.value = id_sura;
      option.textContent = `${id_sura}. ${sura}`;
      option.dataset.numAyat = num_ayat;
      elements.surahSelect.appendChild(option);

      const checkboxDiv = document.createElement("div");
      checkboxDiv.className = "surah-checkbox form-check";
      checkboxDiv.innerHTML = `
                        <input type="checkbox" class="form-check-input" id="surah_${id_sura}" value="${id_sura}">
                        <label class="form-check-label w-100" for="surah_${id_sura}">
                            ${id_sura}. ${sura}
                        </label>
                    `;
      elements.surahCheckboxes.appendChild(checkboxDiv);
    });

    elements.surahSelect.value = "1";
    loadAyasForSurah();
  }
}

function loadAyasForSurah() {
  const surahId = parseInt(elements.surahSelect.value);
  if (!surahId) return;

  const result = db.exec(
    `SELECT ayah, text FROM quran_ayat WHERE sura = ${surahId} ORDER BY ayah`
  );

  if (result.length > 0) {
    elements.startAyaSelect.innerHTML = "";
    const rows = result[0].values;

    rows.forEach((row) => {
      const [ayah, text] = row;
      const option = document.createElement("option");
      option.value = ayah;
      option.textContent = `${ayah}. ${text}`;
      elements.startAyaSelect.appendChild(option);
    });

    elements.startAyaSelect.value = "1";
    updateEndAyaOptions();
  }
}

function updateEndAyaOptions() {
  const startAya = parseInt(elements.startAyaSelect.value);
  const surahId = parseInt(elements.surahSelect.value);

  if (!startAya || !surahId) return;

  const result = db.exec(
    `SELECT ayah, text FROM quran_ayat WHERE sura = ${surahId} AND ayah >= ${startAya} ORDER BY ayah`
  );

  if (result.length > 0) {
    elements.endAyaSelect.innerHTML = "";
    const rows = result[0].values;

    rows.forEach((row) => {
      const [ayah, text] = row;
      const option = document.createElement("option");
      option.value = ayah;
      option.textContent = `${ayah}. ${text}`;
      elements.endAyaSelect.appendChild(option);
    });

    const selectedOption =
      elements.surahSelect.options[elements.surahSelect.selectedIndex];
    const numAyat = parseInt(selectedOption.dataset.numAyat);
    // elements.endAyaSelect.value = parseInt(startAya)

    elements.downloadBtn.disabled = false;
  }
}

elements.selectAllBtn.addEventListener("click", () => {
  const checkboxes = elements.surahCheckboxes.querySelectorAll(
    'input[type="checkbox"]'
  );
  checkboxes.forEach((cb) => (cb.checked = true));
});

elements.deselectAllBtn.addEventListener("click", () => {
  const checkboxes = elements.surahCheckboxes.querySelectorAll(
    'input[type="checkbox"]'
  );
  checkboxes.forEach((cb) => (cb.checked = false));
});

elements.clearAllBtn.addEventListener("click", async () => {
  if (!confirm("هل أنت متأكد من حذف جميع السور المحفوظة؟")) return;

  try {
    await clearAllCache();
    await updateStoredSurahsList();
    showStatus("تم حذف جميع السور المحفوظة", "success");
  } catch (error) {
    showStatus(`خطأ في الحذف: ${error.message}`, "danger");
  }
});

elements.downloadOfflineBtn.addEventListener("click", async () => {
  if (!navigator.onLine) {
    showStatus("يجب الاتصال بالإنترنت لتحميل السور", "danger");
    return;
  }

  const checkboxes = elements.surahCheckboxes.querySelectorAll(
    'input[type="checkbox"]:checked'
  );
  const selectedSurahs = Array.from(checkboxes).map((cb) => parseInt(cb.value));

  if (selectedSurahs.length === 0) {
    showStatus("الرجاء اختيار سورة واحدة على الأقل", "danger");
    return;
  }

  elements.downloadOfflineBtn.disabled = true;
  elements.downloadProgress.classList.remove("d-none");

  let totalAyahs = 0;
  let downloadedAyahs = 0;

  for (const surahNum of selectedSurahs) {
    const result = db.exec(
      `SELECT num_ayat FROM quran_index WHERE id_sura = ${surahNum}`
    );
    if (result.length > 0) {
      totalAyahs += result[0].values[0][0];
    }
  }

  for (const surahNum of selectedSurahs) {
    const result = db.exec(
      `SELECT num_ayat FROM quran_index WHERE id_sura = ${surahNum}`
    );
    if (result.length > 0) {
      const numAyat = result[0].values[0][0];

      for (let ayah = 1; ayah <= numAyat; ayah++) {
        try {
          const ayahId = `${String(surahNum).padStart(3, "0")}${String(
            ayah
          ).padStart(3, "0")}`;
          const audioUrl = `${BASE_URL}${ayahId}.mp3`;

          const response = await fetch(audioUrl);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            await saveAyahToCache(surahNum, ayah, arrayBuffer);
          }

          downloadedAyahs++;
          const progress = Math.round((downloadedAyahs / totalAyahs) * 100);
          elements.progressBar.style.width = progress + "%";
          elements.progressBar.textContent = `${progress}% - آية ${ayah}/${numAyat} من السورة ${surahNum}`;
        } catch (error) {
          console.error(
            `خطأ في تحميل الآية ${ayah} من السورة ${surahNum}:`,
            error
          );
        }
      }
    }
  }

  elements.progressBar.style.width = "100%";
  elements.progressBar.textContent = "اكتمل التحميل!";
  await updateStoredSurahsList();

  setTimeout(() => {
    elements.downloadProgress.classList.add("d-none");
    elements.downloadOfflineBtn.disabled = false;
    showStatus("تم حفظ السور بنجاح!", "success");
  }, 1500);
});

async function downloadAudioSegment() {
  const surahNumber = parseInt(elements.surahSelect.value);
  const startAya = parseInt(elements.startAyaSelect.value);
  const endAya = parseInt(elements.endAyaSelect.value);

  if (!surahNumber || !startAya || !endAya) {
    showStatus("الرجاء اختيار جميع الحقول", "danger");
    return;
  }

  if (!db) {
    showStatus("قاعدة البيانات غير محملة بعد. الرجاء الانتظار...", "danger");
    return;
  }

  try {
    elements.downloadBtn.disabled = true;
    elements.previewAudio.classList.add("d-none");
    elements.infoBox.classList.add("d-none");

    const ayahCount = endAya - startAya + 1;
    showInfo(`جاري تحميل ${ayahCount} آية...`);
    showStatus("جاري تحميل الآيات...", "info");

    const audioBuffers = [];
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();

    for (let ayah = startAya; ayah <= endAya; ayah++) {
      const currentAyah = ayah - startAya + 1;
      showStatus(`جاري معالجة الآية ${currentAyah} من ${ayahCount}...`, "info");

      let arrayBuffer = await getAyahFromCache(surahNumber, ayah);

      if (!arrayBuffer) {
        if (!navigator.onLine) {
          showStatus(
            `لا يوجد اتصال بالإنترنت والآية ${ayah} غير محفوظة`,
            "danger"
          );
          elements.downloadBtn.disabled = false;
          return;
        }

        const ayahId = `${String(surahNumber).padStart(3, "0")}${String(
          ayah
        ).padStart(3, "0")}`;
        const audioUrl = `${BASE_URL}${ayahId}.mp3`;

        const response = await fetch(audioUrl);
        if (!response.ok) throw new Error(`فشل تحميل الآية ${ayah}`);
        arrayBuffer = await response.arrayBuffer();
      }

      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      audioBuffers.push(audioBuffer);
    }

    showStatus("جاري دمج الآيات...", "info");

    const mergedBuffer = mergeAudioBuffers(audioContext, audioBuffers);

    showStatus("جاري ترميز الصوت...", "info");

    const wavBlob = bufferToWave(mergedBuffer);

    const previewUrl = URL.createObjectURL(wavBlob);
    elements.previewAudio.src = previewUrl;
    elements.previewAudio.classList.remove("d-none");

    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `quran.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    showStatus("اكتمل التحميل! المعاينة متاحة أدناه.", "success");
    showInfo(`تم دمج ${ayahCount} آية بنجاح`);
  } catch (error) {
    showStatus(`خطأ: ${error.message}`, "danger");
    console.error(error);
  } finally {
    elements.downloadBtn.disabled = false;
  }
}

function mergeAudioBuffers(audioContext, buffers) {
  if (buffers.length === 0) {
    throw new Error("لا توجد ملفات صوتية للدمج");
  }

  const numberOfChannels = buffers[0].numberOfChannels;
  const sampleRate = buffers[0].sampleRate;

  let totalLength = 0;
  buffers.forEach((buffer) => {
    totalLength += buffer.length;
  });

  const mergedBuffer = audioContext.createBuffer(
    numberOfChannels,
    totalLength,
    sampleRate
  );

  let offset = 0;
  buffers.forEach((buffer) => {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sourceData = buffer.getChannelData(channel);
      const targetData = mergedBuffer.getChannelData(channel);

      for (let i = 0; i < buffer.length; i++) {
        targetData[offset + i] = sourceData[i];
      }
    }
    offset += buffer.length;
  });

  return mergedBuffer;
}

function bufferToWave(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1;
  const bitDepth = 16;

  const length = audioBuffer.length * numChannels * 2;
  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + length, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, (sampleRate * numChannels * bitDepth) / 8, true);
  view.setUint16(32, (numChannels * bitDepth) / 8, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, "data");
  view.setUint32(40, length, true);

  const channels = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(audioBuffer.getChannelData(i));
  }

  let offset = 44;
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][i]));
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true
      );
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

elements.surahSelect.addEventListener("change", loadAyasForSurah);
elements.startAyaSelect.addEventListener("change", updateEndAyaOptions);
elements.downloadBtn.addEventListener("click", downloadAudioSegment);

initDatabase();
