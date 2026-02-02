const express = require('express');
const { commonMiddlewares, createRateLimiter } = require('../../middleware/commonMiddleware');
const { body, param, validationResult } = require('express-validator');
const pool = require('../../db');
const slugify = require('slugify');
const xss = require('xss');
const { Storage } = require('@google-cloud/storage');
require('dotenv').config();

const credentials = {
    type: process.env.CYBERNETIC_TYPE,
    project_id: process.env.CYBERNETIC_PROJECT_ID,
    private_key_id: process.env.CYBERNETIC_PRIVATE_KEY_ID,
    private_key: process.env.CYBERNETIC_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.CYBERNETIC_CLIENT_KEY,
    client_id: process.env.CYBERNETIC_CLIENT_ID,
    auth_uri: process.env.CYBERNETIC_AUTH_URI,
    token_uri: process.env.CYBERNETIC_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.CYBERNETIC_AUTH_PROVIDER_x509_CERT_URL,
    client_x509_cert_url: process.env.CYBERNETIC_CLIENT_x509_CERT_URL,
    universe_domain: process.env.CYBERNETIC_UNIVERSE_DOMAIN,
};
const storage = new Storage({ projectId: process.env.PROJECT_ID, credentials });
const bucketName = process.env.BUCKET_NAME;

const docRouter = express.Router();

// Security Middlewares
commonMiddlewares(docRouter);

// Rate Limiting
const docRouterLimiter = createRateLimiter();
docRouter.use(docRouterLimiter);

// GET all sections
docRouter.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM docsection ORDER BY display_order ASC');
        res.status(200).json({ 
            error: false, 
            data: result.rows 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: true, message: 'Internal server error' });
    }
});

docRouter.get('/:secno', 
    [
        param('secno').isInt().withMessage('Invalid section number')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: true, 
                message: errors.array()[0].msg 
            });
        }

        const { secno } = req.params;

        try {
            const result = await pool.query(
                'SELECT * FROM docsection WHERE secno = $1',
                [secno]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({
                    error: true,
                    message: 'Section not found'
                });
            }

            res.status(200).json({
                error: false,
                data: result.rows[0]
            });
        } catch (err) {
            console.error('Error fetching section:', err);
            res.status(500).json({
                error: true,
                message: 'Internal server error'
            });
        }
    }
);

docRouter.get('/slug/:slug', async (req, res) => {
    const { slug } = req.params;

    try {
        const result = await pool.query('SELECT * FROM docsection WHERE slug = $1', [slug]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: true, message: 'Section not found' });
        }
        res.status(200).json({ error: false, data: result.rows[0] });
    } catch (err) {
        console.error('Error fetching section by slug:', err);
        res.status(500).json({ error: true, message: 'Internal server error' });
    }
});

// POST new section
docRouter.post('/', 
    [
        body('name')
            .notEmpty().withMessage('Section name is required')
            .isString().withMessage('Section name must be a string')
            .trim().escape()
            .isLength({ max: 255 }).withMessage('Section name must be at most 255 characters long')
            .customSanitizer(value => xss(value)),
        body('parent_secno')
            .optional({ checkFalsy: true }).isInt().withMessage('Parent section number must be an integer'),
        body('display_order')
            .optional({ checkFalsy: true }).isInt().withMessage('Display order must be an integer'),
        body('metadescription').optional({ checkFalsy: true }).trim().isString(),
        body('metakeywords').optional({ checkFalsy: true }).trim().isString()
    ], 
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorMessages = errors.array().map((err) => err.msg);
            return res.status(400).json({
                error: true,
                message: errorMessages[0],
            });
        }

        const { name, parent_secno: rawParent, display_order = 999, metadescription = '', metakeywords = '' } = req.body;
        const parent_secno = rawParent ? parseInt(rawParent) : null;
        const slug = slugify(name, { lower: true, strict: true });

        const query = `
            INSERT INTO docsection (name, parent_secno, display_order, slug, metadescription, metakeywords) 
            VALUES ($1, $2, $3, $4, $5, $6) 
            RETURNING *
        `;
        try {
            await pool.query('BEGIN');
            const checkQuery = `
                    SELECT 1
                    FROM docsection
                    WHERE display_order = $1
                    AND (
                        (parent_secno IS NULL AND $2::integer IS NULL)
                        OR (parent_secno = $2::integer)
                    )
                    LIMIT 1;
                `;

            const checkResult = await pool.query(checkQuery, [display_order, parent_secno]);

            if (checkResult.rowCount > 0) {
                await pool.query('ROLLBACK');
                return res.status(409).json({
                    error: true,
                    message: `Display order ${display_order} is already used in this level (same parent or top-level). Please choose a different order.`
                });
            }

            const result = await pool.query(query, [name, parent_secno, display_order, slug, metadescription, metakeywords]);
            await pool.query('COMMIT');
            res.status(201).json({ 
                error: false, 
                message: 'Section created successfully',
                data: result.rows[0] 
            });
        } catch (err) {
            await pool.query('ROLLBACK');
            console.error(err);
            res.status(500).json({ error: true, message: 'Internal server error' });
        }
    }
);

