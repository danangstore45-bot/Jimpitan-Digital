const SCRIPT_URL = "https://script.google.com/macros/s/AKfycby3nIX9yUJ1mOsgLiRNPNYHEywkJkvWSKHexm3e35lsZ812Vfbj_RwEJpGY1upv7ho0/exec";
let pengambilanAktif = false;
let scannerBerjalan = false;
let jumlahSesi = 0;                       
let totalSesi = 0;
let petugasAktif = "";
let blokAktif = "";
let isSaving = false;
const AUTHORIZED_SALDO_EDITORS = ['Luthi Tyan'];
const VIBRATION_KEY = 'jimpitan_vibration_enabled';
const THEME_KEY = 'jimpitan_theme';
const TARGET_KAS_KEY = 'targetJimpitanBulan';

function isVibrationEnabled() {
    const saved = localStorage.getItem(VIBRATION_KEY);
    if (saved === null) return true;
    return saved === 'true';
}

function setVibrationEnabled(enabled) {
    localStorage.setItem(VIBRATION_KEY, String(enabled));
    const toggle = document.getElementById('geterToggle');
    if (toggle) {
        toggle.classList.toggle('bg-indigo-600', enabled);
        toggle.classList.toggle('bg-slate-300', !enabled);
        const thumb = toggle.querySelector('span');
        if (thumb) {
            thumb.classList.toggle('translate-x-6', enabled);
            thumb.classList.toggle('translate-x-1', !enabled);
        }
    }
}

function getThemeMode() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === 'dark' || savedTheme === 'light') {
        return savedTheme;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme() {
    const mode = getThemeMode();
    const isDark = mode === 'dark';
    document.documentElement.classList.toggle('dark', isDark);

    const toggle = document.getElementById('themeToggle');
    if (toggle) {
        toggle.classList.toggle('bg-indigo-600', isDark);
        toggle.classList.toggle('bg-slate-300', !isDark);
        const thumb = toggle.querySelector('span');
        if (thumb) {
            thumb.classList.toggle('translate-x-6', isDark);
            thumb.classList.toggle('translate-x-1', !isDark);
        }
    }
}

function toggleThemeMode() {
    const nextMode = getThemeMode() === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, nextMode);
    applyTheme();
}

function toggleVibrationSetting() {
    const enabled = !isVibrationEnabled();
    setVibrationEnabled(enabled);
}

function toggleSettingsPanel() {
    showSettingsScreen();
}

function toggleSettingPanel(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const isHidden = panel.classList.contains('hidden');
    document.querySelectorAll('[data-setting-panel]').forEach((item) => {
        if (item !== panel) item.classList.add('hidden');
    });
    panel.classList.toggle('hidden', !isHidden);
}

function showSettingsScreen() {
    animateScreen('settingsScreen', 'next');
}

function showAboutDialog() {
    Swal.fire({
        title: 'About',
        html: '<p style="margin:0; line-height:1.6;">Aplikasi ini masih dalam uji coba.</p>',
        icon: 'info',
        confirmButtonText: 'OK',
        confirmButtonColor: '#4f46e5'
    });
}

function resetSettings() {
    localStorage.removeItem(VIBRATION_KEY);
    localStorage.removeItem(THEME_KEY);
    setVibrationEnabled(true);
    applyTheme();
    toggleSettingsPanel();

    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Pengaturan direset',
        showConfirmButton: false,
        timer: 1800,
        timerProgressBar: true
    });
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error('Network error');
    }
    return response.json();
}

async function syncSaldoFromServer() {
    try {
        const result = await fetchJson(`${SCRIPT_URL}?action=saldo`);
        if (result && result.ok && typeof result.saldo !== 'undefined') {
            localStorage.setItem('saldoJimpitan', String(result.saldo));
            updateSaldoDisplay();
        }
    } catch (err) {
        console.warn('Gagal mengambil saldo dari server:', err);
    }
}

async function syncRiwayatFromServer() {
    try {
        const result = await fetchJson(`${SCRIPT_URL}?action=riwayat`);
        if (result && result.ok && Array.isArray(result.data)) {
            localStorage.setItem('jimpitan', JSON.stringify(result.data));
            updateTable();
            renderDaftarWarga();
        }
    } catch (err) {
        console.warn('Gagal mengambil riwayat dari server:', err);
    }
}

async function syncWargaFromServer() {
    try {
        const result = await fetchJson(`${SCRIPT_URL}?action=warga`);
        if (result && result.ok && Array.isArray(result.data)) {
            localStorage.setItem('wargaJimpitan', JSON.stringify(result.data));
            renderDaftarWarga();
        }
    } catch (err) {
        console.warn('Gagal mengambil data kelompok/warga dari server:', err);
    }
}

