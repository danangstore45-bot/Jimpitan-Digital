const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwBa_eiDGLSMCqWop5aTHPWWyQpDYVaxtSkxtbqus5iOxyqlKSVOHTdrSZmOUif6YnA/exec";
https://sc
function simpanData() {
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

function mulaiScanner() {
    if (scannerBerjalan) return;
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

// Mulai kamera saat halaman dibuka
mulaiScanner();

// Update Tampilan Tabel di HP
function updateTable() {
    const listJimpitan = JSON.parse(localStorage.getItem('jimpitan') || "[]");
    const tbody = document.getElementById('historyBody');
    if(tbody) {
        tbody.innerHTML = listJimpitan.map(item => `
            <tr class="border-b">
                <td class="p-2">${item.nama} <br><span class="text-xs text-gray-400">${item.waktu}</span></td>
                <td class="p-2 text-right text-green-600 font-bold">Rp ${parseInt(item.nominal).toLocaleString()}</td>
            </tr>
        `).join('');
    }
}
updateTable();