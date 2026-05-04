const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwBa_eiDGLSMCqWop5aTHPWWyQpDYVaxtSkxtbqus5iOxyqlKSVOHTdrSZmOUif6YnA/exec";
let pengambilanAktif = false;
let scannerBerjalan = false;
let jumlahSesi = 0;
let totalSesi = 0;

function updateInputsState() {
    const disabled = !pengambilanAktif;
    document.getElementById('wargaId').disabled = disabled;
    document.getElementById('jumlah').disabled = disabled;
    document.getElementById('btnSimpan').disabled = disabled;
}

function simpanData() {
    if (!pengambilanAktif) return alert("Mulai pengambilan dulu sebelum simpan data.");
    const nama = document.getElementById('wargaId').value;
    const nominal = document.getElementById('jumlah').value;

    if (!nama) return alert("Pilih warga dulu!");

    const dataKirim = {
        nama: nama,
        nominal: nominal
    };

    // 1. Simpan ke Google Sheets via API
    fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(dataKirim)
    })
    .then(res => {
        Swal.fire({
  title: 'Berhasil!',
  text: 'Data Sudah Tercatat "Terima Kasih".',
  icon: 'success',
  confirmButtonText: 'Oke Sip',
  confirmButtonColor: '#4f46e5' // Warna ungu indigo sesuai tema Anda
});
        
        // 2. Simpan juga ke memori lokal browser sebagai cadangan
        let listJimpitan = JSON.parse(localStorage.getItem('jimpitan') || "[]");
        listJimpitan.unshift({ ...dataKirim, waktu: new Date().toLocaleTimeString() });
        localStorage.setItem('jimpitan', JSON.stringify(listJimpitan));

        if (pengambilanAktif) {
            jumlahSesi += 1;
            totalSesi += parseInt(nominal) || 0;
            updateSessionSummary();
        }
        
        updateTable();
        document.getElementById('wargaId').value = "";
    })
    .catch(error => {
        console.error('Error:', error);
        alert("Gagal mengirim data. Periksa koneksi internet.");
    });
}
const html5QrCode = new Html5Qrcode("reader");
const config = { fps: 10, qrbox: { width: 250, height: 250 } };

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
            if (navigator.vibrate) navigator.vibrate(100);
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

// Perbarui status awal tanpa otomatis mulai kamera
updateSessionStatus();
updateSessionSummary();

let showAllHistory = false;

function showWelcomeDialog() {
    Swal.fire({
        title: 'Selamat Datang',
        html: '<h2 class="text-2xl font-bold text-indigo-600 mb-2">Jimpitan Digital</h2><p class="text-gray-600">Aplikasi pengumpulan jimpitan yang mudah dan cepat</p>',
        icon: 'info',
        confirmButtonText: 'Mulai',
        confirmButtonColor: '#4f46e5',
        allowOutsideClick: false,
        allowEscapeKey: false
    });
}

function toggleShowAll() {
    showAllHistory = !showAllHistory;
    updateTable();
}

// Update Tampilan Tabel di HP
function updateTable() {
    const listJimpitan = JSON.parse(localStorage.getItem('jimpitan') || "[]");
    const tbody = document.getElementById('historyBody');
    const btnTampilkan = document.getElementById('btnTampilkanSemua');
    
    if(tbody) {
        const dataToShow = showAllHistory ? listJimpitan : listJimpitan.slice(0, 3);
        tbody.innerHTML = dataToShow.map(item => `
            <tr class="border-b">
                <td class="p-2">${item.nama} <br><span class="text-xs text-gray-400">${item.waktu}</span></td>
                <td class="p-2 text-right text-green-600 font-bold">Rp ${parseInt(item.nominal).toLocaleString()}</td>
            </tr>
        `).join('');
        
        // Tampilkan tombol "Tampilkan Semua" hanya jika ada lebih dari 3 item
        if (listJimpitan.length > 3) {
            btnTampilkan.classList.remove('hidden');
            btnTampilkan.textContent = showAllHistory ? 'Sembunyikan' : 'Tampilkan Semua';
        } else {
            btnTampilkan.classList.add('hidden');
        }
    }
}
updateTable();

// Tampilkan welcome dialog saat halaman pertama kali dibuka
showWelcomeDialog();