async function syncBlokFromServer() {
    try {
        const result = await fetchJson(`${SCRIPT_URL}?action=blok`);
        if (result && result.ok && Array.isArray(result.data)) {
            localStorage.setItem('blokJimpitan', JSON.stringify(result.data));
            renderBlokSummary();
        }
    } catch (err) {
        console.warn('Gagal mengambil summary blok dari server:', err);
    }
}

function setPetugas(name) {
    petugasAktif = name;
    window.namaPetugas = name;
    const petugasNameEl = document.getElementById('petugasName');
    if (petugasNameEl) {
        petugasNameEl.textContent = name || 'Belum dipilih';
    }
}

function setBlok(blok) {
    blokAktif = blok;
    const blokNameEl = document.getElementById('blokName');
    if (blokNameEl) {
        blokNameEl.textContent = blok ? `Blok ${blok}` : 'Belum dipilih';
    }
    const blokEl = document.getElementById('blok');
    if (blokEl) {
        blokEl.value = blok || "";
    }
}

function updateInputsState() {
    const disabled = !pengambilanAktif || isSaving;
    const blokEl = document.getElementById('blok');
    if (blokEl) blokEl.disabled = true;
    document.getElementById('wargaId').disabled = disabled;
    document.getElementById('jumlah').disabled = disabled;
    document.getElementById('btnSimpan').disabled = disabled;
}

function getSaldoSaatIni() {
    const value = Number(localStorage.getItem('saldoJimpitan') || 1420000);
    return Number.isFinite(value) ? value : 0;
}

function getTargetBulanSaatIni() {
    const value = Number(localStorage.getItem(TARGET_KAS_KEY) || 2000000);
    return Number.isFinite(value) && value > 0 ? value : 0;
}

function getCurrentMonthLabel() {
    return new Date().toLocaleString('id-ID', { month: 'long' });
}

function getTargetPercentage() {
    const saldo = getSaldoSaatIni();
    const target = getTargetBulanSaatIni();
    if (!target) return 0;
    return Math.min((saldo / target) * 100, 100);
}

function getWargaOptions() {
    const storedWarga = JSON.parse(localStorage.getItem('wargaJimpitan') || '[]');
    const storedRiwayat = JSON.parse(localStorage.getItem('jimpitan') || '[]');
    const names = [];

    const collect = (items) => {
        if (!Array.isArray(items)) return;
        items.forEach((item) => {
            const nama = typeof item?.nama === 'string' ? item.nama.trim() : '';
            if (nama && !names.includes(nama)) names.push(nama);
        });
    };

    collect(storedWarga);
    collect(storedRiwayat);
    return names.sort((a, b) => a.localeCompare(b, 'id'));
}

function validateWargaName(name) {
    const clean = String(name || '').trim();
    if (!clean) return false;
    return getWargaOptions().includes(clean);
}

function updateWargaOptions() {
    const input = document.getElementById('wargaId');
    const datalist = document.getElementById('wargaListOptions');
    if (!input || !datalist) return;

    const options = getWargaOptions();
    datalist.innerHTML = options.map((nama) => `<option value="${nama}"></option>`).join('');
    input.setAttribute('placeholder', options.length ? 'Pilih nama warga yang valid' : 'Belum ada data warga');
}

function updateTotalWargaDisplay() {
    const el = document.getElementById('totalWargaText');
    const total = getWargaOptions().length;
    if (el) {
        el.textContent = `Total data warga: ${total}`;
    }
}

function updateSaldoDisplay() {
    const saldoEl = document.getElementById('saldoDisplay');
    const saldo = getSaldoSaatIni();
    if (saldoEl) {
        saldoEl.textContent = `Rp ${saldo.toLocaleString('id-ID')}`;
    }

    const periodeEl = document.getElementById('periodeLabel');
    if (periodeEl) {
        const monthName = getCurrentMonthLabel();
        periodeEl.textContent = `Periode ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`;
    }

    const targetTextEl = document.getElementById('targetText');
    const targetProgressBar = document.getElementById('targetProgressBar');
    const target = getTargetBulanSaatIni();
    const percentage = getTargetPercentage();

    if (targetTextEl) {
        targetTextEl.textContent = `Target bulan ini: Rp ${target.toLocaleString('id-ID')} (${Math.round(percentage)}% tercapai)`;
    }

    if (targetProgressBar) {
        targetProgressBar.style.width = `${percentage}%`;
    }

    updateTotalWargaDisplay();
    updateWargaOptions();
}

