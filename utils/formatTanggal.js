const dayjs = require("dayjs");
require("dayjs/locale/id");
dayjs.locale("id");

function formatTanggalIndonesia(dateStr) {
    return dayjs(dateStr).format("DD MMMM YYYY");
}

module.exports = { formatTanggalIndonesia };
