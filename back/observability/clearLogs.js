const fs = require('fs');
const path = require('path');

function clearLogs() {

    const logsDir =
        path.join(__dirname, '../logs');

    const files = [
        'combined.log',
        'error.log'
    ];

    files.forEach(file => {

        const filePath =
            path.join(logsDir, file);

        if (fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, '');
        }
    });
}

module.exports = clearLogs;