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

const algorithms = {
    naive: new NaiveSearch(),
    rabin: new RabinKarpSearch(),
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

/* ===========================================================================================
KMP
- Usa a tabela LPS para evitar comparações repetidas
============================================================================================== */

function buildLPS(pattern) {
    const lps = new Array(pattern.length).fill(0);
    let length = 0;
    let i = 1;

    while (i < pattern.length) {
        if (pattern[i] === pattern[length]) {
            length++;
            lps[i] = length;
            i++;
        } else {
            if (length !== 0) {
                length = lps[length - 1];
            } else {
                lps[i] = 0;
                i++;
            }
        }
    }

    return lps;
}

function kmpSearch(text, pattern) {
    const result = [];
    let comparisons = 0;

    const lps = buildLPS(pattern);

    let i = 0;
    let j = 0;

    while (i < text.length) {
        comparisons++;

        if (text[i] === pattern[j]) {
            i++;
            j++;
        }

        if (j === pattern.length) {
            result.push(i - j);
            j = lps[j - 1];
        } else if (i < text.length && text[i] !== pattern[j]) {
            if (j !== 0) {
                j = lps[j - 1];
            } else {
                i++;
            }
        }
    }

    return { matches: result, comparisons, lps };
}

function kmpSearchWithLogs(text, pattern, log) {
    const result = [];
    let comparisons = 0;

    const lps = buildLPS(pattern);

    log.section('KMP');
    log.log(`LPS: ${lps.join(', ')}`);

    let i = 0, j = 0;

    const startTime = performance.now();

    while (i < text.length) {
        comparisons++;

        log.log(`Comparando text[${i}]='${text[i]}' com pattern[${j}]='${pattern[j]}'`);

        if (text[i] === pattern[j]) {
            log.match('Match');
            i++; j++;
        }

        if (j === pattern.length) {
            log.match(`Encontrado na posição ${i - j}`);
            result.push(i - j);
            j = lps[j - 1];
        } else if (i < text.length && text[i] !== pattern[j]) {
            log.error('Mismatch');

            if (j !== 0) {
                const old = j;
                j = lps[j - 1];
                log.step(`LPS: ${old} -> ${j}`);
            } else {
                i++;
            }
        }

        log.divider();
    }

    const endTime = performance.now();

    return {
        matches: result,
        metrics: {
            comparisons,
            executionTime: (endTime - startTime).toFixed(4),
            textLength: text.length,
            patternLength: pattern.length,
            complexity: "O(n + m)"
        }
    };
}

/* ===========================================================================================
BOYER-MOORE
- Usa a tabela bad character para dar saltos maiores no texto
============================================================================================== */

function buildBadCharTable(pattern) {
    const table = {};
    for (let i = 0; i < pattern.length; i++) {
        table[pattern[i]] = i;
    }
    return table;
}

function boyerMooreSearch(text, pattern) {
    const result = [];
    let comparisons = 0;

    const badChar = buildBadCharTable(pattern);

    let shift = 0;

    while (shift <= text.length - pattern.length) {
        let j = pattern.length - 1;

        while (j >= 0) {
            comparisons++;
            if (pattern[j] !== text[shift + j]) break;
            j--;
        }

        if (j < 0) {
            result.push(shift);

            shift += (shift + pattern.length < text.length)
                ? pattern.length - (badChar[text[shift + pattern.length]] ?? -1)
                : 1;
        } else {
            shift += Math.max(1, j - (badChar[text[shift + j]] ?? -1));
        }
    }

    return { matches: result, comparisons, badChar };
}

function boyerMooreSearchWithLogs(text, pattern, log) {
    const result = [];

    const badChar = buildBadCharTable(pattern);

    let shift = 0;
    let comparisons = 0;

    const startTime = performance.now();

    log.section('BOYER-MOORE');
    log.log(`Tabela Bad Character: ${JSON.stringify(badChar)}`);

    while (shift <= text.length - pattern.length) {
        log.step(`[SHIFT] ${shift}`);

        let j = pattern.length - 1;

        while (j >= 0) {
            comparisons++;

            log.log(
                `Comparando text[${shift + j}]='${text[shift + j]}' com pattern[${j}]='${pattern[j]}'`
            );

            if (pattern[j] !== text[shift + j]) {
                log.error('Mismatch');
                break;
            }

            log.match('Match');
            j--;
        }

        if (j < 0) {
            log.match(`Encontrado na posição ${shift}`);
            result.push(shift);

            const nextShift = (shift + pattern.length < text.length)
                ? pattern.length - (badChar[text[shift + pattern.length]] ?? -1)
                : 1;

            log.step(`Deslocamento após match: ${nextShift}`);

            shift += nextShift;

        } else {
            const badCharIndex = badChar[text[shift + j]] ?? -1;
            const shiftAmount = Math.max(1, j - badCharIndex);

            log.step(
                `BadChar='${text[shift + j]}' | índice no pattern=${badCharIndex} | shift=${shiftAmount}`
            );

            shift += shiftAmount;
        }

        log.divider();
    }

    const endTime = performance.now();

    log.section('RESULTADO');
    log.log(`
Matches: ${result}
Tempo: ${(endTime - startTime).toFixed(4)} ms
Comparações: ${comparisons}
`);

    return {
        matches: result,
        metrics: {
            comparisons,
            executionTime: (endTime - startTime).toFixed(4),
            textLength: text.length,
            patternLength: pattern.length,
            complexity: "O(n / m) (melhor caso)"
        }
    };
}