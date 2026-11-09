let html5QrScannerInstance = null;
let isReadyToSaveQty = false;

document.addEventListener("DOMContentLoaded", () => {
  const lksInput = document.getElementById("lks");
  const barcodeInput = document.getElementById("barcode");
  const qtyInput = document.getElementById("qty");

  // Kunci QTY di awal saat halaman dimuat
  if (qtyInput) {
    qtyInput.disabled = true;
    qtyInput.style.background = "#f8fafc";
    qtyInput.style.color = "var(--text-muted)";
  }

  if (lksInput) {
    lksInput.value = "";
    lksInput.addEventListener("blur", () => {
      cekLokasiDiLaporan();
    });
  }

  if (barcodeInput) {
    barcodeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.keyCode === 13) {
        e.preventDefault();
        cariBarangOtomatis();
      }
    });

    barcodeInput.addEventListener("search", () => {
      cariBarangOtomatis();
    });
  }

  // 1. Pulihkan draft scan yang belum tersimpan saat halaman dibuka
  muatDraftScanDariLokal();

  fokuskanInputUtama();

  document.addEventListener("click", (e) => {
    const dropdown = document.getElementById("search-nama-results");
    const inputNama = document.getElementById("nama_barang");
    const btnUnlock = document.getElementById("btn-unlock-nama");

    if (dropdown && !dropdown.contains(e.target) && e.target !== inputNama && e.target !== btnUnlock) {
      dropdown.classList.remove("show");
    }
  });
});

// --- FUNGSI DRAFT LOCALSTORAGE ---
function muatDraftScanDariLokal() {
  try {
    const savedDraft = localStorage.getItem("stock_opname_active_draft");
    if (!savedDraft) return;

    const draft = JSON.parse(savedDraft);
    
    // Kembalikan teks Lokasi jika ada
    if (draft.lokasi) {
      const lksInput = document.getElementById("lks");
      if (lksInput) lksInput.value = draft.lokasi;
    }
    
    // Masukkan kembali data ke database lokal (input_so) jika tabel scan aktif kosong
    if (draft.items && Array.isArray(draft.items) && draft.items.length > 0) {
      const tx = db.transaction("input_so", "readwrite");
      const store = tx.objectStore("input_so");
      
      store.getAll().onsuccess = (e) => {
        const existing = e.target.result || [];
        const activeExisting = existing.filter(i => i.status !== "saved");
        
        if (activeExisting.length === 0) {
          draft.items.forEach(item => {
            store.add({
              lks: item.lks,
              barcode: item.barcode,
              nama_barang: item.nama_barang,
              qty: item.qty,
              keterangan: item.keterangan,
              status: "active",
              timestamp: item.timestamp || new Date().toISOString()
            });
          });
          tx.oncomplete = () => {
            renderScanUI();
            refreshUI();
          };
        }
      };
    }
  } catch (err) {
    console.error("Gagal memuat draft scan:", err);
  }
}

function simpanDraftScanKeLokal() {
  try {
    const lksInput = document.getElementById("lks");
    const currentLKS = lksInput ? lksInput.value.trim().toUpperCase() : "";
    
    const tx = db.transaction("input_so", "readonly");
    tx.objectStore("input_so").getAll().onsuccess = (e) => {
      const allData = e.target.result || [];
      const activeData = allData.filter(item => item.status !== "saved");
      
      const draft = {
        lokasi: currentLKS,
        items: activeData
      };
      localStorage.setItem("stock_opname_active_draft", JSON.stringify(draft));
    };
  } catch (err) {
    console.error("Gagal menyimpan draft scan:", err);
  }
}

function resetDraftScan() {
  try {
    localStorage.removeItem("stock_opname_active_draft");
  } catch (err) {
    console.error("Gagal mereset draft scan:", err);
  }
}
// ---------------------------------

function fokuskanInputUtama() {
  setTimeout(() => {
    const lksInput = document.getElementById("lks");
    const barcodeInput = document.getElementById("barcode");

    if (lksInput && lksInput.value.trim() === "") {
      lksInput.focus();
    } else if (barcodeInput) {
      barcodeInput.focus();
    }
  }, 150);
}