function editTargetJimpitan() {
    if (!petugasAktif || !AUTHORIZED_SALDO_EDITORS.includes(petugasAktif.trim())) {
        Swal.fire({
            title: 'Akses dibatasi',
            text: 'Hanya petugas tertentu yang bisa mengubah target bulanan. Pilih petugas yang berwenang terlebih dahulu.',
            icon: 'warning',
            confirmButtonText: 'Pilih Petugas',
            confirmButtonColor: '#4f46e5'
        }).then(() => {
            gantiPetugas();
        });
        return;
    }

    const currentTarget = getTargetBulanSaatIni();

    Swal.fire({
        title: 'Ubah Target Bulanan',
        input: 'number',
        inputLabel: 'Masukkan nominal target baru',
        inputValue: currentTarget,
        inputAttributes: {
            min: 0,
            step: 1000,
        },
        showCancelButton: true,
        confirmButtonText: 'Simpan',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#4f46e5'
    }).then((result) => {
        if (!result.isConfirmed) return;

        const newTarget = Number(result.value || 0);
        localStorage.setItem(TARGET_KAS_KEY, String(newTarget));
        updateSaldoDisplay();

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Target diperbarui',
            text: `Rp ${newTarget.toLocaleString('id-ID')}`,
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true
        });
    });
}

function editSaldoJimpitan() {
    if (!petugasAktif || !AUTHORIZED_SALDO_EDITORS.includes(petugasAktif.trim())) {
        Swal.fire({
            title: 'Akses dibatasi',
            text: 'Hanya petugas tertentu yang bisa mengubah saldo. Pilih petugas yang berwenang terlebih dahulu.',
            icon: 'warning',
            confirmButtonText: 'Pilih Petugas',
            confirmButtonColor: '#4f46e5'
        }).then(() => {
            gantiPetugas();
        });
        return;
    }

    const currentSaldo = getSaldoSaatIni();

    Swal.fire({
        title: 'Ubah Saldo Jimpitan',
        input: 'number',
        inputLabel: 'Masukkan nominal saldo baru',
        inputValue: currentSaldo,
        inputAttributes: {
            min: 0,
            step: 1000,
        },
        showCancelButton: true,
        confirmButtonText: 'Simpan',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#4f46e5'
    }).then(async (result) => {
        if (!result.isConfirmed) return;

        const newSaldo = Number(result.value || 0);

        try {
            const apiResult = await fetchJson(SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'set_saldo',
                    saldo: newSaldo,
                    petugas: petugasAktif
                })
            });

            if (!apiResult || !apiResult.ok) {
                throw new Error(apiResult && apiResult.error ? apiResult.error : 'Gagal update saldo');
            }

            localStorage.setItem('saldoJimpitan', String(newSaldo));
            updateSaldoDisplay();

            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Saldo diperbarui',
                text: `Rp ${newSaldo.toLocaleString('id-ID')}`,
                showConfirmButton: false,
                timer: 2000,
                timerProgressBar: true
            });
        } catch (error) {
            Swal.fire({
                title: 'Gagal update saldo',
                text: error.message,
                icon: 'error',
                confirmButtonText: 'OK',
                confirmButtonColor: '#4f46e5'
            });
        }
    });
}

