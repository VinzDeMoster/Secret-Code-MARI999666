# Secret Code Translator — Separate Files

Files:
- `index.html` — halaman login, halaman buat akun, dan aplikasi.
- `style.css` — tampilan.
- `app.js` — login/register Firebase, penerjemah, kode, history, kontak admin, dan admin.
- `firebase-config.js` — konfigurasi Firebase.
- `languages.js` — bahasa Indonesia, English, Jepang, China, Spanyol.

## Alur akun
1. Halaman pertama hanya menampilkan Username + Password + Login.
2. Tekan **Buat akun baru** untuk masuk ke halaman pendaftaran.
3. Isi Username, Password, dan Konfirmasi Password.
4. Setelah akun berhasil dibuat, pengguna otomatis kembali ke halaman Login.
5. Username otomatis terisi; pengguna memasukkan password lalu Login.

## Firebase
Aktifkan:
- Authentication → Email/Password
- Firestore Database

Google/Guest tidak diperlukan untuk alur login biasa ini.

## GitHub Pages
Upload semua file ke root repository yang dipakai GitHub Pages. Pastikan `index.html` berada langsung di root.


A-Z default mapping: A=`&#`, B=`@@`, C=`##`, D=`$$`, E=`%%`, dan seterusnya. Mapping ini hanya contoh awal dan bisa kamu sesuaikan di menu Kode Saya.
