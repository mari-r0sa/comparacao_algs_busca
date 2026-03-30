const { performance } = require('perf_hooks');
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
            const text = fs.readFileSync(file.caminho, 'utf-8');

            // ================= NAIVE =================
            if (algorithm === 'naive') {

                if (stepByStep) {
                    const r = naiveSearchWithLogs(text, pattern);

                    resultados.push({
                        arquivo: file.nome,
                        ocorrencias: r.matches.length,
                        posicoes: r.matches,
                        steps: r.steps,
                        metrics: r.metrics
                    });

                } else {
                    const start = performance.now();
                    const r = naiveSearch(text, pattern);
                    const end = performance.now();

                    resultados.push({
                        arquivo: file.nome,
                        ocorrencias: r.matches.length,
                        posicoes: r.matches,
                        metrics: {
                            comparisons: r.comparisons,
                            executionTime: (end - start).toFixed(4),
                            textLength: text.length,
                            patternLength: pattern.length,
                            complexity: "O(n * m)"
                        }
                    });
                }

                continue;
            }

            // ================= RABIN-KARP =================
            if (algorithm === 'rabin') {

                if (stepByStep) {
                    const r = rabinKarpSearchWithLogs(text, pattern);

                    resultados.push({
                        arquivo: file.nome,
                        ocorrencias: r.matches.length,
                        posicoes: r.matches,
                        steps: r.steps,
                        metrics: r.metrics
                    });

                } else {
                    const start = performance.now();
                    const r = rabinKarpSearch(text, pattern);
                    const end = performance.now();

                    resultados.push({
                        arquivo: file.nome,
                        ocorrencias: r.matches.length,
                        posicoes: r.matches,
                        metrics: {
                            comparisons: r.comparisons,
                            executionTime: (end - start).toFixed(4),
                            textLength: text.length,
                            patternLength: pattern.length,
                            complexity: "O(n + m)"
                        }
                    });
                }

                continue;
            }

            // ================= KMP =================
            if (algorithm === 'kmp') {

                if (stepByStep) {
                    const r = kmpSearchWithLogs(text, pattern);

                    resultados.push({
                        arquivo: file.nome,
                        ocorrencias: r.matches.length,
                        posicoes: r.matches,
                        steps: r.steps,
                        metrics: r.metrics
                    });

                } else {
                    const start = performance.now();
                    const r = kmpSearch(text, pattern);
                    const end = performance.now();

                    resultados.push({
                        arquivo: file.nome,
                        ocorrencias: r.matches.length,
                        posicoes: r.matches,
                        metrics: {
                            comparisons: r.comparisons,
                            executionTime: (end - start).toFixed(4),
                            textLength: text.length,
                            patternLength: pattern.length,
                            complexity: "O(n + m)"
                        }
                    });
                }

                continue;
            }

            // ================= BOYER-MOORE =================
            if (algorithm === 'boyer') {

                if (stepByStep) {
                    const r = boyerMooreSearchWithLogs(text, pattern);

                    resultados.push({
                        arquivo: file.nome,
                        ocorrencias: r.matches.length,
                        posicoes: r.matches,
                        steps: r.steps,
                        metrics: r.metrics
                    });

                } else {
                    const start = performance.now();
                    const r = boyerMooreSearch(text, pattern);
                    const end = performance.now();

                    resultados.push({
                        arquivo: file.nome,
                        ocorrencias: r.matches.length,
                        posicoes: r.matches,
                        metrics: {
                            comparisons: r.comparisons,
                            executionTime: (end - start).toFixed(4),
                            textLength: text.length,
                            patternLength: pattern.length,
                            complexity: "O(n / m) (melhor caso)"
                        }
                    });
                }

                continue;
            }
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
    let comparisons = 0;

    for (let i = 0; i <= text.length - pattern.length; i++) {
        let j = 0;

        while (j < pattern.length) {
            comparisons++;

            if (text[i + j] !== pattern[j]) break;

            j++;
        }

        if (j === pattern.length) result.push(i);
    }

    return { matches: result, comparisons };
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
                    steps.push(`===================================================`);
                } 

                break;
            }

            steps.push(`Match!`);
            if (j != pattern.length - 1) {
                steps.push(`Alterando caractere de comparação...`);
                steps.push(`===================================================`);
            }
            
            j++;
        }

        if (j === pattern.length) {
            steps.push(`Encontrado na posição ${i}`);
            steps.push(`Buscando outra ocorrência...`);
            steps.push(`===================================================`);
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

/* ===========================================================================================
RABIN-KARP
- Usa hash em vez de comparar caractere por caractere o tempo todo, ou seja, compara números em vez de strings.
- Calcula hash do padrão -> Calcula hash do primeiro "trecho" do texto -> Se forem iguais, compara de novo pra garantir e vê se dá match.
- Conceito importante: 'rolling hash' -> ele compara "janelas" de texto, ou seja, em vez de comparar de 1 em 1, compara a qtd de caracteres do padrão buscado
  e, para passar para a próxima sem recalcular o hash do zero, ele remove o primeiro caractere e adiciona o próximo no final.
- Ex: 
Texto:   ABCDE
Padrão:  ABC

Comparações:
ABC -> primeira janela
BCD -> segunda
CDE -> terceira
============================================================================================== */

function rabinKarpSearch(text, pattern) {
    const result = [];
    let comparisons = 0;

    const d = 256; // Número de caracteres possíveis
    const q = 101; // Número primo para evitar colisões

    const m = pattern.length; // Tamanho do padrão
    const n = text.length; // Tamanho do texto

    let p = 0; // hash do pattern
    let t = 0; // hash da janela
    let h = 1; 

    for (let i = 0; i < m - 1; i++) 
        h = (h * d) % q;

    for (let i = 0; i < m; i++) {
        p = (d * p + pattern.charCodeAt(i)) % q;
        t = (d * t + text.charCodeAt(i)) % q;
    }

    for (let i = 0; i <= n - m; i++) {

        if (p === t) {
            let match = true;

            for (let j = 0; j < m; j++) {
                comparisons++;
                if (text[i + j] !== pattern[j]) {
                    match = false;
                    break;
                }
            }

            if (match) result.push(i);
        }

        if (i < n - m) {
            t = (d * (t - text.charCodeAt(i) * h) + text.charCodeAt(i + m)) % q;
            if (t < 0) t += q;
        }
    }

    return { matches: result, comparisons };
}

function rabinKarpSearchWithLogs(text, pattern) {
    const result = [];
    const steps = [];

    const d = 256;
    const q = 101;

    const m = pattern.length;
    const n = text.length;

    let p = 0;
    let t = 0;
    let h = 1;

    let comparisons = 0;

    const startTime = performance.now();

    steps.push(`Calculando h (d^(m-1) % q)`);

    for (let i = 0; i < m - 1; i++) {
        h = (h * d) % q;
    }

    steps.push(`h = ${h}`);

    steps.push(`Calculando hash inicial`);

    for (let i = 0; i < m; i++) {
        p = (d * p + pattern.charCodeAt(i)) % q;
        t = (d * t + text.charCodeAt(i)) % q;
    }

    steps.push(`Hash pattern = ${p}`);
    steps.push(`Hash inicial texto = ${t}`);

    for (let i = 0; i <= n - m; i++) {

        steps.push(`\n[SHIFT] i = ${i}`);

        if (p === t) {
            steps.push(`Match de Hash  -> verificando caracteres`);

            let match = true;

            for (let j = 0; j < m; j++) {
                comparisons++;

                steps.push(
                    `Comparando text[${i + j}] = '${text[i + j]}' com pattern[${j}]`
                );

                if (text[i + j] !== pattern[j]) {
                    steps.push(`Colisão de hash -> Falso positivo)`);
                    steps.push(`==================================`);
                    match = false;
                    break;
                }
            }

            if (match) {
                steps.push(`Match confirmado na posição ${i}`);
                steps.push(`Buscando outras ocorrências...`);
                steps.push(`==================================`);
                result.push(i);
            }

        } else {
            steps.push(`Mismatch de Hash -> pula comparação`);
            steps.push(`==================================`);
        }

        if (i < n - m) {
            const oldHash = t;

            t = (d * (t - text.charCodeAt(i) * h) + text.charCodeAt(i + m)) % q;

            if (t < 0) t += q;

            steps.push(`Rolling hash: de ${oldHash} para ${t}`);
        }
    }

    const endTime = performance.now();

    return {
        matches: result,
        steps,
        metrics: {
            comparisons,
            executionTime: (endTime - startTime).toFixed(4),
            textLength: n,
            patternLength: m,
            complexity: "O(n + m) (médio)"
        }
    };
}

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

function kmpSearchWithLogs(text, pattern) {
    const steps = [];
    const result = [];

    const lps = buildLPS(pattern);

    steps.push(`Tabela LPS: ${lps.join(", ")}`);

    let i = 0;
    let j = 0;
    let comparisons = 0;

    const startTime = performance.now();

    while (i < text.length) {
        comparisons++;

        steps.push(`Comparando text[${i}] = '${text[i]}' com pattern[${j}]`);

        if (text[i] === pattern[j]) {
            steps.push("Match");
            i++;
            j++;
        }

        if (j === pattern.length) {
            steps.push(`Encontrado na posição ${i - j}`);
            result.push(i - j);
            j = lps[j - 1];
        } else if (i < text.length && text[i] !== pattern[j]) {
            steps.push("Mismatch");

            if (j !== 0) {
                const oldJ = j;
                j = lps[j - 1];
                steps.push(`Usando LPS: j ${oldJ} -> ${j}`);
            } else {
                i++;
            }
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

function boyerMooreSearchWithLogs(text, pattern) {
    const result = [];
    const steps = [];

    const badChar = buildBadCharTable(pattern);

    steps.push(`Tabela Bad Character: ${JSON.stringify(badChar)}`);

    let shift = 0;
    let comparisons = 0;

    const startTime = performance.now();

    while (shift <= text.length - pattern.length) {
        steps.push(`\n[SHIFT] ${shift}`);

        let j = pattern.length - 1;

        while (j >= 0) {
            comparisons++;

            steps.push(
                `Comparando text[${shift + j}] = '${text[shift + j]}' com pattern[${j}]`
            );

            if (pattern[j] !== text[shift + j]) {
                steps.push("Mismatch");
                break;
            }

            j--;
        }

        if (j < 0) {
            steps.push(`Encontrado na posição ${shift}`);
            result.push(shift);

            shift += (shift + pattern.length < text.length)
                ? pattern.length - (badChar[text[shift + pattern.length]] ?? -1)
                : 1;
        } else {
            const shiftAmount = Math.max(1, j - (badChar[text[shift + j]] ?? -1));

            steps.push(`Deslocando ${shiftAmount}`);
            shift += shiftAmount;
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
            complexity: "O(n / m) (melhor caso)"
        }
    };
}

app.listen(3000, () => {
    console.log('Servidor rodando em http://localhost:3000');
});