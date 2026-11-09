let currentPageMaster = 1;
const itemsPerPageMaster = 10;
let filteredMasterData = [];

function renderMasterUI() {
  if (!db) return;

  const tx = db.transaction("master_barang", "readonly");
  const store = tx.objectStore("master_barang");
  const req = store.getAll();

  req.onsuccess = () => {
    masterBarangList = req.result || [];
    
    // Update counter total
    const countBadge = document.getElementById("count-master-data");
    if (countBadge) countBadge.innerText = `${masterBarangList.length} Item`;

    // Filter pencarian
    const keyword = (document.getElementById("search-master")?.value || "").toLowerCase().trim();
    if (keyword) {
      filteredMasterData = masterBarangList.filter(item => 
        item.barcode.toLowerCase().includes(keyword) || 
        item.nama_barang.toLowerCase().includes(keyword)
      );
    } else {
      filteredMasterData = masterBarangList;
    }

    tampilkanHalamanMaster(currentPageMaster);
  };
}

function tampilkanHalamanMaster(page) {
  currentPageMaster = page;
  const tbody = document.getElementById("tabel-master-barang");
  if (!tbody) return;

  if (filteredMasterData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color: var(--text-muted); padding:16px;">Tidak ada data master barang.</td></tr>`;
    renderPaginationMasterControls(0, 1);
    return;
  }

  const totalPages = Math.ceil(filteredMasterData.length / itemsPerPageMaster);
  if (currentPageMaster > totalPages) currentPageMaster = totalPages;
  if (currentPageMaster < 1) currentPageMaster = 1;

  const startIndex = (currentPageMaster - 1) * itemsPerPageMaster;
  const endIndex = startIndex + itemsPerPageMaster;
  const pageItems = filteredMasterData.slice(startIndex, endIndex);

  tbody.innerHTML = pageItems.map(item => `
    <tr>
      <td><code>${item.barcode}</code></td>
      <td><b>${item.nama_barang}</b></td>
      <td>
        <div class="action-btn-group">
          <button class="btn-icon edit" title="Edit Data" onclick="editMasterBarang('${item.barcode}', '${item.nama_barang.replace(/'/g, "\\'")}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon delete" title="Hapus Data" onclick="hapusMasterBarang('${item.barcode}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  renderPaginationMasterControls(totalPages, currentPageMaster);
}

function renderPaginationMasterControls(totalPages, page) {
  let container = document.getElementById("pagination-master-container");
  
  // Buat kontainer paginasi jika belum ada di HTML
  if (!container) {
    const tableCard = document.querySelector("#view-master .card .table-container");
    if (tableCard) {
      container = document.createElement("div");
      container.id = "pagination-master-container";
      container.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--border);";
      tableCard.after(container);
    } else return;
  }

  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <button class="btn btn-secondary btn-sm" onclick="tampilkanHalamanMaster(${page - 1})" ${page === 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
      &laquo; Prev
    </button>
    <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">
      Hal ${page} dari ${totalPages}
    </span>
    <button class="btn btn-secondary btn-sm" onclick="tampilkanHalamanMaster(${page + 1})" ${page === totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
      Next &raquo;
    </button>
  `;
}

function filterMasterBarang() {
  currentPageMaster = 1;
  renderMasterUI();
}

function bukaModalMaster(barcode = "", nama = "") {
  document.getElementById("edit-original-barcode").value = barcode;
  document.getElementById("new-barcode").value = barcode;
  document.getElementById("new-nama-barang").value = nama;
  document.getElementById("modal-master-title").innerText = barcode ? "Edit Master Barang" : "Tambah Master Barang";

  const modal = document.getElementById("modal-master");
  if (modal) modal.classList.add("show");
}

function tutupModalMaster() {
  const modal = document.getElementById("modal-master");
  if (modal) modal.classList.remove("show");
}

function simpanMasterBarangBaru() {
  const origBarcode = document.getElementById("edit-original-barcode").value;
  const barcode = document.getElementById("new-barcode").value.trim();
  const nama = document.getElementById("new-nama-barang").value.trim();

  if (!barcode || !nama) return showToast("Lengkapi Barcode dan Nama Barang!", "error");

  const tx = db.transaction("master_barang", "readwrite");
  const store = tx.objectStore("master_barang");

  if (origBarcode && origBarcode !== barcode) {
    store.delete(origBarcode);
  }

  store.put({ barcode, nama_barang: nama });

  tx.oncomplete = () => {
    tutupModalMaster();
    showToast("Master barang berhasil disimpan!", "success");
    refreshUI();
  };
}

function editMasterBarang(barcode, nama) {
  bukaModalMaster(barcode, nama);
}

function hapusMasterBarang(barcode) {
  showCustomConfirm(`Yakin ingin menghapus master barang '${barcode}'?`, () => {
    const tx = db.transaction("master_barang", "readwrite");
    const store = tx.objectStore("master_barang");
    store.delete(barcode);

    tx.oncomplete = () => {
      showToast("Master barang berhasil dihapus!", "success");
      refreshUI();
    };
  });
}