function cekLokasiDiLaporan() {
  const lksInput = document.getElementById("lks");
  if (!lksInput || !db) return;

  const currentLKS = lksInput.value.trim().toUpperCase();
  if (!currentLKS) return;

  const tx = db.transaction("input_so", "readonly");
  const store = tx.objectStore("input_so");
  const req = store.getAll();

  req.onsuccess = () => {
    const allData = req.result || [];
    const dataSaved = allData.filter(item => {
      const itemLKS = item.lks ? String(item.lks).trim().toUpperCase() : "";
      return itemLKS === currentLKS && item.status === "saved";
    });

    if (dataSaved.length > 0) {
      showCustomConfirm({
        title: `Lokasi ${currentLKS} Sudah Ada!`,
        msg: `Data lokasi ${currentLKS} sudah tersimpan di Laporan (${dataSaved.length} item). Ingin lanjut edit data ini?`,
        iconType: "save",
        btnConfirmText: "Lanjut (Edit)",
        onConfirm: () => {
          const txUpdate = db.transaction(["input_so"], "readwrite");
          const storeUpdate = txUpdate.objectStore("input_so");

          dataSaved.forEach(item => {
            item.status = "active";
            storeUpdate.put(item);
          });

          txUpdate.oncomplete = () => {
            showToast(`Data Lokasi ${currentLKS} dibuka kembali untuk diedit!`, "success");
            refreshUI();
            fokuskanInputUtama();
          };
        },
        onCancel: () => {
          lksInput.value = "";
          resetFormScan();
          refreshUI();
          fokuskanInputUtama();
        }
      });
    }
  };
}

function handleLksKeydown(event) {
  if (event.key === "Enter" || event.keyCode === 13) {
    event.preventDefault();
    event.target.blur(); // Tutup keyboard virtual HP
    const barcodeInput = document.getElementById("barcode");
    if (barcodeInput) {
      barcodeInput.focus();
    }
  }
}

function toggleCariNama() {
  const inputNama = document.getElementById("nama_barang");
  const btnUnlock = document.getElementById("btn-unlock-nama");

  if (inputNama.readOnly) {
    inputNama.readOnly = false;
    inputNama.style.background = "#ffffff";
    inputNama.style.color = "var(--text-main)";
    btnUnlock.style.background = "#dc2626";
    inputNama.focus();
    cariBarangByNamaManual();
  } else {
    kunciInputNama();
  }
}

function kunciInputNama() {
  const inputNama = document.getElementById("nama_barang");
  const btnUnlock = document.getElementById("btn-unlock-nama");
  const dropdown = document.getElementById("search-nama-results");

  inputNama.readOnly = true;
  inputNama.style.background = "#f8fafc";
  inputNama.style.color = "var(--text-muted)";
  btnUnlock.style.background = "#059669";
  if (dropdown) dropdown.classList.remove("show");
}

function cariBarangByNamaManual() {
  const keyword = document.getElementById("nama_barang").value.trim().toLowerCase();
  const dropdown = document.getElementById("search-nama-results");

  if (!dropdown) return;
  if (!keyword) {
    dropdown.classList.remove("show");
    dropdown.innerHTML = "";
    return;
  }

  const tx = db.transaction("master_barang", "readonly");
  const store = tx.objectStore("master_barang");
  const req = store.getAll();

  req.onsuccess = () => {
    const allItems = req.result || [];
    let matches = allItems.filter(item => 
      item.nama_barang && item.nama_barang.toLowerCase().includes(keyword)
    );

    matches.sort((a, b) => a.nama_barang.localeCompare(b.nama_barang));

    if (matches.length === 0) {
      dropdown.innerHTML = `<div style="padding: 8px 10px; font-size: 0.7rem; color: var(--text-muted); text-align: center;">Tidak ada barang yang cocok</div>`;
    } else {
      dropdown.innerHTML = matches.slice(0, 30).map(item => `
        <div class="search-item" onclick="pilihBarangDariNama('${item.barcode}', '${item.nama_barang.replace(/'/g, "\\'")}')">
          <span class="item-nama">${item.nama_barang}</span>
          <span class="item-barcode">Barcode: ${item.barcode}</span>
        </div>
      `).join('');
    }

    dropdown.classList.add("show");
  };
}