function simpanData() {
    if (!pengambilanAktif) return alert("Mulai pengambilan dulu sebelum simpan data.");
    if (!petugasAktif) return alert("Pilih petugas terlebih dahulu.");
    const blok = blokAktif || document.getElementById('blok').value;
    const nama = document.getElementById('wargaId').value.trim();
    const nominal = document.getElementById('jumlah').value;
    const tanggal = new Date().toLocaleDateString('id-ID');

    if (!blok) return alert("Pilih blok dulu!");
    if (!nama) return alert("Pilih warga dulu!");
    if (!validateWargaName(nama)) {
        Swal.fire({
            title: 'Nama warga tidak valid',
            text: 'Pilih nama yang sudah ada di data warga yang terdaftar.',
            icon: 'warning',
            confirmButtonText: 'OK',
            confirmButtonColor: '#4f46e5'
        });
        return;
    }

    let listJimpitan = JSON.parse(localStorage.getItem('jimpitan') || "[]");
    if (!Array.isArray(listJimpitan)) {
        listJimpitan = [];
    }
    const sudahTerinput = listJimpitan.some(item =>
        typeof item?.nama === 'string' &&
        item.nama.trim().toLowerCase() === nama.toLowerCase() &&
        String(item?.blok || '') === String(blok) &&
        item.tanggal === tanggal
    );
    if (sudahTerinput) {
        return Swal.fire({
            title: 'Duplikat Terdeteksi',
            text: 'Rumah/QR ini sudah dicatat di blok yang sama hari ini. Silakan cek kembali daftar riwayat.',
            icon: 'warning',
            confirmButtonText: 'Oke',
            confirmButtonColor: '#4f46e5'
        });
    }

    const namaWarga = nama;
    const dataKirim = {
        nama: nama,
        nominal: nominal,
        petugas: petugasAktif,
        waktu: new Date().toLocaleTimeString('id-ID'),
        tanggal: tanggal,
        blok: blok
    };

    const darkMode = document.documentElement.classList.contains('dark') || window.matchMedia('(prefers-color-scheme: dark)').matches;
    const popupBackground = darkMode ? '#111827' : '#f8fafc';
    const textColor = darkMode ? '#f3f4f6' : '#111827';
    const cardBackground = darkMode ? 'rgba(55, 65, 81, 0.9)' : 'rgba(241, 245, 249, 0.9)';
    const borderColor = darkMode ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.25)';

    isSaving = true;
    updateInputsState();

    // 1. Simpan ke Google Sheets via API
    fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ ...dataKirim, action: 'save_jimpitan' })
    })
    .then(async (res) => {
        const json = await res.json();
        if (!json || !json.ok) {
            throw new Error(json && json.error ? json.error : 'Gagal menyimpan data');
        }
        Swal.fire({
          title: `<span style="color: #4f46e5; font-family: Poppins, sans-serif;">Jimpitan Digital</span>`,
          html: `
            <div style="text-align: center; color: ${textColor};">
              <p style="font-size: 1.1em; margin-bottom: 20px;">Data jimpitan berhasil dicatat.</p>
              <div style="background: ${cardBackground}; padding: 1rem; border-radius: 1rem; border: 1px solid ${borderColor}; backdrop-filter: blur(10px);" class="text-sm">
                Petugas: <span style="font-weight: 700; color: #a5b4fc;">${window.namaPetugas}</span><br>
                Warga: <span style="font-weight: 700;">${namaWarga}</span>
              </div>
              <p style="margin-top: 15px; font-weight: bold; color: #fbbf24;">Terima kasih!</p>
            </div>
          `,
          iconHtml: '<img src="https://cdn-icons-png.flaticon.com/512/1161/1161388.png" style="width: 80px; height: 80px;">',
          confirmButtonText: 'Lanjut Mengambil',
          confirmButtonColor: '#4f46e5',
          allowOutsideClick: false,
          background: popupBackground,
          customClass: {
            popup: 'rounded-2xl shadow-2xl border-2 border-indigo-800/30',
            confirmButton: 'rounded-xl text-lg px-8 py-3',
          }
        });
        
        // 2. Simpan juga ke memori lokal browser sebagai cadangan
        listJimpitan.unshift(dataKirim);
        localStorage.setItem('jimpitan', JSON.stringify(listJimpitan));
        if (json && typeof json.saldo !== 'undefined') {
            localStorage.setItem('saldoJimpitan', String(json.saldo));
            updateSaldoDisplay();
        }

        if (pengambilanAktif) {
            jumlahSesi += 1;
            totalSesi += parseInt(nominal) || 0;
            updateSessionSummary();
        }
        
        await syncRiwayatFromServer();
        document.getElementById('wargaId').value = "";
    })
    .catch(error => {
        console.error('Error:', error);
        alert("Gagal mengirim data. Periksa koneksi internet.");
    })
    .finally(() => {
        isSaving = false;
        updateInputsState();
    });
}
const html5QrCode = new Html5Qrcode("reader");
const config = { fps: 10, qrbox: { width: 250, height: 250 } };

function normalizeNamaWarga(value) {
    if (typeof value !== 'string') return '';
    const cleaned = value.trim().replace(/\s+/g, ' ');
    if (!cleaned) return '';
    return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
}

