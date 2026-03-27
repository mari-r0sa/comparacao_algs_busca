const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());

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

app.post('/search', upload.array('files'), (req, res) => {
    try {
        const pattern = req.body.pattern;
        const algorithm = req.body.algorithm;

        if (!pattern) {
            return res.status(400).json({ message: 'Informe um padrão para busca.' });
        }

        let arquivosParaBuscar = [];

        // 🔥 CASO 1: usuário enviou arquivos
        if (req.files && req.files.length > 0) {
            arquivosParaBuscar = req.files.map(file => ({
                nome: file.originalname,
                caminho: file.path
            }));
        } 
        // 🔥 CASO 2: usar arquivos já existentes
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
                default:
                    matches = naiveSearch(content, pattern);
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
    console.log('🚀 Servidor rodando em http://localhost:3000');
});