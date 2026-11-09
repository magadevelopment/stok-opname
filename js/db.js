let db;
let masterBarangList = [];

const reqDB = indexedDB.open("PWA_StockOpname_DB", 1);

reqDB.onupgradeneeded = (e) => {
  db = e.target.result;
  db.createObjectStore("master_barang", { keyPath: "barcode" });
  db.createObjectStore("input_so", { keyPath: "id", autoIncrement: true });
};

reqDB.onsuccess = (e) => {
  db = e.target.result;
  refreshUI();
  loadMasterFromJSONFile();
};

// Function Toast Smooth & Elegant Floating (Global)
function showToast(pesan, jenis = "success") {
  const toast = document.getElementById("toast");
  const msg = document.getElementById("toast-message");
  const icon = document.getElementById("toast-icon");

  if (!toast) return alert(pesan);

  msg.innerText = pesan;

  if (jenis === "error") {
    icon.style.background = "#ef4444";
    icon.innerText = "✕";
  } else {
    icon.style.background = "#10b981";
    icon.innerText = "✓";
  }

  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

// Custom Modal Confirm Replacement
function showCustomConfirm(pesan, callbackYa) {
  const modal = document.getElementById("modal-confirm");
  const msg = document.getElementById("modal-confirm-msg");
  const btnYa = document.getElementById("btn-modal-ya");
  const btnBatal = document.getElementById("btn-modal-batal");

  if (!modal) {
    if (confirm(pesan)) callbackYa();
    return;
  }

  msg.innerText = pesan;
  modal.classList.add("show");

  const tutupModal = () => {
    modal.classList.remove("show");
  };

  btnYa.onclick = () => {
    tutupModal();
    callbackYa();
  };

  btnBatal.onclick = () => {
    tutupModal();
  };
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 1200;
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) {
    console.log("Audio play suppressed");
  }
}

function loadMasterFromJSONFile() {
  fetch('master.json')
    .then(response => {
      if (!response.ok) throw new Error("File tidak ada");
      return response.json();
    })
    .then(data => {
      if (Array.isArray(data)) {
        simpanArrayKeMasterDB(data, false);
      }
    })
    .catch(() => {});
}

// FUNGSI UTAMA IMPOR MASTER (HAPUS DATA LAMA TERLEBIH DAHULU)
function simpanArrayKeMasterDB(dataArray, showNotice = true) {
  if (!db) return;

  const tx = db.transaction("master_barang", "readwrite");
  const store = tx.objectStore("master_barang");

  // 1. Kosongkan/hapus seluruh data master lama agar tidak tertumpuk
  const clearReq = store.clear();

  clearReq.onsuccess = () => {
    let successCount = 0;

    // 2. Masukkan data master baru secara massal
    dataArray.forEach(item => {
      if (item.barcode && item.nama_barang) {
        store.put({ barcode: String(item.barcode).trim(), nama_barang: item.nama_barang.trim() });
        successCount++;
      }
    });

    tx.oncomplete = () => {
      // 3. Tampilkan Notifikasi Toast setelah impor selesai
      if (showNotice) {
        showToast(`Impor Berhasil! ${successCount} data master telah diperbarui.`, "success");
      }
      refreshUI();
    };
  };

  clearReq.onerror = () => {
    showToast("Gagal membersihkan data master lama!", "error");
  };
}

function refreshUI() {
  if (!db) return;

  if (typeof renderMasterUI === "function") renderMasterUI();
  if (typeof renderScanUI === "function") renderScanUI();
  if (typeof renderBerandaUI === "function") renderBerandaUI();
  if (typeof renderLaporanUI === "function") renderLaporanUI();
}