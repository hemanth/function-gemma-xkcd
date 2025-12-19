const worker = new Worker('worker.js', { type: 'module' });

const statusMessage = document.getElementById('status-message');
const progressBar = document.getElementById('progress-bar');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const outputPanel = document.getElementById('output-panel');
const thinkingIndicator = document.getElementById('thinking-indicator');
const comicDisplay = document.getElementById('comic-display');
const logMessage = document.getElementById('log-message');

const comicImg = document.getElementById('comic-img');
const comicTitle = document.getElementById('comic-title');
const comicAlt = document.getElementById('comic-alt');
const comicNum = document.getElementById('comic-num');
const comicDate = document.getElementById('comic-date');

// Initialize
worker.postMessage({ type: 'load' });

worker.onmessage = (e) => {
    const { type, data } = e.data;

    switch (type) {
        case 'progress':
            if (data.status === 'progress') {
                progressBar.style.width = `${data.progress}%`;
                statusMessage.textContent = `Downloading intelligence... ${Math.round(data.progress)}%`;
            }
            break;
        case 'ready':
            statusMessage.textContent = 'System online. Ready for extraction.';
            progressBar.parentElement.classList.add('hidden');
            userInput.disabled = false;
            sendBtn.disabled = false;
            break;
        case 'error':
            statusMessage.textContent = 'Error: ' + data;
            statusMessage.style.color = '#ff4b2b';
            break;
        case 'tool_call':
            handleToolCall(data);
            break;
        case 'text':
            showText(data);
            break;
    }
};

async function handleToolCall(toolCall) {
    // Be flexible with tool names (model might sometimes vary)
    if (toolCall.name.includes('xkcd')) {
        const query = toolCall.parameters.query || 'random';
        logMessage.textContent = `Accessing XKCD database for: "${query}"...`;

        try {
            let comic;
            const baseUrl = 'https://xkcd.hemanth.deno.net';
            if (query === 'random' || !query || query === '0' || query === 0) {
                // The proxy gives latest on the root
                const latestRes = await fetch(`${baseUrl}/`);
                const latestData = await latestRes.json();
                const latestNum = latestData.data.num;

                const randomNum = Math.floor(Math.random() * latestNum) + 1;
                const res = await fetch(`${baseUrl}/${randomNum}`);
                const randomData = await res.json();
                comic = randomData.data;
            } else {
                const numMatch = query.toString().match(/\d+/);
                const targetNum = numMatch ? numMatch[0] : null;

                if (targetNum && targetNum !== '0') {
                    const res = await fetch(`${baseUrl}/${targetNum}`);
                    const specificData = await res.json();
                    comic = specificData.data;
                } else {
                    logMessage.textContent = `Invalid comic number "${query}" (fetching latest)...`;
                    const res = await fetch(`${baseUrl}/`);
                    const latestData = await res.json();
                    comic = latestData.data;
                }
            }
            displayComic(comic);
        } catch (err) {
            showText("Extraction failed: " + err.message);
        }
    } else {
        showText(`Model requested unknown tool: ${toolCall.name}`);
    }
}

function displayComic(comic) {
    thinkingIndicator.classList.add('hidden');
    comicDisplay.classList.remove('hidden');

    comicTitle.textContent = comic.title;
    comicImg.src = comic.img;
    comicAlt.textContent = comic.alt;
    comicNum.textContent = `Comic #${comic.num}`;
    comicDate.textContent = `${comic.day}/${comic.month}/${comic.year}`;
}

function showText(text) {
    thinkingIndicator.classList.add('hidden');
    // Just a simple way to show raw text if tool call fails
    statusMessage.textContent = "Model Response: " + text;
}

sendBtn.onclick = () => {
    const text = userInput.value.trim();
    if (!text) return;

    userInput.value = '';
    comicDisplay.classList.add('hidden');
    thinkingIndicator.classList.remove('hidden');
    logMessage.textContent = "Analyzing intent...";

    worker.postMessage({ type: 'generate', data: text });
};

userInput.onkeydown = (e) => {
    if (e.key === 'Enter') sendBtn.click();
};