function isNamaWargaValid(value) {
    const cleaned = normalizeNamaWarga(value);
    if (!cleaned) return false;
    if (cleaned.length < 2 || cleaned.length > 60) return false;
    return /^[A-Za-zÀ-ÿ0-9 .,'-]+$/.test(cleaned);
}

function tambahDataWarga() {
    const currentList = localStorage.getItem('wargaJimpitan');
    let parsed = [];
    try {
        parsed = currentList ? JSON.parse(currentList) : [];
    } catch (err) {
        parsed = [];
    }
    if (!Array.isArray(parsed)) parsed = [];

    const existingNames = new Set(parsed.map(item => String(item?.nama || '').trim()).filter(Boolean).map(name => name.toLowerCase()));

    Swal.fire({
        title: 'Tambah Warga Baru',
        html: `
            <div class="text-left">
                <p class="text-sm text-slate-600 mb-3">Masukkan nama warga baru yang akan ditambahkan ke data RT.</p>
                <input id="inputNamaWargaBaru" type="text" placeholder="Contoh: Siti Rahma" class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Simpan',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#4f46e5',
        preConfirm: () => {
            const selected = normalizeNamaWarga(document.getElementById('inputNamaWargaBaru')?.value || '');

            if (!selected) {
                Swal.showValidationMessage('Nama warga tidak boleh kosong.');
                return false;
            }

            if (!isNamaWargaValid(selected)) {
                Swal.showValidationMessage('Nama warga hanya boleh berisi huruf, angka, spasi, titik, koma, tanda petik, dan tanda hubung.');
                return false;
            }

            if (existingNames.has(selected.toLowerCase())) {
                Swal.showValidationMessage('Nama warga sudah ada di data, pilih nama lain.');
                return false;
            }

            return selected;
        }
    }).then((result) => {
        if (!result.isConfirmed) return;

        const namaBaru = result.value;
        const nextData = [...parsed, { nama: namaBaru, total_nominal: 0, total_transaksi: 0, blok: '' }];
        localStorage.setItem('wargaJimpitan', JSON.stringify(nextData));
        updateSaldoDisplay();
        renderDaftarWarga();

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Data warga ditambahkan',
            text: namaBaru,
            showConfirmButton: false,
            timer: 2200,
            timerProgressBar: true
        });
    });
}

function updateSessionStatus() {
    const statusEl = document.getElementById('sessionStatus');
    const btnMulai = document.getElementById('btnMulai');
    const btnAkhiri = document.getElementById('btnAkhiri');

    if (pengambilanAktif) {
        statusEl.textContent = 'Sedang pengambilan';
        statusEl.className = 'font-semibold text-green-600';
        btnMulai.disabled = true;
        btnAkhiri.disabled = false;
    } else {
        statusEl.textContent = 'Belum dimulai';
        statusEl.className = 'font-semibold text-gray-700';
        btnMulai.disabled = false;
        btnAkhiri.disabled = true;
    }
    updateInputsState();
}

function updateSessionSummary() {
    document.getElementById('sessionSummary').textContent = `${jumlahSesi} data, total Rp ${totalSesi.toLocaleString()}`;
}

function mulaiPengambilan() {
    if (pengambilanAktif) return;
    if (!petugasAktif || !blokAktif) {
        return showWelcomeDialog();
    }
    pengambilanAktif = true;
    jumlahSesi = 0;
    totalSesi = 0;
    updateSessionStatus();
    updateSessionSummary();
    document.getElementById('scanStatus').textContent = 'Arahkan kamera ke barcode untuk scan sekali.';
    document.getElementById('restartScanner').classList.add('hidden');
    mulaiScanner();
}

function akhiriPengambilan() {
    if (!pengambilanAktif) return;
    pengambilanAktif = false;
    updateSessionStatus();
    document.getElementById('scanStatus').textContent = 'Pengambilan berakhir. Klik Mulai Pengambilan untuk sesi baru.';
    document.getElementById('restartScanner').classList.add('hidden');
    if (scannerBerjalan) {
        html5QrCode.stop().catch(err => console.warn('Gagal berhenti scanner:', err));
        scannerBerjalan = false;
    }
}

function mulaiScanner() {
    if (!pengambilanAktif || scannerBerjalan) return;
    scannerBerjalan = true;
    document.getElementById('scanStatus').textContent = 'Arahkan kamera ke barcode untuk scan sekali.';
    document.getElementById('restartScanner').classList.add('hidden');

    html5QrCode.start({ facingMode: "environment" }, config,
        (decodedText) => {
            if (!scannerBerjalan) return;
            scannerBerjalan = false;
            document.getElementById('wargaId').value = decodedText;
            document.getElementById('scanStatus').textContent = 'Scan selesai. Tekan "Scan lagi" untuk pindai kode lain.';
            document.getElementById('restartScanner').classList.remove('hidden');
            if (isVibrationEnabled() && navigator.vibrate) navigator.vibrate(100);
            html5QrCode.stop().catch(err => console.warn('Gagal berhenti scanner:', err));
        },
        (errorMessage) => {
            // Biarkan scanner berjalan; kesalahan kecil diabaikan.
        }
    ).catch(error => {
        scannerBerjalan = false;
        console.error('Gagal memulai scanner:', error);
        document.getElementById('scanStatus').textContent = 'Tidak dapat memulai kamera. Periksa izin atau perangkat.';
    });
}

function initSettingsUI() {
    setVibrationEnabled(isVibrationEnabled());
    applyTheme();
}

// Perbarui status awal tanpa otomatis mulai kamera
updateSessionStatus();
updateSessionSummary();
updateSaldoDisplay();
syncSaldoFromServer();
syncRiwayatFromServer();
syncWargaFromServer();
syncBlokFromServer();
initSettingsUI();

let showAllHistory = false;

window.addEventListener('beforeunload', (event) => {
    event.preventDefault();
    event.returnValue = 'Apakah Anda yakin ingin keluar dari aplikasi?';
    return event.returnValue;
});

function buildSessionDialog(title = 'Sesi Jimpitan', confirmText = 'Mulai Bertugas', defaultBlok = blokAktif || '', defaultPetugas = petugasAktif || '') {
    return Swal.fire({
        title: title,
        html: `
            <div class="text-center">
                <div class="text-6xl mb-4">💰</div>
                <h2 class="text-xl font-bold text-indigo-600 mb-2">Jimpitan Digital</h2>
                <p class="text-gray-600 mb-4 text-sm">Pilih blok dan petugas dalam satu popup.</p>

                <div class="space-y-3 mt-4 text-left">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Blok</label>
                        <select id="pilihBlok" class="block w-full px-4 py-3 text-gray-700 bg-gray-50 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all">
                            <option value="" disabled ${defaultBlok ? '' : 'selected'}>-- Pilih Blok --</option>
                            <option value="1" ${defaultBlok === '1' ? 'selected' : ''}>Blok 1</option>
                            <option value="2" ${defaultBlok === '2' ? 'selected' : ''}>Blok 2</option>
                            <option value="3" ${defaultBlok === '3' ? 'selected' : ''}>Blok 3</option>
                            <option value="4" ${defaultBlok === '4' ? 'selected' : ''}>Blok 4</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Petugas</label>
                        <input type="text" id="searchPetugas" placeholder="Cari nama petugas..." class="block w-full px-4 py-2 mb-2 text-gray-700 bg-gray-50 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all">
                        <select id="pilihPetugas" class="block w-full px-4 py-3 text-gray-700 bg-gray-50 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all">
                            <option value="" disabled ${defaultPetugas ? '' : 'selected'}>-- Pilih Nama Petugas --</option>
                            <option value="Luthi Tyan" ${defaultPetugas === 'Luthi Tyan' ? 'selected' : ''}>Luthi Tyan</option>
                            <option value="Aa Badrul Munir" ${defaultPetugas === 'Aa Badrul Munir' ? 'selected' : ''}>Aa Badrul Munir</option>
                            <option value="Muhammad Maftuh Zen" ${defaultPetugas === 'Muhammad Maftuh Zen' ? 'selected' : ''}>Muhammad Maftuh Zen</option>
                            <option value="Dede yusna" ${defaultPetugas === 'Dede yusna' ? 'selected' : ''}>Dede yusna</option>
                            <option value="M Aziz setiawan" ${defaultPetugas === 'M Aziz setiawan' ? 'selected' : ''}>M Aziz setiawan</option>
                            <option value="Asep nurdiansyah" ${defaultPetugas === 'Asep nurdiansyah' ? 'selected' : ''}>Asep nurdiansyah</option>
                            <option value="Agun Gunawan" ${defaultPetugas === 'Agun Gunawan' ? 'selected' : ''}>Agun Gunawan</option>
                            <option value="Alfian Putra H" ${defaultPetugas === 'Alfian Putra H' ? 'selected' : ''}>Alfian Putra H</option>
                            <option value="Ronal Dwi Nugroho" ${defaultPetugas === 'Ronal Dwi Nugroho' ? 'selected' : ''}>Ronal Dwi Nugroho</option>
                            <option value="Hoeririn" ${defaultPetugas === 'Hoeririn' ? 'selected' : ''}>Hoeririn</option>
                            <option value="M alfi fahrul N" ${defaultPetugas === 'M alfi fahrul N' ? 'selected' : ''}>M alfi fahrul N</option>
                            <option value="M irfan" ${defaultPetugas === 'M irfan' ? 'selected' : ''}>M irfan</option>
                            <option value="Adik Gunawan" ${defaultPetugas === 'Adik Gunawan' ? 'selected' : ''}>Adik Gunawan</option>
                            <option value="Danang" ${defaultPetugas === 'Danang' ? 'selected' : ''}>Danang</option>
                            <option value="Riki" ${defaultPetugas === 'Riki' ? 'selected' : ''}>Riki</option>
                            <option value="Jalal" ${defaultPetugas === 'Jalal' ? 'selected' : ''}>Jalal</option>
                        </select>
                    </div>
                </div>
            </div>
        `,
        confirmButtonText: confirmText,
        confirmButtonColor: '#4f46e5',
        showCloseButton: true,
        closeButtonHtml: '&times;',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showClass: {
            popup: 'animate__animated animate__fadeInDown'
        },
        hideClass: {
            popup: 'animate__animated animate__fadeOutUp'
        },
        didOpen: () => {
            const searchInput = document.getElementById('searchPetugas');
            const select = document.getElementById('pilihPetugas');
            const options = select.querySelectorAll('option');

            searchInput.addEventListener('input', function() {
                const filter = this.value.toLowerCase();
                options.forEach(option => {
                    if (option.value === '') return;
                    const text = option.textContent.toLowerCase();
                    option.style.display = text.includes(filter) ? '' : 'none';
                });
            });
        },
        preConfirm: () => {
            const blok = document.getElementById('pilihBlok').value;
            const nama = document.getElementById('pilihPetugas').value;

            if (!blok) {
                Swal.showValidationMessage('Anda harus memilih blok!');
            }
            if (!nama) {
                Swal.showValidationMessage('Anda harus memilih nama petugas!');
            }

            if (!blok || !nama) {
                return false;
            }

            return { blok, petugas: nama };
        }
    });
}

function showWelcomeDialog() {
    buildSessionDialog('Sesi Jimpitan', 'Mulai Bertugas')
        .then((result) => {
            if (result.isConfirmed) {
                setBlok(result.value.blok);
                setPetugas(result.value.petugas);

                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: 'Blok ' + result.value.blok + ' • ' + result.value.petugas,
                    text: 'Sesi siap dimulai.',
                    showConfirmButton: false,
                    timer: 2500,
                    timerProgressBar: true
                });
            }
        });
}

function gantiPetugas() {
    buildSessionDialog('Ganti Petugas & Blok', 'Simpan Perubahan', blokAktif || '', petugasAktif || '')
        .then((result) => {
            if (result.isConfirmed) {
                setBlok(result.value.blok);
                setPetugas(result.value.petugas);

                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: 'Data sesi diperbarui',
                    text: 'Blok ' + result.value.blok + ' • ' + result.value.petugas,
                    showConfirmButton: false,
                    timer: 2200,
                    timerProgressBar: true
                });
            }
        });
}

function toggleShowAll() {
    showAllHistory = !showAllHistory;
    updateTable();
}

// Update Tampilan Tabel di HP
function updateTable() {
    let listJimpitan = JSON.parse(localStorage.getItem('jimpitan') || "[]");
    if (!Array.isArray(listJimpitan)) {
        listJimpitan = [];
    }
    const tbody = document.getElementById('historyBody');
    const btnTampilkan = document.getElementById('btnTampilkanSemua');
    
    if(tbody) {
        const dataToShow = showAllHistory ? listJimpitan : listJimpitan.slice(0, 3);
        tbody.innerHTML = dataToShow.map(item => {
            const nama = typeof item?.nama === 'string' ? item.nama : '—';
            const waktu = typeof item?.waktu === 'string' ? item.waktu : '';
            const tanggalText = item?.tanggal ? ' • ' + item.tanggal : '';
            const nominalValue = parseInt(item?.nominal) || 0;
            const blok = item?.blok ? `Blok ${item.blok}` : '—';
            return `
            <tr class="border-b">
                <td class="p-2">${nama} <br><span class="text-xs text-gray-400">${waktu}${tanggalText}</span></td>
                <td class="p-2">${blok}</td>
                <td class="p-2">${item?.petugas || '—'}</td>
                <td class="p-2 text-right text-green-600 font-bold">Rp ${nominalValue.toLocaleString()}</td>
            </tr>
        `;
        }).join('');
        
        // Tampilkan tombol "Tampilkan Semua" hanya jika ada lebih dari 3 item
        if (listJimpitan.length > 3) {
            btnTampilkan.classList.remove('hidden');
            btnTampilkan.textContent = showAllHistory ? 'Sembunyikan' : 'Tampilkan Semua';
        } else {
            btnTampilkan.classList.add('hidden');
        }
    }
}
function renderDaftarWarga() {
    const storedWarga = JSON.parse(localStorage.getItem('wargaJimpitan') || '[]');
    const storedRiwayat = JSON.parse(localStorage.getItem('jimpitan') || '[]');

    let listJimpitan = Array.isArray(storedWarga) && storedWarga.length > 0
        ? storedWarga.map(item => ({
            nama: item?.nama || '',
            nominal: item?.total_nominal || item?.nominal || 0,
            blok: item?.blok || '',
            count: item?.total_transaksi || 1
        }))
        : (Array.isArray(storedRiwayat) ? storedRiwayat : []);

    if (!Array.isArray(listJimpitan)) {
        listJimpitan = [];
    }

    const daftarWargaBody = document.getElementById('daftarWargaBody');
    const daftarWargaEmpty = document.getElementById('daftarWargaEmpty');
    updateTotalWargaDisplay();
    updateWargaOptions();

    if (!daftarWargaBody || !daftarWargaEmpty) return;

    const wargaMap = listJimpitan.reduce((acc, item) => {
        if (typeof item?.nama !== 'string') return acc;
        const key = item.nama.trim();
        if (!key) return acc;
        if (!acc[key]) acc[key] = { nama: key, count: 0, total: 0 };
        acc[key].count += Number(item.count || item.total_transaksi || 1);
        acc[key].total += parseInt(item.nominal || item.total_nominal || 0) || 0;
        return acc;
    }, {});

    const wargaList = Object.values(wargaMap).sort((a, b) => b.total - a.total);
    daftarWargaBody.innerHTML = wargaList.map(item => `
        <tr class="border-b">
            <td class="p-2">${item.nama}</td>
            <td class="p-2 text-right">${item.count}</td>
            <td class="p-2 text-right text-green-600 font-bold">Rp ${item.total.toLocaleString()}</td>
        </tr>
    `).join('');

    if (wargaList.length === 0) {
        daftarWargaEmpty.classList.remove('hidden');
    } else {
        daftarWargaEmpty.classList.add('hidden');
    }
}

function renderBlokSummary() {
    const blokGrid = document.getElementById('blokSummaryGrid');
    if (!blokGrid) return;

    const blokData = JSON.parse(localStorage.getItem('blokJimpitan') || '[]');
    const data = Array.isArray(blokData) && blokData.length ? blokData : [
        { blok: '1', total_transaksi: 0, total_nominal: 0 },
        { blok: '2', total_transaksi: 0, total_nominal: 0 },
        { blok: '3', total_transaksi: 0, total_nominal: 0 },
        { blok: '4', total_transaksi: 0, total_nominal: 0 }
    ];

    const map = Object.fromEntries(data.map(item => [String(item.blok || '0'), item]));
    const values = [1, 2, 3, 4].map((blok) => {
        const item = map[String(blok)] || { blok: String(blok), total_transaksi: 0, total_nominal: 0 };
        return {
            blok: String(blok),
            total_transaksi: Number(item.total_transaksi || 0),
            total_nominal: Number(item.total_nominal || 0)
        };
    });

    blokGrid.innerHTML = values.map((item) => `
        <div class="rounded-2xl bg-indigo-50 border border-indigo-100 p-3 shadow-sm dark:bg-slate-800 dark:border-slate-700">
            <div class="text-xs uppercase tracking-wide text-indigo-600 dark:text-indigo-300">Blok ${item.blok}</div>
            <div class="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">${item.total_transaksi}</div>
            <div class="text-xs text-slate-500 dark:text-slate-300">Transaksi</div>
            <div class="mt-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">Rp ${Number(item.total_nominal || 0).toLocaleString('id-ID')}</div>
        </div>
    `).join('');
}

function updateBottomNavState(activeId) {
    const buttons = {
        homeScreen: document.getElementById('navHomeButton'),
        historyScreen: document.getElementById('navHistoryButton'),
        settingsScreen: document.getElementById('navSettingButton')
    };

    Object.entries(buttons).forEach(([id, button]) => {
        if (!button) return;
        const isActive = id === activeId;
        button.classList.toggle('bg-white/10', isActive);
        button.classList.toggle('text-white', isActive);
        button.classList.toggle('ring-1', isActive);
        button.classList.toggle('ring-white/10', isActive);
        button.classList.toggle('shadow-inner', isActive);
        button.classList.toggle('text-indigo-200', !isActive);
    });
}

function animateScreen(screenId, direction = 'next') {
    const targets = {
        homeScreen: document.getElementById('homeScreen'),
        mainApp: document.getElementById('mainApp'),
        historyScreen: document.getElementById('historyScreen'),
        daftarWargaSection: document.getElementById('daftarWargaSection'),
        settingsScreen: document.getElementById('settingsScreen')
    };

    const enterFrom = direction === 'next' ? 'translate-x-full' : '-translate-x-full';
    const exitTo = direction === 'next' ? '-translate-x-full' : 'translate-x-full';

    Object.entries(targets).forEach(([id, el]) => {
        if (!el) return;

        if (id === screenId) {
            el.classList.remove('hidden');
            el.classList.remove('translate-x-full', '-translate-x-full');
            el.classList.add(enterFrom);
            void el.offsetWidth;
            el.classList.remove(enterFrom);
            el.classList.add('translate-x-0');
            requestAnimationFrame(() => {
                el.classList.remove('translate-x-full', '-translate-x-full');
            });
        } else {
            el.classList.add('hidden');
            el.classList.remove('translate-x-0', 'translate-x-full', '-translate-x-full');
            el.classList.add(exitTo);
        }
    });

    if (screenId === 'homeScreen' || screenId === 'historyScreen' || screenId === 'settingsScreen') {
        updateBottomNavState(screenId);
    }
}

function showHomeScreen() {
    animateScreen('homeScreen', 'prev');
}

function showMainApp() {
    animateScreen('mainApp', 'next');
    updateBottomNavState('homeScreen');
}

function showHistoryScreen() {
    animateScreen('historyScreen', 'next');
}

function showDaftarWarga() {
    animateScreen('daftarWargaSection', 'next');
    renderDaftarWarga();
    updateBottomNavState('homeScreen');
}

function showSettingsScreen() {
    animateScreen('settingsScreen', 'next');
}

updateTable();

// Mulai dari beranda utama
showHomeScreen();