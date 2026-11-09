function renderLaporanUI() {
  if (!db) return;

  const tx = db.transaction("input_so", "readonly");
  const store = tx.objectStore("input_so");
  const req = store.getAll();

  req.onsuccess = () => {
    const data = req.result || [];
    
    // Kelompokkan data berdasarkan LKS (hanya yang status 'saved')
    const grouped = {};
    data.forEach(item => {
      if (item.status === "saved") {
        const lks = item.lks ? String(item.lks).trim().toUpperCase() : "TANPA LOKASI";
        if (!grouped[lks]) {
          grouped[lks] = {
            lks: lks,
            totalItems: 0,
            totalQty: 0,
            isExported: item.isExported || false, // Status export per lokasi
            details: []
          };
        }
        grouped[lks].totalItems += 1;
        grouped[lks].totalQty += (parseInt(item.qty) || 0);
        grouped[lks].details.push(item);
      }
    });

    const lksKeys = Object.keys(grouped).sort();
    
    const countRekap = document.getElementById("count-rekap-lks");
    if (countRekap) countRekap.innerText = `${lksKeys.length} Lokasi Terdata`;

    const tbody = document.getElementById("tabel-laporan-rekap");
    if (!tbody) return;

    if (lksKeys.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--text-muted); padding:12px;">Belum ada data lokasi yang disimpan.</td></tr>`;
      return;
    }

    tbody.innerHTML = lksKeys.map((lks, index) => {
      const row = grouped[lks];
      // Tampilan badge status export
      const statusBadge = row.isExported 
        ? `<span style="background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px; font-size: 0.62rem; font-weight: 600;">Sudah</span>` 
        : `<span style="background: #fef9c3; color: #854d0e; padding: 2px 6px; border-radius: 4px; font-size: 0.62rem; font-weight: 600;">Belum</span>`;

      return `
        <tr>
          <td><b>${index + 1}</b></td>
          <td><code>${row.lks}</code></td>
          <td><b>${row.totalItems}</b> Item</td>
          <td><b>${row.totalQty}</b> Pcs</td>
          <td>${statusBadge}</td>
          <td style="text-align: right;">
            <div class="action-btn-group" style="justify-content: flex-end;">
              <button class="btn-icon" title="Edit Lokasi Ini" onclick="editLokasiDariLaporan('${row.lks}')" style="background: #fef3c7; color: #d97706;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn-icon" title="Lihat Detail & Export" onclick="lihatDetailLKS('${row.lks}')" style="background: #e0f2fe; color: #0284c7;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button class="btn-icon" title="Export ke Text (.txt)" onclick="exportLokasiKeText('${row.lks}')" style="background: #ecfdf5; color: #059669;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  };
}

// Fungsi Edit Lokasi dari Laporan
function editLokasiDariLaporan(lksCode) {
  showCustomConfirm({
    title: `Edit Lokasi ${lksCode}?`,
    msg: `Data lokasi ${lksCode} akan ditarik kembali ke form Scan untuk diedit atau ditambah itemnya. Lanjutkan?`,
    iconType: "save",
    btnConfirmText: "Ya, Edit",
    onConfirm: () => {
      const tx = db.transaction(["input_so"], "readwrite");
      const store = tx.objectStore("input_so");
      const req = store.getAll();

      req.onsuccess = () => {
        const data = req.result || [];
        data.forEach(item => {
          const itemLKS = item.lks ? String(item.lks).trim().toUpperCase() : "";
          if (itemLKS === lksCode && item.status === "saved") {
            item.status = "active";
            item.isExported = false; // Reset status export jika diedit kembali
            store.put(item);
          }
        });

        tx.oncomplete = () => {
          showToast(`Lokasi ${lksCode} dibuka kembali untuk diedit!`, "success");
          switchNav("scan", "Scan Data");
          setTimeout(() => {
            const lksInput = document.getElementById("lks");
            if (lksInput) {
              lksInput.value = lksCode;
            }
            refreshUI();
            if (typeof fokuskanInputUtama === "function") {
              fokuskanInputUtama();
            }
          }, 100);
        };
      };
    }
  });
}

function lihatDetailLKS(lksCode) {
  const tx = db.transaction("input_so", "readonly");
  const store = tx.objectStore("input_so");
  const req = store.getAll();

  req.onsuccess = () => {
    const data = req.result || [];
    const filtered = data.filter(item => {
      const itemLKS = item.lks ? String(item.lks).trim().toUpperCase() : "";
      return itemLKS === lksCode && item.status === "saved";
    });

    const modal = document.getElementById("modal-detail-lks");
    const titleEl = document.getElementById("modal-detail-title");
    const tbody = document.getElementById("tabel-detail-lks-body");

    if (titleEl) titleEl.innerText = `Rincian Barang - Lokasi: ${lksCode}`;
    
    if (tbody) {
      tbody.innerHTML = filtered.map((item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><code>${item.barcode}</code></td>
          <td>${item.nama_barang}</td>
          <td><b>${item.qty}</b></td>
          <td><span style="font-size:0.65rem; color: #d97706;">${item.keterangan || '-'}</span></td>
        </tr>
      `).join('');
    }

    const modalCard = modal.querySelector(".modal-card");
    let exportBtnContainer = document.getElementById("modal-export-btn-container");
    if (!exportBtnContainer) {
      exportBtnContainer = document.createElement("div");
      exportBtnContainer.id = "modal-export-btn-container";
      exportBtnContainer.style.marginTop = "10px";
      modalCard.appendChild(exportBtnContainer);
    }
    exportBtnContainer.innerHTML = `
      <button class="btn btn-secondary btn-sm" onclick="exportLokasiKeText('${lksCode}')" style="width: 100%; background: #059669; color: white; border: none;">
        📁 Export Lokasi ${lksCode} ke Text (.txt)
      </button>
    `;

    if (modal) modal.classList.add("show");
  };
}

