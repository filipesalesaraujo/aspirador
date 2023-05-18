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

        // Load Poppins font from Google Fonts
        const fontLink = document.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&display=swap';
        document.head.appendChild(fontLink);

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
        <style>
            html, body, div, span, applet, object, iframe,
            h1, h2, h3, h4, h5, h6, p, blockquote, pre,
            a, abbr, acronym, address, big, cite, code,
            del, dfn, em, img, ins, kbd, q, s, samp,
            small, strike, strong, sub, sup, tt, var,
            b, u, i, center,
            dl, dt, dd, ol, ul, li,
            fieldset, form, label, legend,
            table, caption, tbody, tfoot, thead, tr, th, td,
            article, aside, canvas, details, embed, 
            figure, figcaption, footer, header, hgroup, 
            menu, nav, output, ruby, section, summary,
            time, mark, audio, video {
                margin: 0;
                padding: 0;
                border: 0;
                font-size: 100%;
                font: inherit;
                vertical-align: baseline;
            }
            /* HTML5 display-role reset for older browsers */
            article, aside, details, figcaption, figure, 
            footer, header, hgroup, menu, nav, section {
                display: block;
            }
            body {
                line-height: 1;
            }
            ol, ul {
                list-style: none;
            }
            blockquote, q {
                quotes: none;
            }
            blockquote:before, blockquote:after,
            q:before, q:after {
                content: '';
                content: none;
            }
            table {
                border-collapse: collapse;
                border-spacing: 0;
            }    
            body {
                    font-family: 'Poppins', sans-serif;
                }
            h1, h2, h3 {
                font-weight: 700;
            }
            .div {
                background: #2e3440;
                height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 20px;
                font-size: 38px;
                color: #eceff4;
                padding: 20px;
            }
            .div form {
                max-width: 1360px;
                width: 100%;
                display: flex;
                flex-direction: column;
                gap: 20px;
                align-items: center;
            }
            .div form input {
                width: 100%;
                font-size: 24px;
                width: 100%;
                border-radius: 5px;
                padding: 5px 10px;
                box-shadow: none;
                background: #e5e9f0;
                border: 0;
            }
            .div form button {
                background: #5e81ac;
                border: 0;
                border-radius: 5px;
                padding: 5px 10px;
                font-size: 24px;
                width: 100%;
            }
            .div form button {
                cursor: pointer;
                transition: 0.3s ease-in-out;
            }
            .div form button:hover,
            .div form button:active,
            .div form button:focus {
                background: #a3be8c;
            }
        </style>
        <div class="div">
            <h1>Baixe HTML com CSS Inline e Imagens em ZIP</h1>
            <form action="/download" method="post">
                <label for="url">URL da página:</label>
                <input type="text" id="url" name="url" placeholder="https://example.com">
                <button type="submit">Baixar tudo em ZIP</button>
            </form>
        </div>
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
