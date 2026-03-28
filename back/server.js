const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());

// CONFIG UPLOAD
const uploadPath = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage });

// UPLOAD
app.post('/upload', upload.array('files'), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
        }

        const fileNames = req.files.map(f => f.originalname);

        res.json({
            message: 'Upload realizado com sucesso!',
            files: fileNames
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro interno' });
    }
});

// SEARCH
app.post('/search', upload.array('files'), (req, res) => {
    try {
        const pattern = req.body.pattern;
        const algorithm = req.body.algorithm;
        const stepByStep = req.body.stepByStep === 'true';

        if (!pattern) {
            return res.status(400).json({ message: 'Informe um padrão para busca.' });
        }

        let arquivosParaBuscar = [];

        // Se enviou arquivos, usa arquivos enviados
        if (req.files && req.files.length > 0) {
            arquivosParaBuscar = req.files.map(file => ({
                nome: file.originalname,
                caminho: file.path
            }));
        } 
        // Se não, arquivos já salvos
        else {
            const files = fs.readdirSync(uploadPath);

            if (files.length === 0) {
                return res.status(400).json({ message: 'Nenhum arquivo disponível para busca.' });
            }

            arquivosParaBuscar = files.map(file => ({
                nome: file,
                caminho: path.join(uploadPath, file)
            }));
        }

        const resultados = [];

        for (const file of arquivosParaBuscar) {
            const content = fs.readFileSync(file.caminho, 'utf-8');

            // Naive Search
            if (algorithm === 'naive') {

                // Exec passo a passo
                if (stepByStep) {
                    const naive = naiveSearchWithLogs(content, pattern);

                    resultados.push({
                        arquivo: file.nome,
                        ocorrencias: naive.matches.length,
                        posicoes: naive.matches,
                        steps: naive.steps,
                        metrics: naive.metrics
                    });
                } 
                // Exec normal
                else {
                    const start = performance.now();

                    const matches = naiveSearch(content, pattern);

                    const end = performance.now();

                    resultados.push({
                        arquivo: file.nome,
                        ocorrencias: matches.length,
                        posicoes: matches,
                        metrics: {
                            executionTime: (end - start).toFixed(4),
                            textLength: content.length,
                            patternLength: pattern.length,
                            complexity: "O(n * m)"
                        }
                    });
                }

                continue;
            }

            let matches = [];

            switch (algorithm) {
                case 'kmp':
                    matches = kmpSearch(content, pattern);
                    break;
                case 'rabin':
                    matches = rabinKarpSearch(content, pattern);
                    break;
                case 'boyer':
                    matches = boyerMooreSearch(content, pattern);
                    break;
            }

            resultados.push({
                arquivo: file.nome,
                ocorrencias: matches.length,
                posicoes: matches
            });
        }

        res.json({
            pattern,
            algorithm,
            resultados
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro interno' });
    }
});

/* ===========================================================================================
NAIVE SEARCH
- Tenta encaixar o 'pattern' em todas as posições do código e verifica se dá match ou não.
- Para cada i, compara caractere por caractere (j) e, se não der match, avança uma posição
============================================================================================== */

// NAIVE NORMAL
function naiveSearch(text, pattern) {
    const result = [];

    for (let i = 0; i <= text.length - pattern.length; i++) {
        let j = 0;

        while (j < pattern.length && text[i + j] === pattern[j]) {
            j++;
        }

        if (j === pattern.length) result.push(i);
    }

    return result;
}

// NAIVE PASSO A PASSO
function naiveSearchWithLogs(text, pattern) {
    const result = [];
    const steps = [];

    let comparisons = 0;

    const startTime = performance.now();

    for (let i = 0; i <= text.length - pattern.length; i++) {

        steps.push(`\n[SHIFT] i = ${i}`);

        let j = 0;

        while (j < pattern.length) {
            comparisons++;

            steps.push(
                `Comparando text[${i + j}] = '${text[i + j]}' com pattern[${j}] = '${pattern[j]}'`
            );

            if (text[i + j] !== pattern[j]) {
                steps.push(`Mismatch`);

                if (j != 0) {
                    steps.push(`Voltando ao primeiro caractere de comparação`);   
                    steps.push(`===================================================`)
                } 

                break;
            }

            steps.push(`Match!`);
            if (j != pattern.length - 1) {
                steps.push(`Alterando caractere de comparação...`)
                steps.push(`===================================================`)
            }
            
            j++;
        }

        if (j === pattern.length) {
            steps.push(`Encontrado na posição ${i}`);
            steps.push(`Buscando outra ocorrência...`)
            steps.push(`===================================================`)
            result.push(i);
        }
    }

    const endTime = performance.now();

    return {
        matches: result,
        steps,
        metrics: {
            comparisons,
            executionTime: (endTime - startTime).toFixed(4),
            textLength: text.length,
            patternLength: pattern.length,
            complexity: "O(n * m)"
        }
    };
}

function buildLPS(pattern) {
    const lps = Array(pattern.length).fill(0);
    let len = 0;
    let i = 1;

    while (i < pattern.length) {
        if (pattern[i] === pattern[len]) {
            len++;
            lps[i] = len;
            i++;
        } else {
            if (len !== 0) {
                len = lps[len - 1];
            } else {
                lps[i] = 0;
                i++;
            }
        }
    }

    return lps;
}

function kmpSearch(text, pattern) {
    const lps = buildLPS(pattern);
    const result = [];

    let i = 0, j = 0;

    while (i < text.length) {
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

    return result;
}

app.listen(3000, () => {
    console.log('Servidor rodando em http://localhost:3000');
});