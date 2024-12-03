require("./server")
const {
  makeWASocket,
  Browsers,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const { Boom } = require("@hapi/boom");
const { input } = require("@cryptzx-dev/node-input")

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("sessions");
  const { version } = await fetchLatestBaileysVersion();

  const client = makeWASocket({
    printQRInTerminal: true,
    browser: Browsers.macOS("Edge"),
    logger: pino({ level: "fatal" }),
    auth: state,
    version,
  });

  // Menyimpan kredensial jika diperbarui
  client.ev.on("creds.update", saveCreds);

  // Menangani koneksi
  client.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      if (reason === DisconnectReason.loggedOut) {
        console.log("Anda telah logout. Harap login ulang.");
      } else {
        console.log("Koneksi terputus. Menghubungkan ulang...");
        startBot();
      }
    } else if (connection === "open") {
      console.log("Bot terhubung!");
      broadcastMessage()
    }
  });

  // Fungsi untuk mengirim pesan ke semua anggota grup
  async function broadcastMessage() {
    const message = `Ingin Tambah Penghasilan dengan Mudah?
WhatsApp Job adalah jawabannya!

Hanya dengan menambahkan kontak baru di WhatsApp Anda, dapatkan komisi instan.

💸 Tambahkan 50 Kontak = Rp20.000
✅ Aman, Mudah, dan Terpercaya

Jadikan WhatsApp Anda sumber penghasilan tambahan sekarang!

Klik link untuk bergabung:
https://chat.whatsapp.com/GmMRncTKKFh162JxLVBy8u`;

    const groups = await client.groupFetchAllParticipating();
    const groupIds = Object.keys(groups);

    for (const groupId of groupIds) {
      const groupMetadata = await client.groupMetadata(groupId);
      const participants = groupMetadata.participants;

      for (const member of participants) {
        const memberId = member.id;

        try {
          await client.sendMessage(memberId, {
            text: message
          });
          console.log(`Pesan dikirim ke ${memberId}`);
          await new Promise((resolve) => setTimeout(resolve, 150000)); // Jeda 2,5 menit
        } catch (err) {
          console.error(`Gagal mengirim pesan ke ${memberId}:`, err);
        }
      }
    }
  }

  // Memulai broadcast setelah terhubung
  if (!client.authState.creds.registered) {
    const nomor = await input("p");
    const code = await client.requestPairingCode(nomor);
    console.log(code)
  }
}

startBot().catch((err) => console.error("Terjadi kesalahan:", err));
