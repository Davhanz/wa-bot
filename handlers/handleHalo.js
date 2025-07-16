module.exports = async function handleHalo(sock, from) {
    await sock.sendMessage(from, { text: "Hai juga! 👋" });
};
