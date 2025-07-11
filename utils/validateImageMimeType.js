function detectMime(buf) {
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
        return "image/jpeg";
    }
    if (
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4E &&
        buf[3] === 0x47
    ) {
        return "image/png";
    }
    if (
        buf.slice(0, 6).toString("ascii") === "GIF87a" ||
        buf.slice(0, 6).toString("ascii") === "GIF89a"
    ) {
        return "image/gif";
    }
    if (
        buf.slice(0, 4).toString("hex") === "52494646" // RIFF
        && buf.slice(8, 12).toString("ascii") === "WEBP"
    ) {
        return "image/webp";
    }
    return null;
}

module.exports = {
    detectMime,
}