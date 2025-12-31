const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3001;

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/xml; charset=utf-8'
};

const server = http.createServer((req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200, corsHeaders);
        res.end();
        return;
    }

    // Parse the target URL from query parameter
    const parsedUrl = url.parse(req.url, true);
    const targetUrl = parsedUrl.query.url;

    if (!targetUrl) {
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing url parameter' }));
        return;
    }

    // Determine which module to use (http or https)
    const client = targetUrl.startsWith('https') ? https : http;

    // Fetch the target URL
    client.get(targetUrl, (response) => {
        let data = '';

        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            const redirectUrl = response.headers.location;
            // Make absolute URL if relative
            const absoluteUrl = redirectUrl.startsWith('http') 
                ? redirectUrl 
                : new URL(redirectUrl, targetUrl).href;
            
            // Recursively fetch the redirect URL
            const redirectClient = absoluteUrl.startsWith('https') ? https : http;
            redirectClient.get(absoluteUrl, (redirectResponse) => {
                redirectResponse.on('data', (chunk) => {
                    data += chunk;
                });
                redirectResponse.on('end', () => {
                    res.writeHead(200, corsHeaders);
                    res.end(data);
                });
            }).on('error', (error) => {
                res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            });
            return;
        }

        // Collect response data
        response.on('data', (chunk) => {
            data += chunk;
        });

        response.on('end', () => {
            // Return the XML content
            res.writeHead(200, corsHeaders);
            res.end(data);
        });
    }).on('error', (error) => {
        res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
    });
});

server.listen(PORT, () => {
    console.log(`XML Proxy Server running on http://localhost:${PORT}`);
    console.log(`Usage: http://localhost:${PORT}/?url=<target-url>`);
});

