function renderBerandaUI() {
  const txSO = db.transaction("input_so", "readonly");
  const reqSO = txSO.objectStore("input_so").getAll();

  reqSO.onsuccess = () => {
    const data = reqSO.result;
    document.getElementById("stat-total-items").innerText = data.length;
    const totalQty = data.reduce((acc, item) => acc + item.qty, 0);
    document.getElementById("stat-total-qty").innerText = totalQty;
  };
}