function pilihBarangDariNama(barcode, namaBarang) {
  document.getElementById("barcode").value = barcode;
  document.getElementById("nama_barang").value = namaBarang;
  
  const qtyInput = document.getElementById("qty");
  if (qtyInput) {
    qtyInput.disabled = false;
    qtyInput.style.background = "#ffffff";
    qtyInput.style.color = "var(--text-main)";
  }

  playBeep();
  kunciInputNama();
  arahkanFokusSetelahScan();
}

function simpanLokasiLKS() {
  const lksInput = document.getElementById("lks");
  const currentLKS = lksInput ? lksInput.value.trim().toUpperCase() : "";

  if (!currentLKS) return showToast("Kode Lokasi tidak boleh kosong!", "error");

  const tx = db.transaction(["input_so"], "readwrite");
  const store = tx.objectStore("input_so");
  const req = store.getAll();

  req.onsuccess = () => {
    const allData = req.result || [];
    const dataLKS = allData.filter(item => {
      const itemLKS = item.lks ? String(item.lks).trim().toUpperCase() : "";
      return itemLKS === currentLKS && item.status !== "saved";
    });

    if (dataLKS.length === 0) {
      return showToast(`Tidak ada data scan aktif di ${currentLKS} untuk disimpan!`, "error");
    }

    showCustomConfirm({
      title: "Simpan & Finalisasi?",
      msg: `Simpan permanen ${dataLKS.length} item dari ${currentLKS} ke Laporan dan bersihkan tabel scan?`,
      iconType: "save",
      btnConfirmText: "Ya, Simpan",
      onConfirm: () => {
        const txUpdate = db.transaction(["input_so"], "readwrite");
        const storeUpdate = txUpdate.objectStore("input_so");

        dataLKS.forEach(item => {
          item.status = "saved";
          storeUpdate.put(item);
        });

        txUpdate.oncomplete = () => {
          resetFormScan();
          if (lksInput) lksInput.value = "";
          resetDraftScan(); // Hapus draft karena sudah disimpan permanen
          showToast(`Data ${currentLKS} berhasil disimpan ke Laporan!`, "success");
          refreshUI();
          fokuskanInputUtama();
        };
      }
    });
  };
}

