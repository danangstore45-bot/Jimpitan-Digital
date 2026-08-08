const ADMIN_ALLOWED = ["Luthi Tyan"];
const BLOCK_NAMES = ["Blok 1", "Blok 2", "Blok 3", "Blok 4"];

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function getSettingsSheet() {
  return getOrCreateSheet("Settings", ["key", "value"]);
}

function getRiwayatSheet() {
  return getOrCreateSheet("Riwayat", ["tanggal", "waktu", "nama", "nominal", "petugas", "blok"]);
}

function getWargaSheet() {
  return getOrCreateSheet("Warga", ["nama", "blok", "total_transaksi", "total_nominal"]);
}

function getSummarySheet() {
  return getOrCreateSheet("Ringkasan", ["Blok", "Jumlah Data", "Total Uang"]);
}

function getBlockSheetName(blok) {
  const value = String(blok || "").trim();
  if (!value) return "";
  return value.toLowerCase().indexOf("blok") === 0 ? value : "Blok " + value;
}

function getBlockSheet(blok) {
  const name = getBlockSheetName(blok);
  if (!name) return null;
  return getOrCreateSheet(name, ["Waktu", "Nama Warga", "Nominal", "Petugas", "Jam", "Tanggal", "Blok"]);
}

function getSetting(key, fallback) {
  const sheet = getSettingsSheet();
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim().toLowerCase() === String(key).trim().toLowerCase()) {
      return values[i][1];
    }
  }

  if (fallback !== undefined) {
    setSetting(key, fallback);
    return fallback;
  }

  return "";
}

function setSetting(key, value) {
  const sheet = getSettingsSheet();
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim().toLowerCase() === String(key).trim().toLowerCase()) {
      sheet.getRange(i + 1, 2).setValue(value);
      return value;
    }
  }

  sheet.appendRow([key, value]);
  return value;
}

function normalizeNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function isAuthorized(petugasName) {
  const name = String(petugasName || "").trim();
  return ADMIN_ALLOWED.includes(name);
}

function getCurrentSaldo() {
  const value = normalizeNumber(getSetting("saldo_jimpitan", 1420000));
  return value;
}

function getHistoryRows() {
  const sheet = getRiwayatSheet();
  const values = sheet.getDataRange().getValues();
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[2]) continue;
    rows.push({
      tanggal: row[0],
      waktu: row[1],
      nama: row[2],
      nominal: Number(row[3] || 0),
      petugas: row[4],
      blok: row[5]
    });
  }

  return rows.reverse();
}

function rebuildWargaSummary() {
  const sheet = getWargaSheet();
  const data = getHistoryRows();
  const map = {};

  for (const item of data) {
    const key = String(item.nama || "").trim();
    if (!key) continue;
    if (!map[key]) {
      map[key] = { nama: key, blok: item.blok || "", total_transaksi: 0, total_nominal: 0 };
    }
    map[key].total_transaksi += 1;
    map[key].total_nominal += normalizeNumber(item.nominal);
  }

  const rows = Object.values(map);
  const target = rows.length ? rows : [];
  const existing = sheet.getDataRange();
  if (existing.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).clearContent();
  }

  if (target.length > 0) {
    const values = target.map((item) => [
      item.nama,
      item.blok,
      item.total_transaksi,
      item.total_nominal
    ]);
    sheet.getRange(2, 1, values.length, 4).setValues(values);
  }

  return target;
}

function updateLegacySummarySheet() {
  const summarySheet = getSummarySheet();
  const data = [];

  BLOCK_NAMES.forEach((blockName) => {
    const sheet = getBlockSheet(blockName);
    const values = sheet ? sheet.getDataRange().getValues() : [];
    const rows = values.slice(1);

    let totalData = 0;
    let totalUang = 0;

    rows.forEach((row) => {
      if (!row[1]) return;
      totalData += 1;
      totalUang += Number(row[2] || 0);
    });

    data.push([blockName, totalData, totalUang]);
  });

  const startRow = 2;
  const endRow = startRow + data.length - 1;

  summarySheet.getRange(startRow, 1, data.length, 3).clearContent();
  summarySheet.getRange(startRow, 1, data.length, 3).setValues(data);

  const range = summarySheet.getRange(1, 1, summarySheet.getLastRow(), 3);
  range.setBorder(true, true, true, true, true, true);
  summarySheet.setColumnWidths(1, 3, 180);
}

