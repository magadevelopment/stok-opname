document.addEventListener("DOMContentLoaded", () => {
  muatPengaturanPDT();
  muatPengaturanKeterangan();
});

// Memuat status sakelar PDT saat aplikasi dibuka
function muatPengaturanPDT() {
  const toggle = document.getElementById("toggle-mode-pdt");
  if (!toggle) return;

  const isPDTMode = localStorage.getItem("pdt_mode_enabled") === "true";
  toggle.checked = isPDTMode;

  terapkanModePDT();
}

// Menyimpan status sakelar PDT saat diklik oleh user
function simpanPengaturanPDT() {
  const toggle = document.getElementById("toggle-mode-pdt");
  if (!toggle) return;

  localStorage.setItem("pdt_mode_enabled", toggle.checked);
  terapkanModePDT();

  if (toggle.checked) {
    showToast("Mode PDT Aktif: Keyboard layar disembunyikan!", "success");
  } else {
    showToast("Mode HP Aktif: Keyboard layar bisa digunakan!", "success");
  }
}

// Mengatur atribut inputmode pada elemen scan (LOKASI, BARCODE, QTY, KETERANGAN) secara dinamis
function terapkanModePDT() {
  const isPDTMode = localStorage.getItem("pdt_mode_enabled") === "true";
  
  const barcodeInput = document.getElementById("barcode");
  const lksInput = document.getElementById("lks");
  const qtyInput = document.getElementById("qty");
  const ketInput = document.getElementById("keterangan");

  if (isPDTMode) {
    if (barcodeInput) barcodeInput.setAttribute("inputmode", "none");
    if (lksInput) lksInput.setAttribute("inputmode", "none");
    if (qtyInput) qtyInput.setAttribute("inputmode", "none");
    if (ketInput) ketInput.setAttribute("inputmode", "none");
  } else {
    if (barcodeInput) barcodeInput.removeAttribute("inputmode");
    if (lksInput) lksInput.removeAttribute("inputmode");
    if (qtyInput) qtyInput.removeAttribute("inputmode");
    if (ketInput) ketInput.removeAttribute("inputmode");
  }
}

// Memuat status sakelar Kolom Keterangan
function muatPengaturanKeterangan() {
  const toggle = document.getElementById("toggle-keterangan");
  if (!toggle) return;

  const isKetEnabled = localStorage.getItem("keterangan_enabled") === "true";
  toggle.checked = isKetEnabled;

  terapkanTampilanKeterangan();
}

// Menyimpan status sakelar Kolom Keterangan
function simpanPengaturanKeterangan() {
  const toggle = document.getElementById("toggle-keterangan");
  if (!toggle) return;

  localStorage.setItem("keterangan_enabled", toggle.checked);
  terapkanTampilanKeterangan();

  if (toggle.checked) {
    showToast("Kolom Keterangan diaktifkan!", "success");
  } else {
    showToast("Kolom Keterangan disembunyikan!", "success");
  }

  refreshUI();
}

// Mengatur Tampilan Elemen Kolom Keterangan di Halaman Scan
function terapkanTampilanKeterangan() {
  const isKetEnabled = localStorage.getItem("keterangan_enabled") === "true";
  const wrapperKet = document.getElementById("wrapper-keterangan");
  const thKet = document.getElementById("th-keterangan");

  if (wrapperKet) {
    wrapperKet.style.display = isKetEnabled ? "block" : "none";
  }
  if (thKet) {
    thKet.style.display = isKetEnabled ? "" : "none";
  }
}

// Fungsi Reset / Hapus Seluruh Data Hasil Scan dari Database Lokal (IndexedDB)
function konfirmasiResetDataScan() {
  showCustomConfirm({
    title: "Hapus Semua Data Scan?",
    msg: "Tindakan ini akan menghapus seluruh data rekap laporan dan data scan aktif secara permanen. Data tidak dapat dikembalikan!",
    iconType: "trash",
    btnConfirmText: "Ya, Hapus Semua",
    btnConfirmClass: "btn-danger",
    onConfirm: () => {
      if (!db) {
        return showToast("Database lokal tidak ditemukan!", "error");
      }

      const tx = db.transaction(["input_so"], "readwrite");
      const store = tx.objectStore("input_so");
      const req = store.clear(); // Mengosongkan isi object store input_so

      req.onsuccess = () => {
        try {
          localStorage.removeItem("stock_opname_active_draft");
        } catch (e) {
          console.error(e);
        }

        showToast("Seluruh data hasil scan berhasil dihapus!", "success");
        
        if (typeof refreshUI === "function") {
          refreshUI();
        }
      };

      req.onerror = () => {
        showToast("Gagal menghapus data dari database!", "error");
      };
    }
  });
}

// Import File Master Manual (.json / .txt)
function importFileManual(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const content = e.target.result;
      let data = [];

      if (file.name.endsWith(".json")) {
        data = JSON.parse(content);
      } else {
        const lines = content.split("\n");
        lines.forEach(line => {
          const parts = line.split(/[,;\t]/);
          if (parts.length >= 2) {
            data.push({
              barcode: parts[0].trim(),
              nama_barang: parts[1].trim()
            });
          }
        });
      }

      if (!Array.isArray(data) || data.length === 0) {
        return showToast("Format file tidak valid atau kosong!", "error");
      }

      const tx = db.transaction("master_barang", "readwrite");
      const store = tx.objectStore("master_barang");

      data.forEach(item => {
        if (item.barcode && item.nama_barang) {
          store.put({
            barcode: String(item.barcode).trim(),
            nama_barang: String(item.nama_barang).trim()
          });
        }
      });

      tx.oncomplete = () => {
        showToast(`Berhasil import ${data.length} master barang!`, "success");
        refreshUI();
      };
    } catch (err) {
      console.error(err);
      showToast("Gagal membaca isi file master!", "error");
    }
  };

  reader.readAsText(file);
}

// Auto Sync master.json (Hanya berjalan jika tombol diklik manual)
function loadMasterFromJSONFile() {
  fetch("master.json")
    .then(res => {
      if (!res.ok) throw new Error("File master.json tidak ditemukan di folder server!");
      return res.json();
    })
    .then(data => {
      if (!Array.isArray(data)) throw new Error("Format data JSON tidak sesuai!");

      const tx = db.transaction("master_barang", "readwrite");
      const store = tx.objectStore("master_barang");

      data.forEach(item => {
        if (item.barcode && item.nama_barang) {
          store.put({
            barcode: String(item.barcode).trim(),
            nama_barang: String(item.nama_barang).trim()
          });
        }
      });

      tx.oncomplete = () => {
        showToast(`Auto Sync Berhasil! ${data.length} barang diupdate`, "success");
        refreshUI();
      };
    })
    .catch(err => {
      console.error(err);
      showToast(err.message, "error");
    });
}