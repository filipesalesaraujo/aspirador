const axios = require('axios');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const css = require('css');
const JSZip = require('jszip');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({ secret: 'my-secret', resave: false, saveUninitialized: false }));

let downloadReady = false;  // Variable to track when the download is ready


async function downloadPageWithResources(url) {
    try {
        const response = await axios.get(url);
        const dom = new JSDOM(response.data);
        const document = dom.window.document;

        const cssLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
        for (let link of cssLinks) {
            if (link.href) {
                const cssResponse = await axios.get(link.href);
                const styleElement = document.createElement('style');
                styleElement.textContent = cssResponse.data;
                link.replaceWith(styleElement);
            }
        }

        const images = Array.from(document.querySelectorAll('img[src]'));
        const zip = new JSZip();

        for (let img of images) {
            if (img.src) {
                const imgResponse = await axios.get(img.src, { responseType: 'arraybuffer' });
                const imgBlob = Buffer.from(imgResponse.data, 'binary');
                const imagePathParts = img.src.split('/');
                const imageName = imagePathParts[imagePathParts.length - 1];

                img.src = `images/${imageName}`;
                zip.file(`images/${imageName}`, imgBlob);
            }
        }

        const updatedHtml = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
        zip.file('index.html', updatedHtml);

        const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
        return zipContent;
    } catch (error) {
        console.error('Error downloading page with resources:', error);
        throw error;
    }
    downloadReady = true;  // Set downloadReady to true when the download is ready
}

app.get('/', (req, res) => {
    res.send(`
        <h1>Download HTML with Inline CSS and Images in ZIP</h1>
        <form action="/download" method="post">
            <label for="url">URL da página:</label>
            <input type="text" id="url" name="url" placeholder="https://example.com">
            <button type="submit">Baixar tudo em ZIP</button>
        </form>
    `);
});

app.post('/download', async (req, res) => {
    try {
        const url = req.body.url;
        if (!url) {
            res.status(400).send('URL not provided.');
            return;
        }

        const zipContent = await downloadPageWithResources(url);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename=page_resources.zip');
        res.send(zipContent);
    } catch (error) {
        res.status(500).send('Error downloading page with resources.');
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log('Server listening on port', port);
});
