require('./observability/telemetry');

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const clearLogs = require('./observability/clearLogs');
const logSteps = require('./observability/logSteps');
const { tracer, getMetrics, updateMetrics } = require('./observability/telemetry');

const NaiveSearch = require('./algorithms/naiveSearch');
const RabinKarpSearch = require('./algorithms/rabinKarpSearch');
const KmpSearch = require('./algorithms/KmpSearch');
const BoyerMooreSearch = require('./algorithms/BoyerMooreSearch');

const algorithms = {
    naive: new NaiveSearch(),
    rabin: new RabinKarpSearch(),
    kmp: new KmpSearch(),
    boyer: new BoyerMooreSearch()
};

const app = express();
app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const logger = require('./observability/logger');   


// CONFIG UPLOAD
const uploadPath = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath);
}

const storage = multer.diskStorage({
    destination: (_, __, cb) => {
        cb(null, uploadPath);
    },

    filename: (_, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage });

function getFiles(reqFiles) {

    if (reqFiles && reqFiles.length > 0) {

        return reqFiles.map(file => ({
            nome: file.originalname,
            caminho: file.path
        }));
    }

    const files = fs
        .readdirSync(uploadPath)
        .filter(file =>
            fs.statSync(
                path.join(uploadPath, file)
            ).isFile()
        );

    return files.map(file => ({
        nome: file,
        caminho: path.join(uploadPath, file)
    }));
}

// ROTA: UPLOAD
app.post('/upload', upload.array('files'), (req, res) => {

    try {

        if (
            !req.files ||
            req.files.length === 0
        ) {
            return res.status(400).json({
                message: 'Nenhum arquivo enviado.'
            });
        }

        return res.json({
            message: 'Upload realizado com sucesso!',
            files: req.files.map(
                f => f.originalname
            )
        });

    } catch (err) {

        logger.error(err);

        return res.status(500).json({
            message: 'Erro interno'
        });
    }
});

// ROTA: SEARCH
app.post('/search', upload.array('files'), async (req, res) => {

    const span = tracer.startSpan(
        'search-request'
    );

    try {
        const { pattern, algorithm } = req.body;

        span.setAttribute('search.algorithm', algorithm);
        span.setAttribute('search.pattern', pattern);

        const stepByStep = req.body.stepByStep === 'true';

        if (!pattern) {
            return res.status(400).json({
                message: 'Informe um padrão para busca.'
            });
        }

        const strategy = algorithms[algorithm];

        if (!strategy) {
            return res.status(400).json({
                message: 'Algoritmo inválido.'
            });
        }

        const arquivos = getFiles(req.files);

        if (arquivos.length === 0) {
            return res.status(400).json({
                message: 'Nenhum arquivo disponível.'
            });
        }

        if (stepByStep) {
            clearLogs();
        }

        const resultados = [];

        for (const file of arquivos) {
            const fileSpan = tracer.startSpan('process-file');
            const text = await fs.promises.readFile(file.caminho, 'utf-8');

            const result = strategy.search(text, pattern, stepByStep);

            fileSpan.setAttribute('file.name', file.nome);
            fileSpan.setAttribute('search.matches', result.matches.length);
            fileSpan.setAttribute('search.comparisons', result.metrics.comparisons);
            fileSpan.setAttribute('search.executionTime', Number(result.metrics.executionTime));

            updateMetrics(algorithm, result.metrics.executionTime);

            fileSpan.end();

            if (stepByStep && result.steps?.length) {
                logSteps(
                    file.nome,
                    algorithm,
                    result.steps
                );
            }

            resultados.push({
                arquivo: file.nome,
                ocorrencias: result.occurrences,
                posicoes: result.matches,
                metrics: result.metrics,
                steps: result.steps
            });
        }

        logger.info({
            algorithm,
            pattern,
            totalFiles: arquivos.length
        });

        return res.json({
            pattern,
            algorithm,
            resultados
        });

    } catch (err) {
        span.recordException(err);

        span.setStatus({
            code: 2,
            message: err.message
        });

        logger.error({
            message: err.message,
            stack: err.stack
        });

        return res.status(500).json({
            message: 'Erro interno'
        });
    } finally {
        span.end();
    }
});

// METRICS
app.get('/metrics', (_, res) => {
    res.json(getMetrics());
});

app.listen(3000, () => {
    console.log('Servidor rodando em http://localhost:3000');
});