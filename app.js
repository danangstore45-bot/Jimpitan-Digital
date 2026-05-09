const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwZJzFXiu4QEwq3EnTs-XE54RrBoVC_KKFNAj-dBqRk12hl69jnbSi495kKiyzkew18/exec";
let pengambilanAktif = false;
let scannerBerjalan = false;
let jumlahSesi = 0;
let totalSesi = 0;
let petugasAktif = "";
let isSaving = false;

function setPetugas(name) {
    petugasAktif = name;
    window.namaPetugas = name;
    const petugasNameEl = document.getElementById('petugasName');
    if (petugasNameEl) {
        petugasNameEl.textContent = name || 'Belum dipilih';
    }
}

function updateInputsState() {
    const disabled = !pengambilanAktif || isSaving;
    document.getElementById('wargaId').disabled = disabled;
    document.getElementById('jumlah').disabled = disabled;
    document.getElementById('btnSimpan').disabled = disabled;
}

function simpanData() {
    if (!pengambilanAktif) return alert("Mulai pengambilan dulu sebelum simpan data.");
    if (!petugasAktif) return alert("Pilih petugas terlebih dahulu.");
    const nama = document.getElementById('wargaId').value.trim();
    const nominal = document.getElementById('jumlah').value;
    const tanggal = new Date().toLocaleDateString('id-ID');

    if (!nama) return alert("Pilih warga dulu!");

    let listJimpitan = JSON.parse(localStorage.getItem('jimpitan') || "[]");
    const sudahTerinput = listJimpitan.some(item => item.nama.trim().toLowerCase() === nama.toLowerCase() && item.tanggal === tanggal);
    if (sudahTerinput) {
        return Swal.fire({
            title: 'Duplikat Terdeteksi',
            text: 'Rumah/QR ini sudah dicatat hari ini. Silakan cek kembali daftar riwayat.',
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
        tanggal: tanggal
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
        body: JSON.stringify(dataKirim)
    })
    .then(res => {
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
    })
    .finally(() => {
        isSaving = false;
        updateInputsState();
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
    if (!petugasAktif) {
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
        title: 'Selamat Datang!',
        html: `
            <div class="text-center">
                <div class="text-6xl mb-4">💰</div>
                <h2 class="text-xl font-bold text-indigo-600 mb-2">Jimpitan Digital</h2>
                <p class="text-gray-600 mb-4 text-sm">Silakan pilih nama petugas untuk memulai sesi pengambilan jimpitan hari ini.</p>
                
                <div class="relative mt-4">
                    <input type="text" id="searchPetugas" placeholder="Cari nama petugas..." class="block w-full px-4 py-2 mb-2 text-gray-700 bg-gray-50 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all">
                    <select id="pilihPetugas" class="block w-full px-4 py-3 text-gray-700 bg-gray-50 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all">
                        <option value="" disabled selected>-- Pilih Nama Petugas --</option>
                        <option value="Luthi Tyan">Luthi Tyan</option>
                        <option value="Aa Badrul Munir">Aa Badrul Munir</option>
                        <option value="Muhammad Maftuh Zen">Muhammad Maftuh Zen</option>
                        <option value="Dede yusna">Dede yusna</option>
                        <option value="M Aziz setiawan">M Aziz setiawan</option>
                        <option value="Asep nurdiansyah">Asep nurdiansyah</option>
                        <option value="Agun Gunawan">Agun Gunawan</option>
                        <option value="Alfian Putra H">Alfian Putra H</option>
                        <option value="Ronal Dwi Nugroho">Ronal Dwi Nugroho</option>
                        <option value="Hoeririn">Hoeririn</option>
                        <option value="M alfi fahrul N">M alfi fahrul N</option>
                        <option value="M irfan">M irfan</option>
                        <option value="Adik Gunawan">Adik Gunawan</option>
                        <option value="Danang">Danang</option>
                        <option value="Riki">Riki</option>
                        <option value="Jalal">Jalal</option>
                    </select>
                </div>
            </div>
        `,
        confirmButtonText: 'Mulai Bertugas',
        confirmButtonColor: '#4f46e5',
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
                    if (option.value === '') return; // Skip placeholder
                    const text = option.textContent.toLowerCase();
                    option.style.display = text.includes(filter) ? '' : 'none';
                });
            });
        },
        preConfirm: () => {
            const nama = document.getElementById('pilihPetugas').value;
            if (!nama) {
                Swal.showValidationMessage('Anda harus memilih nama petugas!');
            }
            return nama;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            // Simpan nama ke variabel global agar bisa dikirim ke Sheets
            setPetugas(result.value); // Update petugasAktif dan tampilan
            
            // Notifikasi sukses kecil (Toast)
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Halo ' + result.value + ', selamat bertugas!',
                showConfirmButton: false,
                timer: 3000,
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
    const listJimpitan = JSON.parse(localStorage.getItem('jimpitan') || "[]");
    const tbody = document.getElementById('historyBody');
    const btnTampilkan = document.getElementById('btnTampilkanSemua');
    
    if(tbody) {
        const dataToShow = showAllHistory ? listJimpitan : listJimpitan.slice(0, 3);
        tbody.innerHTML = dataToShow.map(item => `
            <tr class="border-b">
                <td class="p-2">${item.nama} <br><span class="text-xs text-gray-400">${item.waktu}${item.tanggal ? ' • ' + item.tanggal : ''}</span></td>
                <td class="p-2">${item.petugas || '—'}</td>
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

// Tampilkan popup Jimpitan Jigital saat halaman pertama kali dibuka
showWelcomeDialog();