// PUT update section
docRouter.put('/:secno', 
    [
        param('secno').isInt(),
        body('name')
            .optional()
            .isString().withMessage('Section name must be a string')
            .trim().escape()
            .isLength({ max: 255 }).withMessage('Section name must be at most 255 characters long')
            .customSanitizer(value => xss(value)),
        body('content_path').optional().trim(),
        body('display_order').optional().isInt(),
        body('metadescription').optional({ checkFalsy: true }).trim().isString(),
        body('metakeywords').optional({ checkFalsy: true }).trim().isString()
    ], async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorMessages = errors.array().map((err) => err.msg);
            return res.status(400).json({
                error: true,
                message: errorMessages[0],
            });
        }
        const { secno } = req.params;
        const { name, content_path, display_order, metadescription, metakeywords } = req.body;
        try {
            const updates = [];
            const values = [];
            let index = 1;
            if (name) {
                updates.push(`name = $${index++}`);
                values.push(name);

                const slug = slugify(name, { lower: true, strict: true });
                updates.push(`slug = $${index++}`);
                values.push(slug);
            }
            if (content_path) {
                updates.push(`content_path = $${index++}, last_update = CURRENT_TIMESTAMP`);
                values.push(content_path);
            }
            if (display_order) {
                updates.push(`display_order = $${index++}`);
                values.push(display_order);
            }
            if (metadescription !== undefined) {
                updates.push(`metadescription = $${index++}`);
                values.push(metadescription);
            }
            if (metakeywords !== undefined) {
                updates.push(`metakeywords = $${index++}`);
                values.push(metakeywords);
            }
            if (updates.length === 0) {
                return res.status(400).json({ error: true, message: 'No fields to update' });
            }
            values.push(secno);
            const query = `UPDATE docsection SET ${updates.join(', ')} WHERE secno = $${index} RETURNING *`;
            const result = await pool.query(query, values);
            if (result.rowCount === 0) {
                return res.status(404).json({ error: true, message: 'Section not found' });
            }
            res.status(200).json({ 
                error: false, 
                message: 'Section updated successfully',
                data: result.rows[0] 
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: true, message: 'Internal server error' });
        }
    }
);

// DELETE section
docRouter.delete('/:secno', 
    [
        param('secno').isInt()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorMessages = errors.array().map((err) => err.msg);
            return res.status(400).json({
                error: true,
                message: errorMessages[0],
            });
        }
        const { secno } = req.params;
        try {
            const result = await pool.query('DELETE FROM docsection WHERE secno = $1 RETURNING *', [secno]);
            if (result.rowCount === 0) {
                return res.status(404).json({ error: true, message: 'Section not found' });
            }
            res.status(200).json({ error: false, message: 'Section deleted successfully' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: true, message: 'Internal server error' });
        }
    }
);

// POST upload doc HTML 
async function uploadHtmlToGCS(htmlContent, secno) {
    try {
        const bucket = storage.bucket(bucketName);
        const fileName = `docs/sec_${secno}.html`;
        const blob = bucket.file(fileName);
        const blobStream = blob.createWriteStream({
            metadata: { contentType: 'text/html' }
        });
        blobStream.end(htmlContent);
        await new Promise((resolve, reject) => {
            blobStream.on('finish', resolve);
            blobStream.on('error', reject);
        });
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
        return publicUrl;
    } catch (error) {
        console.error('Upload Error:', error);
        throw error;
    }
}

docRouter.post('/upload/doc-html', [
    body('content').notEmpty(),
    body('secno').isInt()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: true, message: errors.array()[0].msg });
    }
    const { content, secno } = req.body;
    try {
        const publicUrl = await uploadHtmlToGCS(content, secno);
        res.status(200).json({ error: false, content_path: publicUrl });
    } catch (err) {
        res.status(500).json({ error: true, message: 'Failed to upload HTML' });
    }
});

// GET increment view_count
docRouter.get('/:secno/view', 
    [
        param('secno').isInt()
    ], 
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorMessages = errors.array().map((err) => err.msg);
            return res.status(400).json({
                error: true,
                message: errorMessages[0],
            });
        }
        const { secno } = req.params;
        try {
            const result = await pool.query('UPDATE docsection SET view_count = view_count + 1 WHERE secno = $1 RETURNING view_count', [secno]);
            if (result.rowCount === 0) {
                return res.status(404).json({ error: true, message: 'Section not found' });
            }
            res.status(200).json({ error: false, view_count: result.rows[0].view_count });
        } catch (err) {
            res.status(500).json({ error: true, message: 'Internal server error' });
        }
    }
);

module.exports = docRouter;