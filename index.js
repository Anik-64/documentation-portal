const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');
const expressLayouts = require('express-ejs-layouts');
const pool = require('./db');
const docRouter = require('./server/docsection/docSection');

require('dotenv').config();

const app = express();
app.use(cookieParser());
app.use(express.json());
const corsOptions = {
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
};

app.use(cors(corsOptions));

// Log file
const logPath = process.platform === 'win32'
    ? path.join(process.env.TEMP || __dirname, 'access.log')
    : path.join('/tmp', 'access.log');

const logStream = fs.createWriteStream(logPath, { flags: 'a' });
console.log('Access log file path:', logStream.path);
morgan.token('body', (req) => {
    const body = { ...req.body };
    if (body.password) body.password = '*****';
    return JSON.stringify(body);
});

app.use(morgan(':date[iso] :method :url :status :response-time ms - :body', { stream: logStream }));
app.use(morgan('dev'));

// Health Check
app.get('/api/v1/healthcheck', (req, res) => {
    try {
        res.status(200).json({'status': 'Ok'}).end();
    } catch (err) {
        res.status(503).end();
    }
});

app.set('trust proxy', 2);

// Templet Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(expressLayouts);

app.use((req, res, next) => {
    res.locals.appName = 'Documentation Portal';
    res.locals.message = 'Welcome to Documentation Portal!';
    next();
});


app.get('/docs', (req, res) => {
    res.render('pages/docs', {
        title: 'Documentation Portal',
        description: 'Documentation and help articles',
        keywords: 'documentation, health',
        content: '',
        section: null,
        layout: 'layout',
        customJS: '/js/doc.js',
    });
});

app.get('/docs/:slug', async (req, res) => {
    const { slug } = req.params;

    try {
        const result = await pool.query('SELECT * FROM docsection WHERE slug = $1', [slug]);
        if (result.rows.length === 0) {
            return res.status(404).render('pages/404', { layout: false, title: 'Not Found' });
        }

        const section = result.rows[0];

        let contentHtml = '<p>No content yet</p>';
        if (section.content_path) {
            const response = await fetch(section.content_path);
            if (response.ok) {
                contentHtml = await response.text();
            }
        }

        res.render('pages/docs', {
            layout: 'layout',
            title: `${section.name} - Documentation`,
            description: `${section.metadescription || 'Documentation and help articles'}`,
            keywords: `${section.metakeywords || 'documentation, health'}`,
            content: contentHtml,
            section: section,
            customJS: '/js/doc.js',
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.use(
    '/api/v1/docs',
    docRouter
);

// Start the server
app.listen(process.env.PORT || 8080, () => {
    console.log(`Server running on port ${process.env.PORT || 8080}`);
});
