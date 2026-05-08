const winston = require('winston');

const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../logs');

if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

const logger = winston.createLogger({
    level: 'info',

    format: winston.format.combine(
        winston.format.timestamp(),

        winston.format.combine(
            winston.format.timestamp(),

            winston.format.printf(
                ({ timestamp, level, message }) => {

                    return `${timestamp} [${level}] ${
                        typeof message === 'object'
                            ? JSON.stringify(message)
                            : message
                    }`;
                }
            )
        )
    ),

    transports: [

        // terminal
        new winston.transports.Console(),

        // todos logs
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log')
        }),

        // apenas erros
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error'
        })
    ]
});

module.exports = logger;