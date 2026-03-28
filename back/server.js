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

    // h = pow(d, m-1) % q
    // Representa o 'peso' do primeiro caractere. Usado para removê-lo quando a janela desliza
    for (let i = 0; i < m - 1; i++) 
        h = (h * d) % q;

    // hash inicial
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

        // recalcula hash
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

    const d = 256; // Número de caracteres possíveis
    const q = 101; // Número primo para evitar colisões

    const m = pattern.length; // Tamanho do padrão
    const n = text.length; // Tamanho do texto

    let p = 0;
    let t = 0;
    let h = 1; // Representa o 'peso' do primeiro caractere. Usado para removê-lo quando a janela desliza

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
                    steps.push(`==================================`)
                    match = false;
                    break;
                }
            }

            if (match) {
                steps.push(`Match confirmado na posição ${i}`);
                steps.push(`Buscando outras ocorrências...`)
                steps.push(`==================================`)
                result.push(i);
            }

        } else {
            steps.push(`Mismatch de Hash -> pula comparação`);
            steps.push(`==================================`)
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

app.listen(3000, () => {
    console.log('Servidor rodando em http://localhost:3000');
});