function renderScanUI() {
  if (!db) return;

  const isKetEnabled = localStorage.getItem("keterangan_enabled") === "true";
  const lksInput = document.getElementById("lks");
  const currentLKS = lksInput ? lksInput.value.trim().toUpperCase() : "";

  const txSO = db.transaction("input_so", "readonly");
  const reqSO = txSO.objectStore("input_so").getAll();

  reqSO.onsuccess = () => {
    const data = reqSO.result || [];
    const filteredData = data.filter(item => {
      const itemLKS = item.lks ? String(item.lks).trim().toUpperCase() : "";
      return itemLKS === currentLKS && item.status !== "saved";
    });

    const recentTbody = document.getElementById("tabel-scan-recent");
    if (!recentTbody) return;

    const colSpan = isKetEnabled ? 6 : 5;

    if (filteredData.length === 0) {
      recentTbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center; color: var(--text-muted); padding:12px;">Tabel bersih. Siap untuk scan ${currentLKS || 'Lokasi baru'}.</td></tr>`;
      return;
    }

    recentTbody.innerHTML = filteredData.reverse().map((item, index) => `
      <tr>
        <td><b>${index + 1}</b></td>
        <td><code>${item.barcode}</code></td>
        <td>${item.nama_barang}</td>
        <td><b>${item.qty}</b></td>
        ${isKetEnabled ? `<td><span style="font-size:0.65rem; color: #d97706; font-weight: 500;">${item.keterangan || '-'}</span></td>` : ''}
        <td>
          <div class="action-btn-group">
            <button class="btn-icon edit" title="Edit QTY" onclick="persiapkanEditSO(${item.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon delete" title="Hapus Entry" onclick="hapusInputSO(${item.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  };
}

function cariBarangOtomatis() {
  const barcodeInput = document.getElementById("barcode");
  const qtyInput = document.getElementById("qty");

  if (!barcodeInput) return;
  
  const barcode = barcodeInput.value.trim();
  if (!barcode) return;

  const tx = db.transaction("master_barang", "readonly");
  const store = tx.objectStore("master_barang");
  const req = store.get(barcode);

  req.onsuccess = () => {
    if (req.result) {
      document.getElementById("nama_barang").value = req.result.nama_barang;
      playBeep();
      
      if (qtyInput) {
        qtyInput.disabled = false;
        qtyInput.style.background = "#ffffff";
        qtyInput.style.color = "var(--text-main)";
      }

      showToast(`Ditemukan: ${req.result.nama_barang}`, "success");
      arahkanFokusSetelahScan();
    } else {
      showToast(`⚠️ Barcode [${barcode}] tidak ada di Master Data!`, "error");
      
      barcodeInput.style.transition = "transform 0.1s ease";
      barcodeInput.style.transform = "translateX(6px)";
      barcodeInput.style.borderColor = "#dc2626";
      
      setTimeout(() => { barcodeInput.style.transform = "translateX(-6px)"; }, 100);
      setTimeout(() => { barcodeInput.style.transform = "translateX(4px)"; }, 200);
      setTimeout(() => { 
        barcodeInput.style.transform = "translateX(0)"; 
        barcodeInput.style.borderColor = "";
      }, 300);

      const namaField = document.getElementById("nama_barang");
      namaField.value = "Barang Tidak Ditemukan!";
      
      if (qtyInput) {
        qtyInput.disabled = true;
        qtyInput.style.background = "#f8fafc";
        qtyInput.style.color = "var(--text-muted)";
      }

      barcodeInput.value = "";
      setTimeout(() => {
        barcodeInput.focus();
        barcodeInput.select();
      }, 350);
      
      return;
    }
  };

  req.onerror = () => {
    showToast("⚠️ Gagal membaca database master barang!", "error");
    barcodeInput.value = "";
    barcodeInput.focus();
  };
}

function arahkanFokusSetelahScan() {
  const isKetEnabled = localStorage.getItem("keterangan_enabled") === "true";
  const ketInput = document.getElementById("keterangan");

  if (isKetEnabled && ketInput) {
    setTimeout(() => {
      ketInput.focus();
      ketInput.select();
    }, 50);
  } else {
    pindahKeQtyDanBlok();
  }
}

function handleKeteranganKeydown(event) {
  if (event.key === "Enter" || event.keyCode === 13) {
    event.preventDefault();
    event.target.blur();
    pindahKeQtyDanBlok();
  }
}

function pindahKeQtyDanBlok() {
  const qtyInput = document.getElementById("qty");
  if (!qtyInput || qtyInput.disabled) return;

  isReadyToSaveQty = false;

  setTimeout(() => {
    qtyInput.focus();
    qtyInput.select();
    qtyInput.setSelectionRange(0, qtyInput.value.length);
    
    isReadyToSaveQty = true;
  }, 50);
}

function handleQtyKeydown(event) {
  if (event.key === "Enter" || event.keyCode === 13) {
    event.preventDefault();
    const qtyInput = document.getElementById("qty");
    if (!qtyInput || qtyInput.disabled) return;
    if (!isReadyToSaveQty) return;
    
    qtyInput.blur();
    simpanInputSO();
  }
}

function simpanInputSO() {
  const editId = document.getElementById("edit-id-so").value;
  const lks = document.getElementById("lks").value.trim();
  const barcode = document.getElementById("barcode").value.trim();
  const nama = document.getElementById("nama_barang").value;
  const qty = parseInt(document.getElementById("qty").value) || 0;
  const keterangan = document.getElementById("keterangan") ? document.getElementById("keterangan").value.trim() : "";

  if (!lks) return showToast("Kode Lokasi belum diisi!", "error");
  if (!barcode || !qty || nama === "Barang Tidak Ditemukan!") {
    return showToast("Lengkapi barcode valid dan QTY terlebih dahulu!", "error");
  }

  const tx = db.transaction("input_so", "readwrite");
  const store = tx.objectStore("input_so");

  if (editId) {
    const req = store.get(parseInt(editId));
    req.onsuccess = () => {
      const item = req.result;
      if (item) {
        item.lks = lks.toUpperCase();
        item.barcode = barcode;
        item.nama_barang = nama;
        item.qty = qty;
        item.keterangan = keterangan;
        store.put(item);
      }
    };

    tx.oncomplete = () => {
      resetFormScan();
      simpanDraftScanKeLokal(); // Update draft
      showToast("Data Entry Berhasil Diperbarui!", "success");
      fokuskanInputUtama();
      refreshUI();
    };
  } else {
    store.add({ 
      lks: lks.toUpperCase(), 
      barcode, 
      nama_barang: nama, 
      qty, 
      keterangan,
      status: "active",
      timestamp: new Date().toISOString() 
    });

    tx.oncomplete = () => {
      resetFormScan();
      simpanDraftScanKeLokal(); // Simpan draft otomatis
      showToast("Entry ditambahkan!", "success");
      fokuskanInputUtama();
      refreshUI();
    };
  }
}

function persiapkanEditSO(id) {
  const tx = db.transaction("input_so", "readonly");
  const store = tx.objectStore("input_so");
  const req = store.get(id);

  req.onsuccess = () => {
    const item = req.result;
    if (item) {
      document.getElementById("edit-id-so").value = item.id;
      document.getElementById("barcode").value = item.barcode;
      document.getElementById("nama_barang").value = item.nama_barang;
      
      const qtyInput = document.getElementById("qty");
      qtyInput.value = item.qty;
      qtyInput.disabled = false;
      qtyInput.style.background = "#ffffff";
      qtyInput.style.color = "var(--text-main)";

      if (document.getElementById("keterangan")) {
        document.getElementById("keterangan").value = item.keterangan || "";
      }

      const btnSimpan = document.getElementById("btn-simpan-entry");
      if (btnSimpan) {
        btnSimpan.title = "Update Entry";
        btnSimpan.style.background = "#0284c7";
        btnSimpan.innerHTML = `
          <svg style="width: 15px; height: 15px; stroke: currentColor; fill: none;" viewBox="0 0 24 24" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>`;
      }

      arahkanFokusSetelahScan();
      showToast("Mode Edit: Silakan sesuaikan data", "success");
    }
  };
}

function batalInputForm() {
  const lksInput = document.getElementById("lks");
  const currentLKS = lksInput ? lksInput.value.trim().toUpperCase() : "";

  if (!currentLKS) {
    resetFormScan();
    showToast("Form berhasil di-reset", "success");
    fokuskanInputUtama();
    return;
  }

  const tx = db.transaction(["input_so"], "readonly");
  const store = tx.objectStore("input_so");
  const req = store.getAll();

  req.onsuccess = () => {
    const allData = req.result || [];
    const itemsDiLokasi = allData.filter(item => {
      const itemLKS = item.lks ? String(item.lks).trim().toUpperCase() : "";
      return itemLKS === currentLKS && item.status !== "saved";
    });

    if (itemsDiLokasi.length === 0) {
      resetFormScan();
      showToast(`Data di Lokasi ${currentLKS} sudah kosong`, "success");
      fokuskanInputUtama();
      return;
    }

    showCustomConfirm({
      title: `Hapus Data Lokasi ${currentLKS}?`,
      msg: `Yakin ingin menghapus seluruh ${itemsDiLokasi.length} item scan di lokasi ${currentLKS}?`,
      iconType: "trash",
      btnConfirmText: "Ya, Hapus Semua",
      btnConfirmClass: "btn-danger",
      onConfirm: () => {
        const txDelete = db.transaction(["input_so"], "readwrite");
        const storeDelete = txDelete.objectStore("input_so");

        itemsDiLokasi.forEach(item => {
          storeDelete.delete(item.id);
        });

        txDelete.oncomplete = () => {
          resetFormScan();
          resetDraftScan();
          showToast(`Seluruh data di Lokasi ${currentLKS} berhasil dihapus!`, "success");
          refreshUI();
          if (lksInput) lksInput.value = "";
          fokuskanInputUtama();
        };
      }
    });
  };
}

function resetFormScan() {
  document.getElementById("edit-id-so").value = "";
  document.getElementById("barcode").value = "";
  document.getElementById("nama_barang").value = "";
  
  const qtyInput = document.getElementById("qty");
  if (qtyInput) {
    qtyInput.value = "1";
    qtyInput.disabled = true;
    qtyInput.style.background = "#f8fafc";
    qtyInput.style.color = "var(--text-muted)";
  }

  if (document.getElementById("keterangan")) {
    document.getElementById("keterangan").value = "";
  }
  isReadyToSaveQty = false;
  kunciInputNama();

  const btnSimpan = document.getElementById("btn-simpan-entry");
  if (btnSimpan) {
    btnSimpan.title = "Simpan Entry";
    btnSimpan.style.background = "var(--primary)";
    btnSimpan.innerHTML = `
      <svg style="width: 15px; height: 15px; stroke: currentColor; fill: none;" viewBox="0 0 24 24" stroke-width="2.5">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>`;
  }
}

function hapusInputSO(id) {
  showCustomConfirm({
    title: "Hapus Entry SO?",
    msg: "Yakin ingin menghapus item SO ini dari daftar scan?",
    iconType: "trash",
    btnConfirmText: "Ya, Hapus",
    btnConfirmClass: "btn-danger",
    onConfirm: () => {
      const tx = db.transaction("input_so", "readwrite");
      const store = tx.objectStore("input_so");
      store.delete(id);

      tx.oncomplete = () => {
        resetFormScan();
        simpanDraftScanKeLokal(); // Update draft setelah hapus item
        showToast("Data SO berhasil dihapus!", "success");
        refreshUI();
      };
    }
  });
}

function showCustomConfirm(options) {
  const modal = document.getElementById("modal-confirm");
  if (!modal) return;

  const titleEl = modal.querySelector("h3");
  const msgEl = document.getElementById("modal-confirm-msg");
  const btnYa = document.getElementById("btn-modal-ya");
  const btnBatal = document.getElementById("btn-modal-batal");
  const iconContainer = modal.querySelector(".modal-card > div:first-child");

  if (typeof options === "string") {
    options = {
      title: "Simpan & Finalisasi?",
      msg: options,
      onConfirm: arguments[1]
    };
  }

  if (titleEl) titleEl.innerText = options.title || "Konfirmasi";
  if (msgEl) msgEl.innerText = options.msg || "Apakah Anda yakin?";
  if (btnYa) {
    btnYa.innerText = options.btnConfirmText || "Ya, Simpan";
    btnYa.style.background = options.btnConfirmClass === "btn-danger" ? "#dc2626" : "var(--primary)";
  }

  if (iconContainer) {
    if (options.iconType === "trash") {
      iconContainer.style.background = "#fee2e2";
      iconContainer.style.color = "#dc2626";
      iconContainer.innerHTML = `<svg style="width: 20px; height: 20px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;
    } else {
      iconContainer.style.background = "#ecfdf5";
      iconContainer.style.color = "var(--primary)";
      iconContainer.innerHTML = `<svg style="width: 18px; height: 18px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;
    }
  }

  modal.classList.add("show");

  btnYa.onclick = () => {
    modal.classList.remove("show");
    if (typeof options.onConfirm === "function") options.onConfirm();
  };

  btnBatal.onclick = () => {
    modal.classList.remove("show");
    if (typeof options.onCancel === "function") options.onCancel();
  };
}

function bukaKameraScan() {
  const lks = document.getElementById("lks").value.trim();
  if (!lks) {
    return showToast("Kode Lokasi harus diisi dulu!", "error");
  }

  const container = document.getElementById("inline-camera-container");
  if (container) {
    container.style.display = "block";
  }

  if (html5QrScannerInstance) return;

  try {
    html5QrScannerInstance = new Html5Qrcode("interactive");
    html5QrScannerInstance.start(
      { facingMode: "environment" },
      { fps: 15, qrbox: { width: 220, height: 90 } },
      (decodedText) => {
        window.latestScannedCode = decodedText;
      },
      (errorMessage) => {}
    ).catch(err => {
      console.error("Kamera error:", err);
      showToast("Gagal mengakses kamera!", "error");
      tutupKameraScan();
    });
  } catch (err) {
    console.error(err);
  }
}

function captureScanKamera() {
  const code = window.latestScannedCode;
  if (!code) {
    return showToast("Arahkan kamera ke barcode lalu klik Ambil Scan di bawah!", "error");
  }

  document.getElementById("barcode").value = code;
  playBeep();
  cariBarangOtomatis();
}

function tutupKameraScan() {
  const container = document.getElementById("inline-camera-container");
  if (container) {
    container.style.display = "none";
  }

  window.latestScannedCode = null;

  if (html5QrScannerInstance) {
    html5QrScannerInstance.stop().then(() => {
      html5QrScannerInstance = null;
    }).catch(() => {
      html5QrScannerInstance = null;
    });
  }
}