// commonMiddleware.js
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

// Common Middlewares
const commonMiddlewares = (app) => {
    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    baseUri: ["'self'"],
                    fontSrc: ["'self'"],
                    formAction: ["'self'"],
                    frameAncestors: ["'self'"],
                    imgSrc: [
                        "'self'", 
                        "data:",
                        "https://storage.googleapis.com"
                    ],
                    objectSrc: ["'none'"],
                    scriptSrc: [
                        "'self'",
                        "https://code.jquery.com/jquery-3.6.0.min.js",
                        "https://cdn.jsdelivr.net/npm/quill@2/dist/quill.js"
                    ],
                    connectSrc: [
                        "'self'", 
                        "https://cybernetic-zoo-462618-a8.uc.r.appspot.com/",
                        "https://accounts.google.com",
                        "https://oauth2.googleapis.com",
                        "http://localhost:3001",
                    ],
                    frameSrc: ["'self'"],
                    scriptSrcAttr: ["'none'"],
                    styleSrc: ["'self'", "https:", "'unsafe-inline'"],
                    upgradeInsecureRequests: [],
                },
            },
            referrerPolicy: { policy: 'no-referrer' }, 
            frameguard: { action: 'deny' }, 
            hsts: {
                maxAge: 31536000, 
                includeSubDomains: true,
                preload: true,
            }, 
            noSniff: true, 
            xssFilter: true,    
        })
    );
    app.use(cookieParser());
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
};

// Rate Limiting - Can be customized per route(per min 10000 req)
const createRateLimiter = (windowMs = 60 * 1000, max = 10000, message = "Too many requests, please try again later.") => {
    return rateLimit({
        windowMs,
        max,
        message: message || undefined,
        standardHeaders: true,
        legacyHeaders: false,
        validate: {
            trustProxy: false, 
        },
    });
};

module.exports = {
    commonMiddlewares,
    createRateLimiter,
};