function getBlokSummary() {
  const data = getHistoryRows();
  const map = {};

  for (let i = 1; i <= 4; i++) {
    map[String(i)] = { blok: String(i), total_transaksi: 0, total_nominal: 0 };
  }

  for (const item of data) {
    const blok = String(item.blok || "").trim();
    if (!map[blok]) continue;
    map[blok].total_transaksi += 1;
    map[blok].total_nominal += normalizeNumber(item.nominal);
  }

  return Object.values(map).map((item) => ({
    blok: item.blok,
    total_transaksi: item.total_transaksi,
    total_nominal: item.total_nominal
  }));
}

function legacySaveToBlockSheet(payload) {
  const blokValue = String(payload.blok || "").trim();
  if (!blokValue) {
    throw new Error("Blok tidak boleh kosong");
  }

  const blokName = getBlockSheetName(blokValue);
  const sheet = getBlockSheet(blokName);
  const row = [
    payload.waktu || new Date().toLocaleTimeString("id-ID"),
    payload.nama || "",
    Number(payload.nominal || 0),
    payload.petugas || "",
    payload.waktu || "",
    payload.tanggal || new Date().toLocaleDateString("id-ID"),
    blokName
  ];

  sheet.appendRow(row);
  updateLegacySummarySheet();
  return blokName;
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || "saldo";

  if (action === "saldo") {
    return jsonOut({ ok: true, saldo: getCurrentSaldo() });
  }

  if (action === "riwayat") {
    return jsonOut({ ok: true, data: getHistoryRows() });
  }

  if (action === "warga") {
    return jsonOut({ ok: true, data: rebuildWargaSummary() });
  }

  if (action === "blok") {
    return jsonOut({ ok: true, data: getBlokSummary() });
  }

  if (action === "ringkasan") {
    updateLegacySummarySheet();
    return jsonOut({ ok: true, data: getSummarySheet().getDataRange().getValues().slice(1) });
  }

  return jsonOut({
    ok: true,
    status: "ok",
    message: "Google Apps Script aktif"
  });
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    const action = payload.action || "save_jimpitan";

    if (action === "set_saldo") {
      if (!isAuthorized(payload.petugas)) {
        return jsonOut({ ok: false, error: "Akses diizinkan hanya untuk petugas tertentu" });
      }

      const newSaldo = normalizeNumber(payload.saldo);
      setSetting("saldo_jimpitan", newSaldo);
      return jsonOut({ ok: true, saldo: newSaldo });
    }

    if (action === "save_jimpitan") {
      const tanggal = payload.tanggal || new Date().toLocaleDateString("id-ID");
      const waktu = payload.waktu || new Date().toLocaleTimeString("id-ID");
      const nama = String(payload.nama || "").trim();
      const nominal = normalizeNumber(payload.nominal);
      const petugas = String(payload.petugas || "").trim();
      const blok = String(payload.blok || "").trim();

      if (!nama) {
        return jsonOut({ ok: false, error: "Nama warga tidak boleh kosong" });
      }

      const riwayatSheet = getRiwayatSheet();
      riwayatSheet.appendRow([tanggal, waktu, nama, nominal, petugas, blok]);

      const blockSheetName = legacySaveToBlockSheet({
        nama,
        nominal,
        petugas,
        waktu,
        tanggal,
        blok
      });

      const currentSaldo = getCurrentSaldo();
      const nextSaldo = currentSaldo + nominal;
      setSetting("saldo_jimpitan", nextSaldo);
      rebuildWargaSummary();
      updateLegacySummarySheet();

      return jsonOut({
        ok: true,
        status: "success",
        message: "Data berhasil disimpan ke sheet " + blockSheetName,
        saldo: nextSaldo,
        data: {
          tanggal,
          waktu,
          nama,
          nominal,
          petugas,
          blok
        }
      });
    }

    if (!payload.action) {
      const blokName = legacySaveToBlockSheet(payload);
      return jsonOut({
        ok: true,
        status: "success",
        message: "Data berhasil disimpan ke sheet " + blokName
      });
    }

    return jsonOut({ ok: false, error: "Action tidak dikenal" });
  } catch (err) {
    return jsonOut({
      ok: false,
      status: "error",
      message: err.message
    });
  }
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: "ok",
      message: "Google Apps Script aktif"
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