function tutupModalDetailLKS() {
  const modal = document.getElementById("modal-detail-lks");
  if (modal) modal.classList.remove("show");
}

// Fungsi Export Mandiri (Per Baris / Tombol Detail) -> Menandai lokasi tersebut jadi "Sudah"
function exportLokasiKeText(lksCode) {
  const tx = db.transaction("input_so", "readwrite");
  const store = tx.objectStore("input_so");
  const req = store.getAll();

  req.onsuccess = () => {
    const data = req.result || [];
    const filtered = data.filter(item => {
      const itemLKS = item.lks ? String(item.lks).trim().toUpperCase() : "";
      return itemLKS === lksCode && item.status === "saved";
    });

    if (filtered.length === 0) {
      return showToast(`Tidak ada data untuk lokasi ${lksCode}`, "error");
    }

    const isKetEnabled = localStorage.getItem("keterangan_enabled") === "true";
    let fileContent = "";

    filtered.forEach(item => {
      const barcode = item.barcode || "";
      const qty = item.qty || 0;
      const ket = item.keterangan ? item.keterangan.trim() : "";

      if (isKetEnabled) {
        fileContent += `${barcode},${qty},${ket}\n`;
      } else {
        fileContent += `${barcode},${qty}\n`;
      }

      // Tandai item di lokasi ini sudah di-export
      item.isExported = true;
      store.put(item);
    });

    tx.oncomplete = () => {
      const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${lksCode}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`File ${lksCode}.txt berhasil di-export!`, "success");
      renderLaporanUI(); // Refresh UI untuk memperbarui status badge
    };
  };
}

// Fungsi "Export Semua" -> Hanya mengexport lokasi yang statusnya "Belum"
function exportSemuaLokasiKeText() {
  if (!db) return;

  const tx = db.transaction("input_so", "readonly");
  const store = tx.objectStore("input_so");
  const req = store.getAll();

  req.onsuccess = () => {
    const data = req.result || [];
    // Hanya ambil data saved yang statusnya BELUM di-export (!isExported)
    const pendingData = data.filter(item => item.status === "saved" && !item.isExported);

    if (pendingData.length === 0) {
      return showToast("Semua lokasi sudah pernah di-export! Tidak ada data baru.", "info");
    }

    // Kelompokkan data yang belum di-export berdasarkan kode lokasi (LKS)
    const groupedByLks = {};
    pendingData.forEach(item => {
      const lksKey = item.lks ? String(item.lks).trim().toUpperCase() : "TANPA_LOKASI";
      if (!groupedByLks[lksKey]) {
        groupedByLks[lksKey] = [];
      }
      groupedByLks[lksKey].push(item);
    });

    const lksKeys = Object.keys(groupedByLks);
    if (lksKeys.length === 0) {
      return showToast("Tidak ada lokasi baru yang perlu di-export.", "info");
    }

    const isKetEnabled = localStorage.getItem("keterangan_enabled") === "true";
    showToast(`Mulai mengexport ${lksKeys.length} lokasi baru...`, "success");

    // Loop download file satu per satu dengan jeda aman
    lksKeys.forEach((lksCode, index) => {
      const items = groupedByLks[lksCode];
      let fileContent = "";

      items.forEach(item => {
        const barcode = item.barcode || "";
        const qty = item.qty || 0;
        const ket = item.keterangan ? item.keterangan.trim() : "";

        if (isKetEnabled) {
          fileContent += `${barcode},${qty},${ket}\n`;
        } else {
          fileContent += `${barcode},${qty}\n`;
        }
      });

      setTimeout(() => {
        const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${lksCode}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Setelah file terdownload, ubah status lokasi ini menjadi sudah di-export di database
        tandaiLokasiSudahExport(lksCode);
      }, index * 400);
    });
  };
}

// Fungsi bantu untuk memperbarui status isExported di IndexedDB
function tandaiLokasiSudahExport(lksCode) {
  const tx = db.transaction("input_so", "readwrite");
  const store = tx.objectStore("input_so");
  const req = store.getAll();

  req.onsuccess = () => {
    const data = req.result || [];
    data.forEach(item => {
      const itemLKS = item.lks ? String(item.lks).trim().toUpperCase() : "";
      if (itemLKS === lksCode && item.status === "saved") {
        item.isExported = true;
        store.put(item);
      }
    });

    tx.oncomplete = () => {
      renderLaporanUI(); // Refresh tabel agar badge berubah jadi "Sudah"
    };
  };
}